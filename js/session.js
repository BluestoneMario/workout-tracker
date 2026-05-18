import { S, ACCENT, allExs, getData, saveSessionRecord, getDefaultUnit } from './state.js';
import { startEl, startRest, resetTimer, updateTimerBtn } from './timer.js';
import { render, updateProg, updateMiniBar, showCompletion } from './render.js';

export function switchSession(k) {
  if (k === S.sess) return;
  if (S.wStart && !confirm('Switch session? Current progress will be cleared.')) return;
  S.sess = k;
  S.sets = {};
  S.notes = {};
  S.exp = {};
  S.wStart = null;
  S.elapsed = 0;
  S.timerState = 'idle';
  S.accumulatedMs = 0;
  resetTimer();
  document.getElementById('tab-A').className = 'sess-tab' + (k === 'A' ? ' on-a' : '');
  document.getElementById('tab-B').className = 'sess-tab' + (k === 'B' ? ' on-b' : '');
  document.getElementById('wrap').classList.toggle('is-b', k === 'B');
  document.getElementById('prog-fill').style.background = ACCENT[k];
  render();
  updateProg();
  updateTimerBtn();
  updateMiniBar();
}

export function toggleSet(id, i) {
  const ex = allExs(S.sess).find(e => e.id === id);
  const arr = S.sets[id] || Array(ex.sets).fill(null);
  const cur = arr[i];
  const wasDone = !!(cur && cur.done);
  const upd = [...arr];
  upd[i] = cur
    ? { ...cur, done: !wasDone }
    : { done: true, weight: null, unit: getDefaultUnit() };
  S.sets[id] = upd;
  if (!wasDone) {
    if (S.timerState === 'idle') startEl();
    const restDur = ex.rest === 0 ? 0 : (ex.rest != null ? ex.rest : 90);
    if (restDur > 0) startRest(restDur);
  }
  render();
  updateProg();
}

export async function saveSession() {
  const exs = allExs(S.sess);
  const d = getData()[S.sess];
  const unit = getDefaultUnit();
  const exercises = exs.map(e => {
    const arr = S.sets[e.id] || [];
    const sets = Array.from({ length: e.sets }, (_, i) => {
      const cur = arr[i];
      return cur
        ? { done: !!cur.done, weight: cur.weight ?? null, unit: cur.unit || unit }
        : { done: false, weight: null, unit };
    });
    return {
      id: e.id,
      name: e.name,
      setsCompleted: sets.filter(s => s.done).length,
      totalSets: e.sets,
      notes: S.notes[e.id] || '',
      sets,
    };
  });
  const sess = {
    id: String(Date.now()),
    date: new Date().toISOString().split('T')[0],
    sessionType: S.sess,
    sessionLabel: d.name + ' — ' + d.sub,
    durationSeconds: S.elapsed,
    exercises,
    totalSetsCompleted: exercises.reduce((s, e) => s + e.setsCompleted, 0),
    totalSets: exercises.reduce((s, e) => s + e.totalSets, 0),
    completed: exercises.every(e => e.setsCompleted === e.totalSets),
  };
  S.history = [sess, ...S.history];
  await saveSessionRecord(sess);
  S.notes = {};
  showCompletion(sess);
}

export function dismissCompletion() {
  document.getElementById('completion-overlay').style.display = 'none';
  S.sets = {};
  S.notes = {};
  S.exp = {};
  S.wStart = null;
  S.elapsed = 0;
  S.timerState = 'idle';
  S.accumulatedMs = 0;
  resetTimer();
  render();
  updateProg();
  updateTimerBtn();
  updateMiniBar();
}

export function openRunSheet() {
  document.getElementById('run-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('run-backdrop').classList.add('open');
  document.getElementById('run-sheet').classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeRunSheet() {
  document.getElementById('run-backdrop').classList.remove('open');
  document.getElementById('run-sheet').classList.remove('open');
  document.body.style.overflow = '';
}

export function updatePace() {
  const dist = parseFloat(document.getElementById('run-dist').value) || 0;
  const hh = parseInt(document.getElementById('run-hh').value) || 0;
  const mm = parseInt(document.getElementById('run-mm').value) || 0;
  const ss = parseInt(document.getElementById('run-ss').value) || 0;
  const totalSecs = hh * 3600 + mm * 60 + ss;
  const el = document.getElementById('run-pace');
  if (dist > 0 && totalSecs > 0) {
    const paceDecimal = totalSecs / 60 / dist;
    const paceMin = Math.floor(paceDecimal);
    const paceSec = String(Math.round((paceDecimal - paceMin) * 60)).padStart(2, '0');
    el.textContent = paceMin + ':' + paceSec + ' min/km';
  } else {
    el.textContent = '—';
  }
}

export async function saveRun() {
  const dist = parseFloat(document.getElementById('run-dist').value) || 0;
  const hh = parseInt(document.getElementById('run-hh').value) || 0;
  const mm = parseInt(document.getElementById('run-mm').value) || 0;
  const ss = parseInt(document.getElementById('run-ss').value) || 0;
  const totalSecs = hh * 3600 + mm * 60 + ss;
  const date = document.getElementById('run-date').value;
  const errEl = document.getElementById('run-error');
  const confEl = document.getElementById('run-confirm');
  errEl.classList.remove('visible');
  confEl.classList.remove('visible');
  if (!date || dist <= 0 || totalSecs <= 0) { errEl.classList.add('visible'); return; }
  const runType = document.getElementById('run-type').value;
  const paceDecimal = totalSecs / 60 / dist;
  const entry = {
    id: String(Date.now()),
    date: date,
    sessionType: 'run',
    sessionLabel: runType + ' · ' + dist + 'km',
    durationSeconds: totalSecs,
    distanceKm: dist,
    paceMinPerKm: paceDecimal,
    runType: runType,
    notes: document.getElementById('run-notes').value,
    completed: true,
  };
  S.history = [entry, ...S.history];
  await saveSessionRecord(entry);
  document.getElementById('run-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('run-dist').value = '';
  document.getElementById('run-hh').value = '';
  document.getElementById('run-mm').value = '';
  document.getElementById('run-ss').value = '';
  document.getElementById('run-notes').value = '';
  document.getElementById('run-pace').textContent = '—';
  confEl.classList.add('visible');
  setTimeout(() => { confEl.classList.remove('visible'); closeRunSheet(); }, 1000);
}
