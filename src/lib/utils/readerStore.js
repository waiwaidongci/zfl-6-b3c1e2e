const READERS_KEY = 'zfl-6-readers';

function safeParse(str, fallback) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeStringify(val) {
  try {
    return JSON.stringify(val);
  } catch (e) {
    return '';
  }
}

export function readReaders() {
  const stored = safeParse(localStorage.getItem(READERS_KEY), []);
  return stored.map((item) => normalizeReader(item));
}

export function writeReaders(readers) {
  localStorage.setItem(READERS_KEY, safeStringify(readers));
}

export function normalizeReader(reader) {
  return {
    id: reader.id || crypto.randomUUID(),
    name: reader.name || '',
    phone: reader.phone || '',
    note: reader.note || '',
    tags: reader.tags || [],
    createdAt: reader.createdAt || new Date().toLocaleString(),
    updatedAt: reader.updatedAt || new Date().toLocaleString()
  };
}

export function createReader(data) {
  const now = new Date().toLocaleString();
  return normalizeReader({
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  });
}

export function updateReader(readers, readerId, updates) {
  return readers.map((r) =>
    r.id === readerId
      ? { ...r, ...updates, updatedAt: new Date().toLocaleString() }
      : r
  );
}

export function deleteReader(readers, readerId) {
  return readers.filter((r) => r.id !== readerId);
}

export function getReaderById(readers, readerId) {
  return readers.find((r) => r.id === readerId) || null;
}

export function findReaderByPhone(readers, phone) {
  if (!phone) return null;
  const normalizedPhone = phone.trim();
  if (!normalizedPhone) return null;
  return readers.find((r) => r.phone && r.phone.trim() === normalizedPhone) || null;
}

export function findOrCreateReader(readers, phone, data = {}) {
  const existing = findReaderByPhone(readers, phone);
  if (existing) {
    return { reader: existing, isNew: false, readers };
  }
  const newReader = createReader({ phone, ...data });
  return { reader: newReader, isNew: true, readers: [...readers, newReader] };
}

export function upsertReader(readers, phone, updates) {
  const existing = findReaderByPhone(readers, phone);
  if (existing) {
    const merged = {
      ...existing,
      ...updates,
      name: updates.name || existing.name,
      note: updates.note || existing.note
    };
    return {
      reader: merged,
      isNew: false,
      readers: updateReader(readers, existing.id, merged)
    };
  }
  const newReader = createReader({ phone, ...updates });
  return { reader: newReader, isNew: true, readers: [...readers, newReader] };
}
