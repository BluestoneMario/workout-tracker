const DB_NAME = 'workout-tracker';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const SETTINGS_STORE = 'settings';

const DEFAULT_UNIT = 'kg';

let dbPromise = null;

function showStorageToast() {
  if (document.getElementById('app-toast-storage')) return;
  const t = document.createElement('div');
  t.id = 'app-toast-storage';
  t.setAttribute('role', 'alert');
  t.textContent = 'Storage unavailable — your data may not be saved';
  Object.assign(t.style, {
    position: 'fixed',
    left: '12px',
    right: '12px',
    bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
    zIndex: '9000',
    padding: '12px 14px',
    background: '#3b1e1e',
    border: '1px solid #ef4444',
    color: '#fef2f2',
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
  setTimeout(() => { t.style.opacity = '0'; }, 5000);
  setTimeout(() => { t.remove(); }, 5400);
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      console.error('[db] IndexedDB not available');
      showStorageToast();
      resolve(null);
      return;
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      console.error('[db] indexedDB.open threw:', e);
      showStorageToast();
      resolve(null);
      return;
    }
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.error('[db] failed to open IndexedDB:', req.error);
      showStorageToast();
      resolve(null);
    };
    req.onblocked = () => {
      console.warn('[db] open blocked');
    };
  });
  return dbPromise;
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function store(db, name, mode) {
  return db.transaction(name, mode).objectStore(name);
}

export async function getSession(id) {
  const db = await openDB();
  if (!db) return undefined;
  try {
    return await reqToPromise(store(db, SESSIONS_STORE, 'readonly').get(id));
  } catch (e) {
    console.error('[db] getSession failed:', e);
    return undefined;
  }
}

export async function getAllSessions() {
  const db = await openDB();
  if (!db) return [];
  try {
    const all = await reqToPromise(store(db, SESSIONS_STORE, 'readonly').getAll());
    return Array.isArray(all) ? all : [];
  } catch (e) {
    console.error('[db] getAllSessions failed:', e);
    return [];
  }
}

export async function putSession(session) {
  const db = await openDB();
  if (!db) return false;
  try {
    await reqToPromise(store(db, SESSIONS_STORE, 'readwrite').put(session));
    return true;
  } catch (e) {
    console.error('[db] putSession failed:', e);
    return false;
  }
}

export async function deleteSession(id) {
  const db = await openDB();
  if (!db) return false;
  try {
    await reqToPromise(store(db, SESSIONS_STORE, 'readwrite').delete(id));
    return true;
  } catch (e) {
    console.error('[db] deleteSession failed:', e);
    return false;
  }
}

export async function getSetting(key) {
  const db = await openDB();
  if (!db) return undefined;
  try {
    const rec = await reqToPromise(store(db, SETTINGS_STORE, 'readonly').get(key));
    return rec ? rec.value : undefined;
  } catch (e) {
    console.error('[db] getSetting failed:', e);
    return undefined;
  }
}

export async function putSetting(key, value) {
  const db = await openDB();
  if (!db) return false;
  try {
    await reqToPromise(store(db, SETTINGS_STORE, 'readwrite').put({ key, value }));
    return true;
  } catch (e) {
    console.error('[db] putSetting failed:', e);
    return false;
  }
}

export function normalizeSet(s, defaultUnit) {
  const u = defaultUnit || DEFAULT_UNIT;
  if (s === true) return { done: true, reps: null, weight: null, weightUnit: u };
  if (s === false || s == null) return { done: false, reps: null, weight: null, weightUnit: u };
  if (typeof s === 'object') {
    return {
      done: !!s.done,
      reps: (s.reps == null ? null : s.reps),
      weight: (s.weight === undefined ? null : s.weight),
      weightUnit: s.weightUnit || s.unit || u,
    };
  }
  return { done: false, reps: null, weight: null, weightUnit: u };
}

const LAST_WEIGHT_PREFIX = 'last_weight:';

export async function getLastWeight(exId) {
  return await getSetting(LAST_WEIGHT_PREFIX + exId);
}

export async function putLastWeight(exId, kg) {
  return await putSetting(LAST_WEIGHT_PREFIX + exId, kg);
}

function normalizeSessionRecord(rec, defaultUnit, fallbackIndex) {
  const out = { ...rec };
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
        return { ...ex, sets: ex.sets.map(s => normalizeSet(s, defaultUnit)) };
      }
      return ex;
    });
  }
  return out;
}

export async function migrateFromLocalStorage() {
  const db = await openDB();
  if (!db) return;

  try {
    const oldHistory = localStorage.getItem('training_history');
    if (oldHistory) {
      try {
        const parsed = JSON.parse(oldHistory);
        if (Array.isArray(parsed)) {
          for (let i = 0; i < parsed.length; i++) {
            const rec = parsed[i];
            if (!rec || typeof rec !== 'object') continue;
            await putSession(normalizeSessionRecord(rec, DEFAULT_UNIT, i));
          }
        }
      } catch (e) {
        console.error('[db] failed to parse legacy training_history:', e);
      }
      localStorage.removeItem('training_history');
    }
  } catch (e) {
    console.error('[db] training_history migration failed:', e);
  }

  try {
    const oldMute = localStorage.getItem('workout_audio_muted');
    if (oldMute !== null) {
      await putSetting('audio_muted', oldMute === '1');
      localStorage.removeItem('workout_audio_muted');
    }
  } catch (e) {
    console.error('[db] mute migration failed:', e);
  }

  try {
    localStorage.removeItem('training_notes');
  } catch {}
}
