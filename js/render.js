import { S, CAL, getData, allExs, countDoneSets, kgToDisplayValue, getDefaultUnit, parseTargetReps } from './state.js';

function findLastEntry(exId) {
  for (const sess of S.history) {
    const entry = (sess.exercises || []).find(e => e.id === exId);
    if (entry) return { ...entry, date: sess.date };
  }
  return null;
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.getDate() + ' ' + d.toLocaleDateString('en-GB', { month: 'short' });
}

export function fmtPace(paceDecimal) {
  const paceMin = Math.floor(paceDecimal);
  const paceSec = String(Math.round((paceDecimal - paceMin) * 60)).padStart(2, '0');
  return paceMin + ':' + paceSec + ' min/km';
}

export function fmtRunDur(totalSecs) {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return h > 0 ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + 'm ' + String(s).padStart(2, '0') + 's';
}

export function render() {
  const DATA = getData();
  const d = DATA[S.sess];
  const el = document.getElementById('ex-list');
  el.innerHTML = '';
  d.blocks.forEach(blk => {
    const div = document.createElement('div');
    div.className = 'blk-div';
    div.innerHTML = `<div class="blk-div-line"></div><span class="blk-div-lbl">${blk.lbl}</span><div class="blk-div-line"></div>`;
    el.appendChild(div);
    blk.exs.forEach(ex => {
      const arr = S.sets[ex.id] || Array(ex.sets).fill(null);
      const done = countDoneSets(arr);
      const allDone = done === ex.sets;
      const inProg = done > 0 && !allDone;
      const card = document.createElement('div');
      card.className = 'ex-card' + (allDone ? ' done' : inProg ? ' prog' : '');

      const lastEntry = findLastEntry(ex.id);
      let lastTimeHtml = '';
      if (lastEntry) {
        const dateStr = formatDate(lastEntry.date);
        const rawNote = lastEntry.notes || '';
        const note = rawNote.length > 60 ? rawNote.slice(0, 60) + '…' : rawNote;
        lastTimeHtml = `<div class="last-time"><span class="last-time-date">${dateStr}</span><span class="last-time-sets">${lastEntry.setsCompleted}/${lastEntry.totalSets} sets</span>${note ? `<span class="last-time-note">${note}</span>` : ''}</div>`;
      }

      const hdr = document.createElement('div');
      hdr.className = 'card-hdr';
      hdr.onclick = () => toggleExp(ex.id);
      const unit = getDefaultUnit();
      const bubblesHtml = arr.map((_, i) => {
        const cur = arr[i];
        const isDone = !!(cur && cur.done);
        const repLbl = (isDone && cur.reps != null)
          ? `<span class="bubble-reps">×${cur.reps}</span>`
          : '';
        return `<div class="bubble-wrap"><button class="bubble${isDone ? ' on' : ''}" onclick="event.stopPropagation();toggleSet('${ex.id}',${i})" aria-label="Set ${i + 1}">${isDone ? '<i class="ti ti-check" aria-hidden="true"></i>' : (i + 1)}</button>${repLbl}</div>`;
      }).join('');
      const weightInputHtml = ex.weighted ? (() => {
        const kg = S.cardWeights[ex.id];
        const val = kg != null ? kgToDisplayValue(kg, unit) : '';
        return `<div class="ex-weight-row" onclick="event.stopPropagation()">
          <label class="ex-weight-lbl" for="ex-weight-${ex.id}">Weight</label>
          <div class="ex-weight-grp">
            <input id="ex-weight-${ex.id}" class="ex-weight-input" type="number" step="0.5" min="0" inputmode="decimal" placeholder="${unit}" value="${val}" onchange="onCardWeightChange('${ex.id}', this.value)">
            <span class="ex-weight-unit">${unit}</span>
          </div>
        </div>`;
      })() : '';
      hdr.innerHTML = `
        <div class="card-hdr-top">
          <div class="ex-title-wrap">
            <div class="ex-title-row">
              <span class="ex-name">${ex.name}</span>
              <span class="reps-badge">${ex.reps}</span>
              ${allDone ? '<i class="ti ti-circle-check-filled ex-done-icon" aria-hidden="true"></i>' : ''}
            </div>
            <div class="ex-muscles">${ex.muscles}</div>
          </div>
          <i class="ti ti-chevron-${S.exp[ex.id] ? 'up' : 'down'} ex-chev" aria-hidden="true"></i>
        </div>
        ${lastTimeHtml}
        ${weightInputHtml}
        <div class="set-row">
          ${bubblesHtml}
          <span class="set-count">${done}/${ex.sets}</span>
        </div>`;
      card.appendChild(hdr);

      if (S.repsPrompt && S.repsPrompt.exId === ex.id) {
        const setIdx = S.repsPrompt.setIdx;
        const prefill = S.repsPrompt.prefill;
        const valAttr = prefill != null ? `value="${prefill}"` : '';
        const rRow = document.createElement('form');
        rRow.className = 'reps-input-row';
        rRow.onclick = (e) => e.stopPropagation();
        rRow.onsubmit = (e) => { e.preventDefault(); confirmReps(); };
        rRow.innerHTML = `
          <label class="reps-input-lbl" for="reps-input-active">Set ${setIdx + 1} · Reps</label>
          <input id="reps-input-active" class="reps-input" type="number" min="0" inputmode="numeric" enterkeyhint="done" ${valAttr} placeholder="${prefill ?? ''}">
          <div class="reps-input-actions">
            <button type="button" class="reps-skip-btn" onclick="skipReps()" aria-label="Skip"><i class="ti ti-x" aria-hidden="true"></i></button>
            <button type="submit" class="reps-done-btn" aria-label="Confirm"><i class="ti ti-check" aria-hidden="true"></i></button>
          </div>`;
        card.appendChild(rRow);
      }
      if (S.exp[ex.id]) {
        const body = document.createElement('div');
        body.className = 'card-body';
        body.innerHTML = `
          ${ex.warn ? `<div class="warn-pill"><i class="ti ti-alert-triangle" aria-hidden="true"></i>${ex.warn}</div>` : ''}
          <div class="tip-box">${ex.tip}</div>
          <a class="ill-link" href="${ex.url}" target="_blank" rel="noopener"><i class="ti ti-external-link" aria-hidden="true"></i><span>Illustration &amp; instructions</span></a>
          <textarea class="ex-textarea" rows="2" placeholder="Notes — variation used, how it felt, any weight..." oninput="setNote('${ex.id}',this.value)">${S.notes[ex.id] || ''}</textarea>`;
        card.appendChild(body);
      }
      el.appendChild(card);
    });
  });

  renderEditPopover();

  if (S.repsPrompt) {
    requestAnimationFrame(() => {
      const inp = document.getElementById('reps-input-active');
      if (inp) { inp.focus(); inp.select(); }
    });
  }
}

function renderEditPopover() {
  const back = document.getElementById('edit-backdrop');
  const pop = document.getElementById('edit-popover');
  if (!back || !pop) return;
  if (!S.editPopover) {
    back.classList.remove('open');
    pop.classList.remove('open');
    pop.innerHTML = '';
    return;
  }
  const { exId, setIdx } = S.editPopover;
  const ex = allExs(S.sess).find(e => e.id === exId);
  const arr = S.sets[exId] || [];
  const cur = arr[setIdx] || {};
  const unit = getDefaultUnit();
  const repsVal = cur.reps != null ? cur.reps : (parseTargetReps(ex && ex.reps) ?? '');
  const weightVal = (ex && ex.weighted && cur.weight != null) ? kgToDisplayValue(cur.weight, unit) : '';
  const weightFieldHtml = (ex && ex.weighted) ? `
    <div class="edit-field">
      <label class="edit-field-lbl" for="edit-weight-input">Weight</label>
      <div class="edit-input-grp">
        <input id="edit-weight-input" class="edit-input" type="number" step="0.5" min="0" inputmode="decimal" placeholder="${unit}" value="${weightVal}">
        <span class="edit-input-unit">${unit}</span>
      </div>
    </div>` : '';
  pop.innerHTML = `
    <div class="sheet-handle-wrap"><div class="sheet-handle"></div></div>
    <div class="sheet-title">Edit set ${setIdx + 1} · ${ex ? ex.name : ''}</div>
    <div class="edit-form">
      <div class="edit-field">
        <label class="edit-field-lbl" for="edit-reps-input">Reps</label>
        <input id="edit-reps-input" class="edit-input" type="number" min="0" inputmode="numeric" placeholder="reps" value="${repsVal}">
      </div>
      ${weightFieldHtml}
      <div class="edit-actions">
        <button type="button" class="edit-unmark-btn" onclick="deleteSetFromEdit()"><i class="ti ti-square" aria-hidden="true"></i><span>Unmark</span></button>
        <button type="button" class="edit-save-btn" onclick="saveEdit()"><i class="ti ti-check" aria-hidden="true"></i><span>Save</span></button>
      </div>
    </div>`;
  back.classList.add('open');
  pop.classList.add('open');
  requestAnimationFrame(() => {
    const inp = document.getElementById('edit-reps-input');
    if (inp) { inp.focus(); inp.select(); }
  });
}

export function toggleExp(id) {
  S.exp[id] = !S.exp[id];
  render();
}

export function updateProg() {
  const exs = allExs(S.sess);
  const tot = exs.reduce((s, e) => s + e.sets, 0);
  const done = exs.reduce((s, e) => s + countDoneSets(S.sets[e.id]), 0);
  const pct = tot > 0 ? Math.round(done / tot * 100) : 0;
  document.getElementById('prog-sets').textContent = done + ' / ' + tot;
  document.getElementById('prog-pct').textContent = pct + '%';
  document.getElementById('prog-fill').style.width = pct + '%';
  updateMiniBar();
}

export function updateMiniBar() {
  const timerEl = document.getElementById('mini-timer');
  const fillEl = document.getElementById('mini-prog-fill');
  const rightEl = document.getElementById('mini-right');
  if (!timerEl) return;

  const m = String(Math.floor(S.elapsed / 60)).padStart(2, '0');
  const s = String(S.elapsed % 60).padStart(2, '0');
  timerEl.textContent = S.timerState === 'idle' ? '--:--' : m + ':' + s;

  const exs = allExs(S.sess);
  const tot = exs.reduce((sum, e) => sum + e.sets, 0);
  const done = exs.reduce((sum, e) => sum + countDoneSets(S.sets[e.id]), 0);
  const pct = tot > 0 ? Math.round(done / tot * 100) : 0;
  fillEl.style.width = pct + '%';

  if (S.restSecs > 0) {
    rightEl.textContent = 'Rest ' + S.restSecs + 's';
    rightEl.classList.add('mini-resting');
  } else {
    rightEl.textContent = done + '/' + tot;
    rightEl.classList.remove('mini-resting');
  }
}

export function renderCal() {
  const wrap = document.getElementById('cal-wrap');
  if (!wrap) return;
  const y = CAL.year, m = CAL.month;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const today = new Date().toISOString().split('T')[0];
  const dateMap = {};
  S.history.forEach(entry => {
    if (!dateMap[entry.date]) dateMap[entry.date] = [];
    dateMap[entry.date].push(entry);
  });
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevMonthDays = new Date(y, m, 0).getDate();
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  let cells = '';
  for (let i = 0; i < totalCells; i++) {
    const offset = i - firstDow;
    let num, inMonth, dateStr = '', isToday = false;
    if (offset < 0) { num = prevMonthDays + offset + 1; inMonth = false; }
    else if (offset >= daysInMonth) { num = offset - daysInMonth + 1; inMonth = false; }
    else {
      num = offset + 1; inMonth = true;
      dateStr = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(num).padStart(2, '0');
      isToday = dateStr === today;
    }
    let dotsHtml = '';
    if (inMonth) {
      const sessions = dateMap[dateStr] || [];
      if (sessions.length) {
        dotsHtml = '<div class="cal-dots">';
        sessions.forEach(s => {
          if (s.sessionType === 'run') {
            dotsHtml += `<span class="cal-dot-wrap"><span class="cal-dot" style="background:#22C55E"></span><span class="cal-km">${s.distanceKm}k</span></span>`;
          } else {
            const pct = s.totalSets > 0 ? Math.round(s.totalSetsCompleted / s.totalSets * 100) : 0;
            const col = pct === 100 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';
            dotsHtml += `<span class="cal-dot" style="background:${col}"></span>`;
          }
        });
        dotsHtml += '</div>';
      }
    }
    cells += `<div class="cal-cell${!inMonth ? ' cal-outside' : ''}${isToday ? ' cal-today' : ''}"><span class="cal-day-num">${num}</span>${dotsHtml}</div>`;
  }
  wrap.innerHTML = `<div class="cal-container"><div class="cal-nav"><button class="cal-nav-btn" onclick="calPrev()">&#8592;</button><span class="cal-heading">${MONTHS[m]} ${y}</span><button class="cal-nav-btn" onclick="calNext()">&#8594;</button></div><div class="cal-grid"><div class="cal-dow">Mon</div><div class="cal-dow">Tue</div><div class="cal-dow">Wed</div><div class="cal-dow">Thu</div><div class="cal-dow">Fri</div><div class="cal-dow">Sat</div><div class="cal-dow">Sun</div>${cells}</div></div>`;
}

export function renderHist() {
  renderCal();
  const el = document.getElementById('hist-list');
  const sorted = [...S.history].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    el.innerHTML = '<div class="empty"><i class="ti ti-calendar" aria-hidden="true"></i><div class="empty-title">No history yet</div><div class="empty-sub">Save a session or import a previous JSON file</div></div>';
    return;
  }
  el.innerHTML = sorted.map(s => {
    if (s.sessionType === 'run') {
      const dur = s.durationSeconds ? fmtRunDur(s.durationSeconds) : '—';
      const pace = s.paceMinPerKm ? fmtPace(s.paceMinPerKm) : '—';
      const noteHtml = s.notes ? `<div class="hist-notes"><div class="hist-note">${s.notes}</div></div>` : '';
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
    const pct = s.totalSets > 0 ? Math.round(s.totalSetsCompleted / s.totalSets * 100) : 0;
    const dur = s.durationSeconds ? Math.floor(s.durationSeconds / 60) + 'm ' + s.durationSeconds % 60 + 's' : '—';
    const unit = getDefaultUnit();
    const lines = (s.exercises || []).flatMap(e => {
      const out = [];
      const doneSets = Array.isArray(e.sets) ? e.sets.filter(x => x && x.done) : [];
      const hasReps = doneSets.some(x => x.reps != null);
      const hasWeight = doneSets.some(x => x.weight != null);
      if (doneSets.length > 0 && (hasReps || hasWeight)) {
        const doneCount = doneSets.length;
        const repsList = doneSets.map(x => x.reps != null ? '×' + x.reps : '×?').join(', ');
        let weightSuffix = '';
        if (hasWeight) {
          const weights = doneSets.map(x => x.weight != null ? x.weight : null);
          const uniq = [...new Set(weights.filter(w => w != null))];
          if (uniq.length === 1) {
            weightSuffix = ' @ ' + kgToDisplayValue(uniq[0], unit) + ' ' + unit;
          } else {
            const perSet = weights.map(w => w != null ? kgToDisplayValue(w, unit) : '—').join(' / ');
            weightSuffix = ' @ ' + perSet + ' ' + unit;
          }
        }
        const repsPart = hasReps ? ' — ' + repsList : '';
        out.push(`<div class="hist-note"><b>${e.name}:</b> ${doneCount} set${doneCount !== 1 ? 's' : ''}${repsPart}${weightSuffix}</div>`);
      }
      if (e.notes) {
        out.push(`<div class="hist-note"><b>${e.name}:</b> ${e.notes}</div>`);
      }
      return out;
    }).join('');
    return `<div class="hist-card">
      <div class="hist-card-top">
        <div>
          <div class="hist-label">${s.sessionLabel}</div>
          <div class="hist-meta">${s.date} · ${dur} · ${s.totalSetsCompleted}/${s.totalSets} sets</div>
        </div>
        <span class="badge ${s.completed ? 'bg-g' : 'bg-a'}">${s.completed ? 'Complete' : pct + '%'}</span>
      </div>
      <div class="hist-bar">
        <div class="hist-bar-fill" style="background:${s.completed ? '#22C55E' : '#F59E0B'};width:${pct}%;"></div>
      </div>
      ${lines ? `<div class="hist-notes">${lines}</div>` : ''}
    </div>`;
  }).join('');
}

export function showCompletion(sess) {
  const m = String(Math.floor(sess.durationSeconds / 60)).padStart(2, '0');
  const s = String(sess.durationSeconds % 60).padStart(2, '0');
  const pct = sess.totalSets > 0 ? Math.round(sess.totalSetsCompleted / sess.totalSets * 100) : 0;
  const overlay = document.getElementById('completion-overlay');
  overlay.innerHTML = `
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
          <span class="badge ${sess.completed ? 'bg-g' : 'bg-a'}">${sess.completed ? 'Complete' : pct + '%'}</span>
        </div>
      </div>
      <div class="compl-actions">
        <button onclick="dismissCompletion()" class="btn-primary"><i class="ti ti-check" aria-hidden="true"></i><span>Done</span></button>
        <button onclick="exportJSON()" class="btn-secondary"><i class="ti ti-download" aria-hidden="true"></i><span>Export JSON</span></button>
      </div>
    </div>`;
  overlay.style.display = 'flex';
}

export function setTab(t) {
  S.view = t;
  document.getElementById('tab-workout').style.display = t === 'workout' ? '' : 'none';
  document.getElementById('tab-history').style.display = t === 'history' ? '' : 'none';
  document.getElementById('nav-workout').classList.toggle('top-tab-active', t === 'workout');
  document.getElementById('nav-history').classList.toggle('top-tab-active', t === 'history');
  if (t === 'history') {
    document.getElementById('mini-bar').classList.remove('mini-bar--visible');
    renderHist();
  }
}
