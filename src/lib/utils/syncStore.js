const TAB_ID = crypto.randomUUID();

const VERSION_SUFFIX = '-v';
const SOURCE_SUFFIX = '-src';
const CHANNEL_NAME = 'zfl-6-sync';

const DATA_KEYS = [
  'zfl-6-books',
  'zfl-6-events',
  'zfl-6-signups',
  'zfl-6-my-signup-ids',
  'zfl-6-series',
  'zfl-6-readers',
  'zfl-6-ops-views'
];

const KEY_LABELS = {
  'zfl-6-books': '书目',
  'zfl-6-events': '活动',
  'zfl-6-signups': '报名',
  'zfl-6-my-signup-ids': '报名ID',
  'zfl-6-series': '系列',
  'zfl-6-readers': '读者',
  'zfl-6-ops-views': '运营视图'
};

let channel = null;
let storageListenerActive = false;
const changeListeners = [];

function safeStringify(val) {
  try {
    return JSON.stringify(val);
  } catch (e) {
    return '';
  }
}

export function getTabId() {
  return TAB_ID;
}

export function getVersion(key) {
  return Number(localStorage.getItem(key + VERSION_SUFFIX)) || 0;
}

export function setVersion(key, version) {
  localStorage.setItem(key + VERSION_SUFFIX, String(version));
}

export function getSource(key) {
  return localStorage.getItem(key + SOURCE_SUFFIX) || '';
}

export function setSource(key, source) {
  localStorage.setItem(key + SOURCE_SUFFIX, source);
}

export function versionedWrite(key, stringValue) {
  const current = localStorage.getItem(key);
  if (current === stringValue) return;

  const currentVersion = getVersion(key);
  const newVersion = currentVersion + 1;
  localStorage.setItem(key, stringValue);
  setVersion(key, newVersion);
  setSource(key, TAB_ID);

  broadcastChange(key, newVersion);
}

export function versionedWriteObj(key, value) {
  versionedWrite(key, safeStringify(value));
}

export function getCurrentVersions() {
  const versions = {};
  for (const key of DATA_KEYS) {
    versions[key] = getVersion(key);
  }
  return versions;
}

export function getChangedKeys(knownVersions) {
  const changed = [];
  for (const key of DATA_KEYS) {
    const knownV = knownVersions[key] || 0;
    const currentV = getVersion(key);
    if (currentV > knownV) {
      const source = getSource(key);
      if (source !== TAB_ID) {
        changed.push(key);
      }
    }
  }
  return changed;
}

export function getKeyLabel(key) {
  return KEY_LABELS[key] || key;
}

export function getChangedLabels(changedKeys) {
  const labels = [...new Set(changedKeys.map((k) => getKeyLabel(k)))];
  return labels.join('、');
}

export function initChannel() {
  if (channel) return;

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const data = event.data;
      if (!data || data.sourceTabId === TAB_ID) return;
      if (data.type === 'data-changed') {
        notifyListeners(data);
      }
    };
  } catch (e) {
    channel = null;
  }

  if (!storageListenerActive) {
    window.addEventListener('storage', (event) => {
      if (!event.key || !DATA_KEYS.includes(event.key)) return;
      const newVersion = getVersion(event.key);
      const source = getSource(event.key);
      if (source === TAB_ID) return;
      notifyListeners({
        type: 'data-changed',
        key: event.key,
        version: newVersion,
        sourceTabId: source
      });
    });
    storageListenerActive = true;
  }
}

function broadcastChange(key, version) {
  if (channel) {
    try {
      channel.postMessage({
        type: 'data-changed',
        key,
        version,
        sourceTabId: TAB_ID
      });
    } catch (e) {}
  }
}

export function onExternalChange(callback) {
  initChannel();
  changeListeners.push(callback);
  return () => {
    const idx = changeListeners.indexOf(callback);
    if (idx !== -1) changeListeners.splice(idx, 1);
  };
}

function notifyListeners(data) {
  for (const cb of changeListeners) {
    try {
      cb(data);
    } catch (e) {}
  }
}

export function destroyChannel() {
  if (channel) {
    channel.close();
    channel = null;
  }
}
