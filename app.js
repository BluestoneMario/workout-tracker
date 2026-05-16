(function () {
'use strict';

const ACCENT={A:'#5a8cd6',B:'#d49355'};

let DATA;

let S={sess:'A',view:'workout',sets:{},notes:{},exp:{},wStart:null,elapsed:0,restSecs:0,restDuration:90,restEndAt:0,history:[],timerState:'idle',accumulatedMs:0};
let elInt=null,restInt=null;
let CAL={year:new Date().getFullYear(),month:new Date().getMonth()};

function allExs(k){return DATA[k].blocks.flatMap(b=>b.exs);}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('./routines.json');
    DATA = await res.json();
  } catch (err) {
    console.error('[app] Failed to load routines.json:', err);
    document.body.innerHTML = '<div style="color:#f1f1f3;padding:2rem;font-family:sans-serif;">Failed to load workout data. Please reload.</div>';
    return;
  }
  document.getElementById('date-disp').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  document.getElementById('run-date').value=new Date().toISOString().split('T')[0];
  try{
    const stored=localStorage.getItem('training_history');
    if(stored){const parsed=JSON.parse(stored);if(Array.isArray(parsed))S.history=parsed;}
  }catch(e){S.history=[];}
  render();updateProg();updateTimerBtn();

  // Position mini-bar just below the sticky navigation elements
  (function positionMiniBar() {
    const nav = document.querySelector('.top-nav');
    const hdr = document.querySelector('.sticky-hdr');
    const offset = (nav ? nav.offsetHeight : 0) + (hdr ? hdr.offsetHeight : 0);
    if (offset > 0) document.getElementById('mini-bar').style.top = offset + 'px';
  })();

  // Show mini-bar when workout panel header is scrolled out of view
  const panelHdr = document.querySelector('.workout-panel-hdr');
  const miniBar  = document.getElementById('mini-bar');
  if (panelHdr && miniBar) {
    const updateMiniBarVisibility = () => {
      if (S.view !== 'workout') return;
      const rect = panelHdr.getBoundingClientRect();
      const show = rect.bottom <= (document.querySelector('.sticky-hdr')?.offsetHeight || 0);
      miniBar.classList.toggle('mini-bar--visible', show);
      miniBar.setAttribute('aria-hidden', String(!show));
      if (show) updateMiniBar();
    };

    const obs = new IntersectionObserver(updateMiniBarVisibility, { threshold: 0 });
    obs.observe(panelHdr);

    window.addEventListener('scroll', updateMiniBarVisibility, { passive: true });
  }
});

function switchSession(k){
  if(k===S.sess)return;
  if(S.wStart&&!confirm('Switch session? Current progress will be cleared.'))return;
  S.sess=k;S.sets={};S.notes={};S.exp={};S.wStart=null;S.elapsed=0;S.timerState='idle';S.accumulatedMs=0;
  clearInterval(elInt);
  const td=document.getElementById('timer-disp');
  td.textContent='--:--';td.style.color='var(--color-text-tertiary, #6a6a71)';
  stopRest();
  document.getElementById('tab-A').className='sess-tab'+(k==='A'?' on-a':'');
  document.getElementById('tab-B').className='sess-tab'+(k==='B'?' on-b':'');
  document.getElementById('wrap').classList.toggle('is-b',k==='B');
  document.getElementById('prog-fill').style.background=ACCENT[k];
  render();updateProg();updateTimerBtn();
  updateMiniBar();
}

function setTab(t){
  S.view=t;
  document.getElementById('tab-workout').style.display=t==='workout'?'':'none';
  document.getElementById('tab-history').style.display=t==='history'?'':'none';
  document.getElementById('nav-workout').classList.toggle('top-tab-active',t==='workout');
  document.getElementById('nav-history').classList.toggle('top-tab-active',t==='history');
  if(t==='history'){
    document.getElementById('mini-bar').classList.remove('mini-bar--visible');
    renderHist();
  }
}

function openRunSheet(){
  document.getElementById('run-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('run-backdrop').classList.add('open');
  document.getElementById('run-sheet').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeRunSheet(){
  document.getElementById('run-backdrop').classList.remove('open');
  document.getElementById('run-sheet').classList.remove('open');
  document.body.style.overflow='';
}

function openSettingsSheet(){
  document.getElementById('settings-backdrop').classList.add('open');
  document.getElementById('settings-sheet').classList.add('open');
  document.body.style.overflow='hidden';
  const label=document.getElementById('sw-version-label');
  label.textContent='—';
  if('serviceWorker' in navigator&&navigator.serviceWorker.controller){
    const onMsg=(e)=>{
      if(e.data&&e.data.type==='SW_VERSION'){
        label.textContent=e.data.version;
        navigator.serviceWorker.removeEventListener('message',onMsg);
      }
    };
    navigator.serviceWorker.addEventListener('message',onMsg);
    navigator.serviceWorker.controller.postMessage({type:'GET_VERSION'});
    setTimeout(()=>navigator.serviceWorker.removeEventListener('message',onMsg),1000);
  }
  const stats = getStorageStats();
  const storageEl = document.getElementById('storage-usage');
  if (storageEl) storageEl.textContent = stats.usedKB + ' KB used (~' + stats.pct + '% of 5 MB)';
}
function closeSettingsSheet(){
  document.getElementById('settings-backdrop').classList.remove('open');
  document.getElementById('settings-sheet').classList.remove('open');
  document.body.style.overflow='';
}

async function forceUpdate(){
  const haveSW='serviceWorker' in navigator;
  if(haveSW){
    const reg=await navigator.serviceWorker.getRegistration();
    if(reg&&navigator.serviceWorker.controller){
      await new Promise((resolve)=>{
        const onMsg=(e)=>{
          if(e.data&&e.data.type==='CACHES_CLEARED'){
            navigator.serviceWorker.removeEventListener('message',onMsg);
            resolve();
          }
        };
        navigator.serviceWorker.addEventListener('message',onMsg);
        navigator.serviceWorker.controller.postMessage({type:'CLEAR_CACHES'});
        setTimeout(resolve,1500);
      });
    }
    if(reg)await reg.unregister();
  }
  location.reload();
}

function updatePace(){
  const dist=parseFloat(document.getElementById('run-dist').value)||0;
  const hh=parseInt(document.getElementById('run-hh').value)||0;
  const mm=parseInt(document.getElementById('run-mm').value)||0;
  const ss=parseInt(document.getElementById('run-ss').value)||0;
  const totalSecs=hh*3600+mm*60+ss;
  const el=document.getElementById('run-pace');
  if(dist>0&&totalSecs>0){
    const paceDecimal=totalSecs/60/dist;
    const paceMin=Math.floor(paceDecimal);
    const paceSec=String(Math.round((paceDecimal-paceMin)*60)).padStart(2,'0');
    el.textContent=paceMin+':'+paceSec+' min/km';
  }else{
    el.textContent='—';
  }
}

function saveRun(){
  const dist=parseFloat(document.getElementById('run-dist').value)||0;
  const hh=parseInt(document.getElementById('run-hh').value)||0;
  const mm=parseInt(document.getElementById('run-mm').value)||0;
  const ss=parseInt(document.getElementById('run-ss').value)||0;
  const totalSecs=hh*3600+mm*60+ss;
  const date=document.getElementById('run-date').value;
  const errEl=document.getElementById('run-error');
  const confEl=document.getElementById('run-confirm');
  errEl.classList.remove('visible');confEl.classList.remove('visible');
  if(!date||dist<=0||totalSecs<=0){errEl.classList.add('visible');return;}
  const runType=document.getElementById('run-type').value;
  const paceDecimal=totalSecs/60/dist;
  const entry={
    date:date,
    sessionType:'run',
    sessionLabel:runType+' · '+dist+'km',
    durationSeconds:totalSecs,
    distanceKm:dist,
    paceMinPerKm:paceDecimal,
    runType:runType,
    notes:document.getElementById('run-notes').value,
    completed:true
  };
  const hist=[entry,...S.history];
  S.history=hist;
  localStorage.setItem('training_history',JSON.stringify(hist));
  document.getElementById('run-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('run-dist').value='';
  document.getElementById('run-hh').value='';
  document.getElementById('run-mm').value='';
  document.getElementById('run-ss').value='';
  document.getElementById('run-notes').value='';
  document.getElementById('run-pace').textContent='—';
  confEl.classList.add('visible');
  setTimeout(()=>{confEl.classList.remove('visible');closeRunSheet();},1000);
}

function findLastEntry(exId){
  for(const sess of S.history){
    const entry=(sess.exercises||[]).find(e=>e.id===exId);
    if(entry)return{...entry,date:sess.date};
  }
  return null;
}

function formatDate(iso){
  const d=new Date(iso+'T00:00:00');
  return d.getDate()+' '+d.toLocaleDateString('en-GB',{month:'short'});
}

function render(){
  const d=DATA[S.sess];const el=document.getElementById('ex-list');el.innerHTML='';
  d.blocks.forEach(blk=>{
    const div=document.createElement('div');
    div.className='blk-div';
    div.innerHTML=`<div class="blk-div-line"></div><span class="blk-div-lbl">${blk.lbl}</span><div class="blk-div-line"></div>`;
    el.appendChild(div);
    blk.exs.forEach(ex=>{
      const arr=S.sets[ex.id]||Array(ex.sets).fill(false);
      const done=arr.filter(Boolean).length;const allDone=done===ex.sets;const inProg=done>0&&!allDone;
      const card=document.createElement('div');
      card.className='ex-card'+(allDone?' done':inProg?' prog':'');

      const lastEntry=findLastEntry(ex.id);
      let lastTimeHtml='';
      if(lastEntry){
        const dateStr=formatDate(lastEntry.date);
        const rawNote=lastEntry.notes||'';
        const note=rawNote.length>60?rawNote.slice(0,60)+'…':rawNote;
        lastTimeHtml=`<div class="last-time"><span class="last-time-date">${dateStr}</span><span class="last-time-sets">${lastEntry.setsCompleted}/${lastEntry.totalSets} sets</span>${note?`<span class="last-time-note">${note}</span>`:''}</div>`;
      }

      const hdr=document.createElement('div');
      hdr.className='card-hdr';
      hdr.onclick=()=>toggleExp(ex.id);
      hdr.innerHTML=`
        <div class="card-hdr-top">
          <div class="ex-title-wrap">
            <div class="ex-title-row">
              <span class="ex-name">${ex.name}</span>
              <span class="reps-badge">${ex.reps}</span>
              ${allDone?'<i class="ti ti-circle-check-filled ex-done-icon" aria-hidden="true"></i>':''}
            </div>
            <div class="ex-muscles">${ex.muscles}</div>
          </div>
          <i class="ti ti-chevron-${S.exp[ex.id]?'up':'down'} ex-chev" aria-hidden="true"></i>
        </div>
        ${lastTimeHtml}
        <div class="set-row">
          ${arr.map((_,i)=>`<button class="bubble${arr[i]?' on':''}" onclick="event.stopPropagation();toggleSet('${ex.id}',${i})" aria-label="Set ${i+1}">${arr[i]?'<i class="ti ti-check" aria-hidden="true"></i>':(i+1)}</button>`).join('')}
          <span class="set-count">${done}/${ex.sets}</span>
        </div>`;
      card.appendChild(hdr);
      if(S.exp[ex.id]){
        const body=document.createElement('div');
        body.className='card-body';
        body.innerHTML=`
          ${ex.warn?`<div class="warn-pill"><i class="ti ti-alert-triangle" aria-hidden="true"></i>${ex.warn}</div>`:''}
          <div class="tip-box">${ex.tip}</div>
          <a class="ill-link" href="${ex.url}" target="_blank" rel="noopener"><i class="ti ti-external-link" aria-hidden="true"></i><span>Illustration &amp; instructions</span></a>
          <textarea class="ex-textarea" rows="2" placeholder="Notes — variation used, how it felt, any weight..." oninput="setNote('${ex.id}',this.value)">${S.notes[ex.id]||''}</textarea>`;
        card.appendChild(body);
      }
      el.appendChild(card);
    });
  });
}

function setNote(id,v){S.notes[id]=v;}

function toggleExp(id){S.exp[id]=!S.exp[id];render();}

function toggleSet(id,i){
  const ex=allExs(S.sess).find(e=>e.id===id);
  const arr=S.sets[id]||Array(ex.sets).fill(false);
  const was=arr[i];const upd=[...arr];upd[i]=!was;S.sets[id]=upd;
  if(!was){
    if(S.timerState==='idle')startEl();
    const restDur=ex.rest===0?0:(ex.rest!=null?ex.rest:90);
    if(restDur>0)startRest(restDur);
  }
  render();updateProg();
}

function updateProg(){
  const exs=allExs(S.sess);
  const tot=exs.reduce((s,e)=>s+e.sets,0);
  const done=exs.reduce((s,e)=>s+((S.sets[e.id]||[]).filter(Boolean).length),0);
  const pct=tot>0?Math.round(done/tot*100):0;
  document.getElementById('prog-sets').textContent=done+' / '+tot;
  document.getElementById('prog-pct').textContent=pct+'%';
  document.getElementById('prog-fill').style.width=pct+'%';
  updateMiniBar();
}

function updateTimerBtn(){
  const btn=document.getElementById('timer-btn');
  if(S.timerState==='running'){
    btn.innerHTML='<i class="ti ti-player-pause" aria-hidden="true"></i><span>Pause</span>';
  }else if(S.timerState==='paused'){
    btn.innerHTML='<i class="ti ti-player-play" aria-hidden="true"></i><span>Resume</span>';
  }else{
    btn.innerHTML='<i class="ti ti-player-play" aria-hidden="true"></i><span>Start</span>';
  }
}

function startEl(){
  S.wStart=Date.now();
  S.timerState='running';
  const td=document.getElementById('timer-disp');
  td.style.color='var(--color-text-primary, #f1f1f3)';
  clearInterval(elInt);
  elInt=setInterval(()=>{
    S.elapsed=Math.floor((S.accumulatedMs+Date.now()-S.wStart)/1000);
    const m=String(Math.floor(S.elapsed/60)).padStart(2,'0'),s=String(S.elapsed%60).padStart(2,'0');
    td.textContent=m+':'+s;
    updateMiniBar();
  },1000);
  updateTimerBtn();
}

function pauseEl(){
  S.accumulatedMs+=Date.now()-S.wStart;
  S.wStart=null;
  S.timerState='paused';
  clearInterval(elInt);
  if(S.restSecs>0){
    clearInterval(restInt);
    document.getElementById('rest-row').style.display='none';
  }
  updateTimerBtn();
  updateMiniBar();
}

function toggleTimer(){
  if(S.timerState==='idle'||S.timerState==='paused')startEl();
  else pauseEl();
}

function startRest(duration){
  S.restDuration = duration;
  S.restEndAt = Date.now() + duration * 1000;
  clearInterval(restInt);
  document.getElementById('rest-row').style.display = 'flex';
  S.restSecs = duration;
  updRest();
  restInt = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((S.restEndAt - Date.now()) / 1000));
    S.restSecs = remaining;
    updRest();
    if (remaining === 0) stopRest();
  }, 250);
}

function updRest(){
  const pct=S.restDuration>0?(S.restSecs/S.restDuration*100).toFixed(1):'100';
  document.getElementById('rest-cnt').textContent=S.restSecs+'s';
  document.getElementById('rest-fill').style.width=pct+'%';
  const ratio=S.restDuration>0?S.restSecs/S.restDuration:0;
  document.getElementById('rest-fill').style.background=ratio>0.5?'#22C55E':ratio>0.17?'#F59E0B':'#EF4444';
  updateMiniBar();
}

function stopRest(){clearInterval(restInt);S.restSecs=0;document.getElementById('rest-row').style.display='none';updateMiniBar();}

function updateMiniBar() {
  const timerEl = document.getElementById('mini-timer');
  const fillEl  = document.getElementById('mini-prog-fill');
  const rightEl = document.getElementById('mini-right');
  if (!timerEl) return;

  // Elapsed timer
  const m = String(Math.floor(S.elapsed / 60)).padStart(2, '0');
  const s = String(S.elapsed % 60).padStart(2, '0');
  timerEl.textContent = S.timerState === 'idle' ? '--:--' : m + ':' + s;

  // Progress bar
  const exs = allExs(S.sess);
  const tot  = exs.reduce((sum, e) => sum + e.sets, 0);
  const done = exs.reduce((sum, e) => sum + ((S.sets[e.id] || []).filter(Boolean).length), 0);
  const pct  = tot > 0 ? Math.round(done / tot * 100) : 0;
  fillEl.style.width = pct + '%';

  // Right side: rest countdown when active, otherwise set count
  if (S.restSecs > 0) {
    rightEl.textContent = 'Rest ' + S.restSecs + 's';
    rightEl.classList.add('mini-resting');
  } else {
    rightEl.textContent = done + '/' + tot;
    rightEl.classList.remove('mini-resting');
  }
}

function saveSession(){
  const exs=allExs(S.sess);const d=DATA[S.sess];
  const sess={
    date:new Date().toISOString().split('T')[0],sessionType:S.sess,
    sessionLabel:d.name+' — '+d.sub,durationSeconds:S.elapsed,
    exercises:exs.map(e=>({id:e.id,name:e.name,setsCompleted:(S.sets[e.id]||[]).filter(Boolean).length,totalSets:e.sets,notes:S.notes[e.id]||''})),
    totalSetsCompleted:exs.reduce((s,e)=>s+((S.sets[e.id]||[]).filter(Boolean).length),0),
    totalSets:exs.reduce((s,e)=>s+e.sets,0),
    completed:exs.every(e=>(S.sets[e.id]||[]).filter(Boolean).length===e.sets)
  };
  const hist=[sess,...S.history];
  localStorage.setItem('training_history',JSON.stringify(hist));
  S.history=hist;
  showCompletion(sess);
}

function exportJSON(){
  const blob=new Blob([JSON.stringify({version:1,sessions:S.history},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='training_history_'+new Date().toISOString().split('T')[0]+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

function showCompletion(sess){
  const m=String(Math.floor(sess.durationSeconds/60)).padStart(2,'0');
  const s=String(sess.durationSeconds%60).padStart(2,'0');
  const pct=sess.totalSets>0?Math.round(sess.totalSetsCompleted/sess.totalSets*100):0;
  const overlay=document.getElementById('completion-overlay');
  overlay.innerHTML=`
    <div class="compl-card">
      <div class="compl-eyebrow">Session saved</div>
      <div class="compl-title">${sess.sessionLabel}</div>
      <div class="compl-stats">
        <div class="compl-stat-row">
          <span class="compl-stat-name">Duration</span>
          <span class="compl-stat-val">${m}:${s}</span>
        </div>
        <div class="compl-stat-row">
          <span class="compl-stat-name">Sets</span>
          <span class="compl-stat-val">${sess.totalSetsCompleted} / ${sess.totalSets}</span>
        </div>
        <div class="compl-stat-row">
          <span class="compl-stat-name">Result</span>
          <span class="badge ${sess.completed?'bg-g':'bg-a'}">${sess.completed?'Complete':pct+'%'}</span>
        </div>
      </div>
      <div class="compl-actions">
        <button onclick="dismissCompletion()" class="btn-primary"><i class="ti ti-check" aria-hidden="true"></i><span>Done</span></button>
        <button onclick="exportJSON()" class="btn-secondary"><i class="ti ti-download" aria-hidden="true"></i><span>Export JSON</span></button>
      </div>
    </div>`;
  overlay.style.display='flex';
}

function dismissCompletion(){
  document.getElementById('completion-overlay').style.display='none';
  S.sets={};S.notes={};S.exp={};S.wStart=null;S.elapsed=0;S.timerState='idle';S.accumulatedMs=0;
  clearInterval(elInt);stopRest();
  const td=document.getElementById('timer-disp');
  td.textContent='--:--';td.style.color='var(--color-text-tertiary, #6a6a71)';
  render();updateProg();updateTimerBtn();
  updateMiniBar();
}

function loadHistory(ev){
  const file=ev.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=e=>{
    try {
      const d = JSON.parse(e.target.result);

      if (!d || !Array.isArray(d.sessions)) {
        alert('Invalid file: expected a training history export with a "sessions" array.');
        return;
      }

      const isValidSession = (s) =>
        s !== null &&
        typeof s === 'object' &&
        typeof s.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
        typeof s.sessionType === 'string' &&
        typeof s.sessionLabel === 'string';

      const valid = d.sessions.filter(isValidSession);
      const skipped = d.sessions.length - valid.length;

      if (valid.length === 0) {
        alert('No valid sessions found in this file. The file may be empty or incorrectly formatted.');
        return;
      }

      const existing = new Map(S.history.map(s => [s.date + '|' + s.sessionType, s]));
      let imported = 0;
      valid.forEach(s => {
        const k = s.date + '|' + s.sessionType;
        if (!existing.has(k)) { existing.set(k, s); imported++; }
      });

      const merged = [...existing.values()].sort((a, b) => b.date.localeCompare(a.date));
      S.history = merged;
      localStorage.setItem('training_history', JSON.stringify(merged));
      if (S.view === 'history') renderHist();
      render();

      const msg = imported > 0
        ? `Imported ${imported} session${imported !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} invalid entries skipped)` : ''}.`
        : `No new sessions to import${skipped > 0 ? ` (${skipped} invalid entries skipped)` : ''}.`;
      alert(msg);

    } catch {
      alert('Could not read file. Make sure this is a valid training history JSON export.');
    }
  };
  r.readAsText(file);ev.target.value='';
}

function getStorageStats() {
  try {
    let totalBytes = 0;
    for (const key of Object.keys(localStorage)) {
      totalBytes += (localStorage.getItem(key) || '').length * 2; // UTF-16: 2 bytes per char
    }
    const usedKB = (totalBytes / 1024).toFixed(1);
    const usedMB = (totalBytes / (1024 * 1024)).toFixed(2);
    const estimatedQuotaKB = 5120; // conservative 5 MB estimate
    const pct = Math.min(100, Math.round(totalBytes / (estimatedQuotaKB * 1024) * 100));
    return { usedKB, usedMB, pct };
  } catch {
    return { usedKB: '?', usedMB: '?', pct: 0 };
  }
}

function fmtPace(paceDecimal){
  const paceMin=Math.floor(paceDecimal);
  const paceSec=String(Math.round((paceDecimal-paceMin)*60)).padStart(2,'0');
  return paceMin+':'+paceSec+' min/km';
}

function fmtRunDur(totalSecs){
  const h=Math.floor(totalSecs/3600);
  const m=Math.floor((totalSecs%3600)/60);
  const s=totalSecs%60;
  return h>0?h+'h '+String(m).padStart(2,'0')+'m':m+'m '+String(s).padStart(2,'0')+'s';
}

function renderCal(){
  const wrap=document.getElementById('cal-wrap');
  if(!wrap)return;
  const y=CAL.year,m=CAL.month;
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const today=new Date().toISOString().split('T')[0];
  const dateMap={};
  S.history.forEach(entry=>{
    if(!dateMap[entry.date])dateMap[entry.date]=[];
    dateMap[entry.date].push(entry);
  });
  const firstDow=(new Date(y,m,1).getDay()+6)%7;
  const daysInMonth=new Date(y,m+1,0).getDate();
  const prevMonthDays=new Date(y,m,0).getDate();
  const totalCells=Math.ceil((firstDow+daysInMonth)/7)*7;
  let cells='';
  for(let i=0;i<totalCells;i++){
    const offset=i-firstDow;
    let num,inMonth,dateStr='',isToday=false;
    if(offset<0){num=prevMonthDays+offset+1;inMonth=false;}
    else if(offset>=daysInMonth){num=offset-daysInMonth+1;inMonth=false;}
    else{
      num=offset+1;inMonth=true;
      dateStr=y+'-'+String(m+1).padStart(2,'0')+'-'+String(num).padStart(2,'0');
      isToday=dateStr===today;
    }
    let dotsHtml='';
    if(inMonth){
      const sessions=dateMap[dateStr]||[];
      if(sessions.length){
        dotsHtml='<div class="cal-dots">';
        sessions.forEach(s=>{
          if(s.sessionType==='run'){
            dotsHtml+=`<span class="cal-dot-wrap"><span class="cal-dot" style="background:#22C55E"></span><span class="cal-km">${s.distanceKm}k</span></span>`;
          }else{
            const pct=s.totalSets>0?Math.round(s.totalSetsCompleted/s.totalSets*100):0;
            const col=pct===100?'#22C55E':pct>=50?'#F59E0B':'#EF4444';
            dotsHtml+=`<span class="cal-dot" style="background:${col}"></span>`;
          }
        });
        dotsHtml+='</div>';
      }
    }
    cells+=`<div class="cal-cell${!inMonth?' cal-outside':''}${isToday?' cal-today':''}"><span class="cal-day-num">${num}</span>${dotsHtml}</div>`;
  }
  wrap.innerHTML=`<div class="cal-container"><div class="cal-nav"><button class="cal-nav-btn" onclick="calPrev()">&#8592;</button><span class="cal-heading">${MONTHS[m]} ${y}</span><button class="cal-nav-btn" onclick="calNext()">&#8594;</button></div><div class="cal-grid"><div class="cal-dow">Mon</div><div class="cal-dow">Tue</div><div class="cal-dow">Wed</div><div class="cal-dow">Thu</div><div class="cal-dow">Fri</div><div class="cal-dow">Sat</div><div class="cal-dow">Sun</div>${cells}</div></div>`;
}

function calPrev(){CAL.month--;if(CAL.month<0){CAL.month=11;CAL.year--;}renderCal();}
function calNext(){CAL.month++;if(CAL.month>11){CAL.month=0;CAL.year++;}renderCal();}

function renderHist(){
  renderCal();
  const el=document.getElementById('hist-list');
  const sorted=[...S.history].sort((a,b)=>b.date.localeCompare(a.date));
  if(!sorted.length){
    el.innerHTML='<div class="empty"><i class="ti ti-calendar" aria-hidden="true"></i><div class="empty-title">No history yet</div><div class="empty-sub">Save a session or import a previous JSON file</div></div>';
    return;
  }
  el.innerHTML=sorted.map(s=>{
    if(s.sessionType==='run'){
      const dur=s.durationSeconds?fmtRunDur(s.durationSeconds):'—';
      const pace=s.paceMinPerKm?fmtPace(s.paceMinPerKm):'—';
      const noteHtml=s.notes?`<div class="hist-notes"><div class="hist-note">${s.notes}</div></div>`:'';
      return `<div class="hist-card">
        <div class="hist-card-top">
          <div>
            <div class="hist-label">${s.sessionLabel}</div>
            <div class="hist-meta">${s.date} · ${dur} · ${pace}</div>
          </div>
          <span class="badge bg-g">Complete</span>
        </div>
        ${noteHtml}
      </div>`;
    }
    const pct=s.totalSets>0?Math.round(s.totalSetsCompleted/s.totalSets*100):0;
    const dur=s.durationSeconds?Math.floor(s.durationSeconds/60)+'m '+s.durationSeconds%60+'s':'—';
    const notes=(s.exercises||[]).filter(e=>e.notes).map(e=>`<div class="hist-note"><b>${e.name}:</b> ${e.notes}</div>`).join('');
    return `<div class="hist-card">
      <div class="hist-card-top">
        <div>
          <div class="hist-label">${s.sessionLabel}</div>
          <div class="hist-meta">${s.date} · ${dur} · ${s.totalSetsCompleted}/${s.totalSets} sets</div>
        </div>
        <span class="badge ${s.completed?'bg-g':'bg-a'}">${s.completed?'Complete':pct+'%'}</span>
      </div>
      <div class="hist-bar">
        <div class="hist-bar-fill" style="background:${s.completed?'#22C55E':'#F59E0B'};width:${pct}%;"></div>
      </div>
      ${notes?`<div class="hist-notes">${notes}</div>`:''}
    </div>`;
  }).join('');
}

window.switchSession = switchSession;
window.setTab = setTab;
window.openRunSheet = openRunSheet;
window.closeRunSheet = closeRunSheet;
window.openSettingsSheet = openSettingsSheet;
window.closeSettingsSheet = closeSettingsSheet;
window.forceUpdate = forceUpdate;
window.updatePace = updatePace;
window.saveRun = saveRun;
window.toggleTimer = toggleTimer;
window.toggleSet = toggleSet;
window.toggleExp = toggleExp;
window.saveSession = saveSession;
window.exportJSON = exportJSON;
window.dismissCompletion = dismissCompletion;
window.stopRest = stopRest;
window.calPrev = calPrev;
window.calNext = calNext;
window.loadHistory = loadHistory;
window.setNote = setNote;
})();
