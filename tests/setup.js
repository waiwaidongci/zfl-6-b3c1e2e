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

if (typeof globalThis.crypto === 'undefined') {
  let uuidCounter = 0;
  globalThis.crypto = {
    randomUUID: () => {
      uuidCounter++;
      return 'test-uuid-' + uuidCounter.toString().padStart(8, '0');
    },
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  };
}

if (typeof globalThis.BroadcastChannel === 'undefined') {
  const channels = new Map();

  globalThis.BroadcastChannel = class BroadcastChannel {
    constructor(name) {
      this.name = name;
      this._listeners = [];
      this._closed = false;
      if (!channels.has(name)) {
        channels.set(name, new Set());
      }
      channels.get(name).add(this);
    }

    postMessage(data) {
      if (this._closed) return;
      const allChannels = channels.get(this.name);
      if (!allChannels) return;
      for (const ch of allChannels) {
        if (ch !== this && !ch._closed) {
          for (const listener of ch._listeners) {
            try {
              listener({ data, source: this });
            } catch (e) {}
          }
          if (ch.onmessage) {
            try {
              ch.onmessage({ data, source: this });
            } catch (e) {}
          }
        }
      }
    }

    addEventListener(type, listener) {
      if (type === 'message') {
        this._listeners.push(listener);
      }
    }

    removeEventListener(type, listener) {
      if (type === 'message') {
        const idx = this._listeners.indexOf(listener);
        if (idx !== -1) this._listeners.splice(idx, 1);
      }
    }

    set onmessage(fn) {
      this._onmessage = fn;
    }

    get onmessage() {
      return this._onmessage || null;
    }

    close() {
      this._closed = true;
      const allChannels = channels.get(this.name);
      if (allChannels) {
        allChannels.delete(this);
      }
    }
  };
}

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
}
