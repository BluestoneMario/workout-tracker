import { S, CAL } from './state.js';
import { putSession, normalizeSet } from './db.js';
import { render, renderHist, renderCal } from './render.js';

export function exportJSON() {
  const blob = new Blob([JSON.stringify({ version: 1, sessions: S.history }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'training_history_' + new Date().toISOString().split('T')[0] + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function normalizeImported(s, fallbackIndex) {
  const out = { ...s };
  if (!out.id) {
    const base = out.date ? new Date(out.date + 'T12:00:00Z').getTime() : Date.now();
    out.id = String((Number.isFinite(base) ? base : Date.now()) + fallbackIndex);
  } else {
    out.id = String(out.id);
  }
  if (out.sessionType !== 'run' && Array.isArray(out.exercises)) {
    out.exercises = out.exercises.map(ex => {
      if (!ex || typeof ex !== 'object') return ex;
      if (Array.isArray(ex.sets)) {
        return { ...ex, sets: ex.sets.map(x => normalizeSet(x, 'kg')) };
      }
      return ex;
    });
  }
  return out;
}

export function loadHistory(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async e => {
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
      for (let i = 0; i < valid.length; i++) {
        const s = valid[i];
        const k = s.date + '|' + s.sessionType;
        if (!existing.has(k)) {
          const norm = normalizeImported(s, i);
          await putSession(norm);
          existing.set(k, norm);
          imported++;
        }
      }

      const merged = [...existing.values()].sort((a, b) => b.date.localeCompare(a.date));
      S.history = merged;
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
  r.readAsText(file);
  ev.target.value = '';
}

export function calPrev() {
  CAL.month--;
  if (CAL.month < 0) { CAL.month = 11; CAL.year--; }
  renderCal();
}

export function calNext() {
  CAL.month++;
  if (CAL.month > 11) { CAL.month = 0; CAL.year++; }
  renderCal();
}
