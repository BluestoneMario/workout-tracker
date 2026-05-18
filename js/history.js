import { S, CAL, saveHistoryToStorage } from './state.js';
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

export function loadHistory(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = e => {
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
      saveHistoryToStorage();
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
