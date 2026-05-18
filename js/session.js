import { S, ACCENT, allExs, getData, saveSessionRecord, getDefaultUnit, inputValueToKg, parseTargetReps, setCardWeight } from './state.js';
import { startEl, startRest, resetTimer, updateTimerBtn } from './timer.js';
import { render, updateProg, updateMiniBar, showCompletion } from './render.js';

export function switchSession(k) {
  if (k === S.sess) return;
  if (S.wStart && !confirm('Switch session? Current progress will be cleared.')) return;
  S.sess = k;
  S.sets = {};
  S.notes = {};
  S.exp = {};
  S.repsPrompt = null;
  S.editPopover = null;
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

function commitPendingReps() {
  if (!S.repsPrompt) return;
  const { exId, setIdx, prefill } = S.repsPrompt;
  const entered = readRepsInput('reps-input-active');
  const reps = entered != null ? entered : prefill;
  applyRepsToSet(exId, setIdx, reps);
  S.repsPrompt = null;
}

export function toggleSet(id, i) {
  const ex = allExs(S.sess).find(e => e.id === id);
  const arr = S.sets[id] || Array(ex.sets).fill(null);
  const cur = arr[i];
  const wasDone = !!(cur && cur.done);
  commitPendingReps();
  if (wasDone) {
    S.editPopover = { exId: id, setIdx: i };
    render();
    return;
  }
  const unit = getDefaultUnit();
  const weight = ex.weighted ? (S.cardWeights[id] ?? null) : null;
  const upd = [...arr];
  upd[i] = {
    done: true,
    reps: null,
    weight,
    weightUnit: unit,
  };
  S.sets[id] = upd;
  if (S.timerState === 'idle') startEl();
  const restDur = ex.rest === 0 ? 0 : (ex.rest != null ? ex.rest : 90);
  if (restDur > 0) startRest(restDur);
  S.repsPrompt = { exId: id, setIdx: i, prefill: parseTargetReps(ex.reps) };
  S.editPopover = null;
  render();
  updateProg();
}

function readRepsInput(elId) {
  const input = document.getElementById(elId);
  if (!input) return null;
  const v = parseInt(input.value, 10);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function applyRepsToSet(exId, setIdx, reps) {
  const arr = S.sets[exId];
  if (!Array.isArray(arr) || !arr[setIdx]) return;
  const next = [...arr];
  next[setIdx] = { ...arr[setIdx], reps };
  S.sets[exId] = next;
}

export function confirmReps() {
  if (!S.repsPrompt) return;
  const { exId, setIdx, prefill } = S.repsPrompt;
  const entered = readRepsInput('reps-input-active');
  const reps = entered != null ? entered : prefill;
  applyRepsToSet(exId, setIdx, reps);
  S.repsPrompt = null;
  render();
}

export function skipReps() {
  if (!S.repsPrompt) return;
  const { exId, setIdx, prefill } = S.repsPrompt;
  applyRepsToSet(exId, setIdx, prefill);
  S.repsPrompt = null;
  render();
}

export async function onCardWeightChange(exId, rawValue) {
  const kg = inputValueToKg(rawValue, getDefaultUnit());
  await setCardWeight(exId, kg);
}

export function openEdit(exId, setIdx) {
  S.editPopover = { exId, setIdx };
  S.repsPrompt = null;
  render();
}

export function closeEdit() {
  S.editPopover = null;
  render();
}

export function saveEdit() {
  if (!S.editPopover) return;
  const { exId, setIdx } = S.editPopover;
  const arr = S.sets[exId];
  if (!Array.isArray(arr) || !arr[setIdx]) {
    S.editPopover = null;
    render();
    return;
  }
  const ex = allExs(S.sess).find(e => e.id === exId);
  const repsRaw = readRepsInput('edit-reps-input');
  const reps = repsRaw != null ? repsRaw : (arr[setIdx].reps ?? parseTargetReps(ex.reps));
  let weight = arr[setIdx].weight;
  let weightUnit = arr[setIdx].weightUnit || getDefaultUnit();
  if (ex.weighted) {
    const wInput = document.getElementById('edit-weight-input');
    if (wInput) {
      const kg = inputValueToKg(wInput.value, getDefaultUnit());
      weight = kg;
      weightUnit = getDefaultUnit();
    }
  }
  const next = [...arr];
  next[setIdx] = { ...arr[setIdx], reps, weight, weightUnit };
  S.sets[exId] = next;
  S.editPopover = null;
  render();
}

export function deleteSetFromEdit() {
  if (!S.editPopover) return;
  const { exId, setIdx } = S.editPopover;
  const arr = S.sets[exId];
  if (Array.isArray(arr) && arr[setIdx]) {
    const next = [...arr];
    next[setIdx] = { done: false, reps: null, weight: null, weightUnit: getDefaultUnit() };
    S.sets[exId] = next;
  }
  S.editPopover = null;
  render();
  updateProg();
}

export async function saveSession() {
  const exs = allExs(S.sess);
  const d = getData()[S.sess];
  const exercises = exs.map(e => {
    const arr = S.sets[e.id] || [];
    const sets = Array.from({ length: e.sets }, (_, i) => {
      const cur = arr[i];
      if (!cur) return { done: false, reps: null, weight: null, weightUnit: getDefaultUnit() };
      return {
        done: !!cur.done,
        reps: cur.reps ?? null,
        weight: cur.weight ?? null,
        weightUnit: cur.weightUnit || getDefaultUnit(),
      };
    });
    return {
      id: e.id,
      name: e.name,
      weighted: !!e.weighted,
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
  S.repsPrompt = null;
  S.editPopover = null;
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
