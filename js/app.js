import { S, setData, setNote, loadHistoryFromStorage } from './state.js';
import { toggleTimer, stopRest, updateTimerBtn } from './timer.js';
import { render, updateProg, updateMiniBar, toggleExp, setTab } from './render.js';
import {
  switchSession, toggleSet, saveSession, saveRun,
  dismissCompletion, updatePace, openRunSheet, closeRunSheet,
} from './session.js';
import { exportJSON, loadHistory, calPrev, calNext } from './history.js';

let miniBarCooldown = false;

function getStorageStats() {
  try {
    let totalBytes = 0;
    for (const key of Object.keys(localStorage)) {
      totalBytes += (localStorage.getItem(key) || '').length * 2;
    }
    const usedKB = (totalBytes / 1024).toFixed(1);
    const usedMB = (totalBytes / (1024 * 1024)).toFixed(2);
    const estimatedQuotaKB = 5120;
    const pct = Math.min(100, Math.round(totalBytes / (estimatedQuotaKB * 1024) * 100));
    return { usedKB, usedMB, pct };
  } catch {
    return { usedKB: '?', usedMB: '?', pct: 0 };
  }
}

function openSettingsSheet() {
  document.getElementById('settings-backdrop').classList.add('open');
  document.getElementById('settings-sheet').classList.add('open');
  document.body.style.overflow = 'hidden';
  const label = document.getElementById('sw-version-label');
  label.textContent = '—';
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const onMsg = (e) => {
      if (e.data && e.data.type === 'SW_VERSION') {
        label.textContent = e.data.version;
        navigator.serviceWorker.removeEventListener('message', onMsg);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' });
    setTimeout(() => navigator.serviceWorker.removeEventListener('message', onMsg), 1000);
  }
  const stats = getStorageStats();
  const storageEl = document.getElementById('storage-usage');
  if (storageEl) storageEl.textContent = stats.usedKB + ' KB used (~' + stats.pct + '% of 5 MB)';
}

function closeSettingsSheet() {
  document.getElementById('settings-backdrop').classList.remove('open');
  document.getElementById('settings-sheet').classList.remove('open');
  document.body.style.overflow = '';
}

async function forceUpdate() {
  const haveSW = 'serviceWorker' in navigator;
  if (haveSW) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        const onMsg = (e) => {
          if (e.data && e.data.type === 'CACHES_CLEARED') {
            navigator.serviceWorker.removeEventListener('message', onMsg);
            resolve();
          }
        };
        navigator.serviceWorker.addEventListener('message', onMsg);
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHES' });
        setTimeout(resolve, 1500);
      });
    }
    if (reg) await reg.unregister();
  }
  location.reload();
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

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('./routines.json');
    setData(await res.json());
  } catch (err) {
    console.error('[app] Failed to load routines.json:', err);
    document.body.innerHTML = '<div style="color:#f1f1f3;padding:2rem;font-family:sans-serif;">Failed to load workout data. Please reload.</div>';
    return;
  }
  document.getElementById('date-disp').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  document.getElementById('run-date').value = new Date().toISOString().split('T')[0];
  loadHistoryFromStorage();
  render();
  updateProg();
  updateTimerBtn();

  (function positionMiniBar() {
    const nav = document.querySelector('.top-nav');
    const hdr = document.querySelector('.sticky-hdr');
    const offset = (nav ? nav.offsetHeight : 0) + (hdr ? hdr.offsetHeight : 0);
    if (offset > 0) document.getElementById('mini-bar').style.top = offset + 'px';
  })();

  const panelHdr = document.querySelector('.workout-panel-hdr');
  const miniBar = document.getElementById('mini-bar');
  if (panelHdr && miniBar) {
    const updateMiniBarVisibility = () => {
      if (S.view !== 'workout') return;
      if (miniBarCooldown) return;
      const rect = panelHdr.getBoundingClientRect();
      const hdrBottom = document.querySelector('.sticky-hdr')?.offsetHeight || 0;
      const show = rect.bottom <= hdrBottom;
      if (miniBar.classList.contains('mini-bar--visible') === show) return;
      miniBarCooldown = true;
      setTimeout(() => { miniBarCooldown = false; }, 200);
      miniBar.classList.toggle('mini-bar--visible', show);
      miniBar.setAttribute('aria-hidden', String(!show));
      if (show) updateMiniBar();
    };

    const obs = new IntersectionObserver(updateMiniBarVisibility, { threshold: 0 });
    obs.observe(panelHdr);

    window.addEventListener('scroll', updateMiniBarVisibility, { passive: true });
  }
});
