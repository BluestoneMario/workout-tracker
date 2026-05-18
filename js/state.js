import { getAllSessions, putSession, deleteSession, getSetting, putSetting, getLastWeight, putLastWeight } from './db.js';

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
  repsPrompt: null,
  editPopover: null,
  cardWeights: {},
};

export const KG_TO_LB = 2.20462;

export function kgToDisplayValue(kg, unit) {
  if (kg == null) return '';
  if (unit === 'lb') return (Math.round(kg * KG_TO_LB * 10) / 10).toString();
  const r = Math.round(kg * 100) / 100;
  return r.toString();
}

export function inputValueToKg(value, unit) {
  const v = parseFloat(value);
  if (!Number.isFinite(v) || v <= 0) return null;
  return unit === 'lb' ? v / KG_TO_LB : v;
}

export function parseTargetReps(repsString) {
  if (typeof repsString !== 'string') return null;
  const m = repsString.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

export async function loadCardWeights() {
  S.cardWeights = {};
  const data = getData();
  if (!data) return;
  for (const sessKey of Object.keys(data)) {
    for (const blk of data[sessKey].blocks) {
      for (const ex of blk.exs) {
        if (!ex.weighted) continue;
        const kg = await getLastWeight(ex.id);
        if (kg != null) S.cardWeights[ex.id] = kg;
      }
    }
  }
}

export async function setCardWeight(exId, kg) {
  if (kg == null) {
    delete S.cardWeights[exId];
  } else {
    S.cardWeights[exId] = kg;
  }
  await putLastWeight(exId, kg);
}

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
