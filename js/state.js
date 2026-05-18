import { getAllSessions, putSession, deleteSession, getSetting, putSetting } from './db.js';

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

const DEFAULT_UNIT = 'kg';
let _defaultUnit = DEFAULT_UNIT;

export function getDefaultUnit() { return _defaultUnit; }

export async function loadDefaultUnit() {
  const v = await getSetting('default_unit');
  _defaultUnit = (v === 'lb' || v === 'kg') ? v : DEFAULT_UNIT;
  return _defaultUnit;
}

export async function setDefaultUnit(u) {
  _defaultUnit = (u === 'lb' || u === 'kg') ? u : DEFAULT_UNIT;
  await putSetting('default_unit', _defaultUnit);
}

export function countDoneSets(arr) {
  return (arr || []).reduce((n, s) => n + (s && s.done ? 1 : 0), 0);
}

export async function loadHistoryFromDB() {
  const all = await getAllSessions();
  S.history = all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export async function saveSessionRecord(session) {
  await putSession(session);
}

export async function deleteSessionRecord(id) {
  await deleteSession(id);
}
