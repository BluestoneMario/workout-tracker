export const ACCENT = { A: '#5a8cd6', B: '#d49355' };

export const S = {
  sess: 'A',
  view: 'workout',
  sets: {},
  notes: {},
  exp: {},
  wStart: null,
  elapsed: 0,
  restSecs: 0,
  restDuration: 90,
  restEndAt: 0,
  history: [],
  timerState: 'idle',
  accumulatedMs: 0,
};

export const CAL = { year: new Date().getFullYear(), month: new Date().getMonth() };

let _DATA = null;
export function setData(d) { _DATA = d; }
export function getData() { return _DATA; }

export function allExs(k) { return _DATA[k].blocks.flatMap(b => b.exs); }

export function setNote(id, v) { S.notes[id] = v; }

export function loadHistoryFromStorage() {
  try {
    const stored = localStorage.getItem('training_history');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) S.history = parsed;
    }
  } catch (e) {
    S.history = [];
  }
}

export function saveHistoryToStorage() {
  localStorage.setItem('training_history', JSON.stringify(S.history));
}
