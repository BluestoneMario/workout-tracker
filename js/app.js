import { S, setData, setNote, loadHistoryFromDB, loadDefaultUnit, setDefaultUnit, getDefaultUnit } from './state.js';
import { openDB, migrateFromLocalStorage } from './db.js';
import { toggleTimer, stopRest, updateTimerBtn } from './timer.js';
import { render, updateProg, updateMiniBar, toggleExp, setTab, renderHist } from './render.js';
import {
  switchSession, toggleSet, saveSession, saveRun,
  dismissCompletion, updatePace, openRunSheet, closeRunSheet,
  confirmWeight, skipWeight,
} from './session.js';
import { exportJSON, loadHistory, calPrev, calNext } from './history.js';
import { initAudio, loadMuteState, toggleMute, isMuted } from './audio.js';

let miniBarCooldown = false;

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
  updateUnitToggleUI();
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
window.confirmWeight = confirmWeight;
window.skipWeight = skipWeight;

function updateUnitToggleUI() {
  const u = getDefaultUnit();
  const kgBtn = document.getElementById('unit-btn-kg');
  const lbBtn = document.getElementById('unit-btn-lb');
  if (kgBtn) kgBtn.classList.toggle('unit-toggle-btn--on', u === 'kg');
  if (lbBtn) lbBtn.classList.toggle('unit-toggle-btn--on', u === 'lb');
}

async function setDisplayUnit(u) {
  await setDefaultUnit(u);
  updateUnitToggleUI();
  render();
  if (S.view === 'history') renderHist();
}

window.setDisplayUnit = setDisplayUnit;

function updateMuteBtn() {
  const btn = document.getElementById('mute-btn');
  if (!btn) return;
  btn.innerHTML = isMuted() ? '&#x1F507;' : '&#x1F50A;';
  btn.setAttribute('aria-label', isMuted() ? 'Unmute sound' : 'Mute sound');
  btn.setAttribute('aria-pressed', String(isMuted()));
}

function toggleMuteBtn() {
  initAudio();
  toggleMute();
  updateMuteBtn();
}

window.toggleMuteBtn = toggleMuteBtn;

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
  await openDB();
  await migrateFromLocalStorage();
  await loadHistoryFromDB();
  await loadDefaultUnit();
  await loadMuteState();
  updateMuteBtn();
  render();
  updateProg();
  updateTimerBtn();

  const onFirstGesture = () => { initAudio(); };
  document.addEventListener('click', onFirstGesture, { capture: true });
  document.addEventListener('touchstart', onFirstGesture, { capture: true, passive: true });

  document.addEventListener('click', (e) => {
    if (!S.weightPrompt) return;
    if (e.target.closest('.weight-input-row')) return;
    if (e.target.closest('.bubble')) return;
    skipWeight();
  }, true);

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
