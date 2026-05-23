import { S, CAL, kgToDisplayValue, getDefaultUnit, deleteSessionRecord } from './state.js';
import { putSession, normalizeSet } from './db.js';
import { render, renderHist, renderCal, formatDate } from './render.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExHistoryRow(sess, exId, unit) {
  const ex = (sess.exercises || []).find(e => e.id === exId);
  if (!ex) return null;
  const doneSets = Array.isArray(ex.sets) ? ex.sets.filter(s => s && s.done) : [];
  if (doneSets.length === 0) return null;
  const repsVals = doneSets.map(s => s.reps).filter(r => r != null);
  const hasReps = repsVals.length > 0;
  const weights = doneSets.map(s => s.weight != null ? s.weight : null);
  const hasWeight = weights.some(w => w != null);
  let summary;
  if (!hasReps) {
    summary = doneSets.length + ' set' + (doneSets.length !== 1 ? 's' : '');
  } else {
    const repsList = repsVals.map(r => '×' + r).join(', ');
    if (hasWeight) {
      const uniq = [...new Set(weights.filter(w => w != null))];
      const weightStr = uniq.length === 1
        ? kgToDisplayValue(uniq[0], unit) + ' ' + unit
        : weights.map(w => w != null ? kgToDisplayValue(w, unit) : '—').join(' / ') + ' ' + unit;
      summary = repsList + ' @ ' + weightStr;
    } else {
      summary = repsList;
    }
  }
  const rawNote = ex.notes || '';
  const note = rawNote.length > 60 ? rawNote.slice(0, 60) + '…' : rawNote;
  const noteHtml = note ? `<div class="ex-hist-note">${escapeHtml(note)}</div>` : '';
  return `<div class="ex-hist-row">
    <div class="ex-hist-row-top">
      <span class="ex-hist-date">${formatDate(sess.date)}</span>
      <span class="ex-hist-summary">${escapeHtml(summary)}</span>
    </div>
    ${noteHtml}
  </div>`;
}

export function openExHistory(exId, exName) {
  const unit = getDefaultUnit();
  const entries = S.history
    .filter(s => s.sessionType !== 'run' && Array.isArray(s.exercises)
      && s.exercises.some(e => e && e.id === exId && Array.isArray(e.sets) && e.sets.some(x => x && x.done)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 20);
  const titleEl = document.getElementById('ex-hist-title');
  const contentEl = document.getElementById('ex-hist-content');
  if (titleEl) titleEl.textContent = exName || 'Exercise history';
  if (contentEl) {
    if (entries.length === 0) {
      contentEl.innerHTML = '<div class="ex-hist-empty">No history yet for this exercise</div>';
    } else {
      contentEl.innerHTML = entries
        .map(s => formatExHistoryRow(s, exId, unit))
        .filter(Boolean)
        .join('');
    }
  }
  document.getElementById('ex-hist-backdrop').classList.add('open');
  document.getElementById('ex-hist-sheet').classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeExHistory() {
  document.getElementById('ex-hist-backdrop').classList.remove('open');
  document.getElementById('ex-hist-sheet').classList.remove('open');
  document.body.style.overflow = '';
}

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

function showToast(message, isError = false) {
  const existing = document.getElementById('app-toast-history');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'app-toast-history';
  t.setAttribute('role', isError ? 'alert' : 'status');
  t.textContent = message;
  Object.assign(t.style, {
    position: 'fixed',
    left: '12px',
    right: '12px',
    bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
    zIndex: '9000',
    padding: '12px 14px',
    background: isError ? '#3b1e1e' : 'var(--color-background-secondary, #1f1f24)',
    border: '1px solid ' + (isError ? '#ef4444' : 'var(--color-border-tertiary, #222227)'),
    color: isError ? '#fef2f2' : 'var(--color-text-primary, #f1f1f3)',
    borderRadius: '12px',
    fontFamily: 'var(--mono, monospace)',
    fontSize: '13px',
    fontWeight: '500',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    maxWidth: '480px',
    margin: '0 auto',
    transition: 'opacity 0.3s',
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; }, 3700);
  setTimeout(() => { t.remove(); }, 4000);
}

export function loadHistory(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async e => {
    try {
      const d = JSON.parse(e.target.result);

      if (!d || !Array.isArray(d.sessions)) {
        showToast('Invalid file: expected a training history export with a "sessions" array.', true);
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
        showToast('No valid sessions found in this file. The file may be empty or incorrectly formatted.', true);
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
      showToast(msg, false);

    } catch {
      showToast('Could not read file. Make sure this is a valid training history JSON export.', true);
    }
  };
  r.readAsText(file);
  ev.target.value = '';
}

export async function deleteHistorySession(id) {
  if (!confirm("Delete this session? This can't be undone.")) return;
  await deleteSessionRecord(id);
  const idx = S.history.findIndex(s => s.id === id);
  if (idx !== -1) S.history.splice(idx, 1);
  renderHist();
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
