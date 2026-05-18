const MUTE_KEY = 'workout_audio_muted';

let audioCtx = null;
let muted = false;

export function loadMuteState() {
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }
  return muted;
}

export function isMuted() {
  return muted;
}

export function setMuted(v) {
  muted = !!v;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {}
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

export function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    audioCtx = new Ctx();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

export function playRestEndBeep() {
  if (muted) return;
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  const now = audioCtx.currentTime;
  const freq = 880;
  const beepDur = 0.15;
  const gap = 0.1;
  const peak = 0.25;
  for (let i = 0; i < 3; i++) {
    const start = now + i * (beepDur + gap);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.01);
    gain.gain.setValueAtTime(peak, start + beepDur - 0.02);
    gain.gain.linearRampToValueAtTime(0, start + beepDur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + beepDur + 0.02);
  }
}
