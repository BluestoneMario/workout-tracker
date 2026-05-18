import { S } from './state.js';
import { updateMiniBar } from './render.js';
import { playRestEndBeep } from './audio.js';

let elInt = null;
let restInt = null;

export function startEl() {
  S.wStart = Date.now();
  S.timerState = 'running';
  const td = document.getElementById('timer-disp');
  td.style.color = 'var(--color-text-primary, #f1f1f3)';
  clearInterval(elInt);
  elInt = setInterval(() => {
    S.elapsed = Math.floor((S.accumulatedMs + Date.now() - S.wStart) / 1000);
    const m = String(Math.floor(S.elapsed / 60)).padStart(2, '0');
    const s = String(S.elapsed % 60).padStart(2, '0');
    td.textContent = m + ':' + s;
    updateMiniBar();
  }, 1000);
  updateTimerBtn();
}

export function pauseEl() {
  S.accumulatedMs += Date.now() - S.wStart;
  S.wStart = null;
  S.timerState = 'paused';
  clearInterval(elInt);
  if (S.restSecs > 0) {
    clearInterval(restInt);
    document.getElementById('rest-row').style.display = 'none';
  }
  updateTimerBtn();
  updateMiniBar();
}

export function toggleTimer() {
  if (S.timerState === 'idle' || S.timerState === 'paused') startEl();
  else pauseEl();
}

export function startRest(duration) {
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
    if (remaining === 0) {
      playRestEndBeep();
      stopRest();
    }
  }, 250);
}

function updRest() {
  const pct = S.restDuration > 0 ? (S.restSecs / S.restDuration * 100).toFixed(1) : '100';
  document.getElementById('rest-cnt').textContent = S.restSecs + 's';
  document.getElementById('rest-fill').style.width = pct + '%';
  const ratio = S.restDuration > 0 ? S.restSecs / S.restDuration : 0;
  document.getElementById('rest-fill').style.background = ratio > 0.5 ? '#22C55E' : ratio > 0.17 ? '#F59E0B' : '#EF4444';
  updateMiniBar();
}

export function stopRest() {
  clearInterval(restInt);
  S.restSecs = 0;
  document.getElementById('rest-row').style.display = 'none';
  updateMiniBar();
}

export function updateTimerBtn() {
  const btn = document.getElementById('timer-btn');
  if (S.timerState === 'running') {
    btn.innerHTML = '<i class="ti ti-player-pause" aria-hidden="true"></i><span>Pause</span>';
  } else if (S.timerState === 'paused') {
    btn.innerHTML = '<i class="ti ti-player-play" aria-hidden="true"></i><span>Resume</span>';
  } else {
    btn.innerHTML = '<i class="ti ti-player-play" aria-hidden="true"></i><span>Start</span>';
  }
}

export function resetTimer() {
  clearInterval(elInt);
  const td = document.getElementById('timer-disp');
  td.textContent = '--:--';
  td.style.color = 'var(--color-text-tertiary, #6a6a71)';
  stopRest();
}
