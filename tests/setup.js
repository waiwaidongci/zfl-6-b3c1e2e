const storeMap = new Map();

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (key) => {
      const val = storeMap.get(key);
      return val === undefined ? null : String(val);
    },
    setItem: (key, value) => {
      storeMap.set(key, String(value));
    },
    removeItem: (key) => {
      storeMap.delete(key);
    },
    clear: () => {
      storeMap.clear();
    },
    get length() {
      return storeMap.size;
    },
    key: (index) => {
      const keys = Array.from(storeMap.keys());
      return keys[index] || null;
    }
  };
}

let _uuidSeq = 0;
let _randomSeq = 0;

function deterministicUUID() {
  _uuidSeq++;
  const hex = _uuidSeq.toString(16).padStart(12, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${'0'.repeat(3)}-${'a000'.slice(0, 4)}-${'0'.repeat(12)}`;
}

function deterministicRandomValues(arr) {
  const constructor = arr.constructor;
  const byteLen = constructor.BYTES_PER_ELEMENT || 1;
  for (let i = 0; i < arr.length; i++) {
    _randomSeq++;
    const v = (_randomSeq * 2654435761) >>> 0;
    arr[i] = (v % (256 ** byteLen));
  }
  return arr;
}

const _origCrypto = globalThis.crypto;

const _cryptoMock = {
  randomUUID: deterministicUUID,
  getRandomValues: deterministicRandomValues
};

try {
  globalThis.crypto = _cryptoMock;
} catch (_) {
  Object.defineProperty(globalThis, 'crypto', {
    value: _cryptoMock,
    writable: true,
    configurable: true
  });
}

const _channelRegistry = new Map();

class DeterministicBroadcastChannel {
  constructor(name) {
    this.name = name;
    this._listeners = [];
    this._closed = false;
    this._onmessage = null;
    if (!_channelRegistry.has(name)) {
      _channelRegistry.set(name, new Set());
    }
    _channelRegistry.get(name).add(this);
  }

  postMessage(data) {
    if (this._closed) return;
    const members = _channelRegistry.get(this.name);
    if (!members) return;
    for (const ch of members) {
      if (ch === this || ch._closed) continue;
      const event = { data, source: this };
      for (const fn of ch._listeners) {
        try { fn(event); } catch (_) {}
      }
      if (ch._onmessage) {
        try { ch._onmessage(event); } catch (_) {}
      }
    }
  }

  addEventListener(type, listener) {
    if (type === 'message' && typeof listener === 'function') {
      this._listeners.push(listener);
    }
  }

  removeEventListener(type, listener) {
    if (type === 'message') {
      const idx = this._listeners.indexOf(listener);
      if (idx !== -1) this._listeners.splice(idx, 1);
    }
  }

  set onmessage(fn) { this._onmessage = typeof fn === 'function' ? fn : null; }
  get onmessage() { return this._onmessage; }

  close() {
    this._closed = true;
    const members = _channelRegistry.get(this.name);
    if (members) members.delete(this);
  }
}

const _origBroadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = DeterministicBroadcastChannel;

if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: () => ({}),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    title: '',
    location: { href: 'http://localhost/', pathname: '/', search: '' }
  };
}

if (typeof globalThis.addEventListener === 'undefined') {
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
}

export function resetTestEnv() {
  if (globalThis.localStorage && typeof globalThis.localStorage.clear === 'function') {
    globalThis.localStorage.clear();
  }
  storeMap.clear();

  _uuidSeq = 0;
  _randomSeq = 0;

  for (const [, members] of _channelRegistry) {
    for (const ch of members) {
      ch._closed = true;
      ch._listeners.length = 0;
      ch._onmessage = null;
    }
    members.clear();
  }
  _channelRegistry.clear();
}

export function getUUIDSequence() {
  return _uuidSeq;
}

export function restoreGlobals() {
  if (_origCrypto !== undefined) globalThis.crypto = _origCrypto;
  if (_origBroadcastChannel !== undefined) globalThis.BroadcastChannel = _origBroadcastChannel;
}
