const READERS_KEY = 'zfl-6-readers';
import { versionedWrite } from './syncStore.js';

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

export function normalizeTag(tag) {
  if (!tag) return '';
  let normalized = String(tag).trim().toLowerCase();
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.replace(/[，。！？、；：""''（）【】]/g, '');
  return normalized;
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const result = [];
  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

export function readReaders() {
  const stored = safeParse(localStorage.getItem(READERS_KEY), []);
  return stored.map((item) => normalizeReader(item));
}

export function writeReaders(readers) {
  versionedWrite(READERS_KEY, safeStringify(readers));
}

export function normalizeReader(reader) {
  return {
    id: reader.id || crypto.randomUUID(),
    name: reader.name || '',
    phone: reader.phone || '',
    note: reader.note || '',
    tags: normalizeTags(reader.tags || []),
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

export function addTagToReader(readers, readerId, tag) {
  const normalizedTag = normalizeTag(tag);
  if (!normalizedTag) return readers;
  return readers.map((r) => {
    if (r.id !== readerId) return r;
    const existingTags = normalizeTags(r.tags || []);
    if (existingTags.includes(normalizedTag)) return r;
    return {
      ...r,
      tags: [...existingTags, normalizedTag],
      updatedAt: new Date().toLocaleString()
    };
  });
}

export function removeTagFromReader(readers, readerId, tag) {
  const normalizedTag = normalizeTag(tag);
  if (!normalizedTag) return readers;
  return readers.map((r) => {
    if (r.id !== readerId) return r;
    const existingTags = normalizeTags(r.tags || []);
    const filteredTags = existingTags.filter((t) => t !== normalizedTag);
    if (filteredTags.length === existingTags.length) return r;
    return {
      ...r,
      tags: filteredTags,
      updatedAt: new Date().toLocaleString()
    };
  });
}

export function getAllTags(readers) {
  const tagSet = new Set();
  for (const r of readers) {
    const tags = normalizeTags(r.tags || []);
    for (const t of tags) {
      tagSet.add(t);
    }
  }
  return Array.from(tagSet).sort();
}

export function filterReadersByTags(readers, tags) {
  const normalizedFilterTags = normalizeTags(tags);
  if (normalizedFilterTags.length === 0) return readers;
  return readers.filter((r) => {
    const readerTags = normalizeTags(r.tags || []);
    return normalizedFilterTags.every((ft) => readerTags.includes(ft));
  });
}

export function upsertReader(readers, phone, updates) {
  const existing = findReaderByPhone(readers, phone);
  if (existing) {
    const existingTags = normalizeTags(existing.tags || []);
    const newTags = normalizeTags(updates.tags || []);
    const mergedTags = [...existingTags];
    for (const t of newTags) {
      if (!mergedTags.includes(t)) {
        mergedTags.push(t);
      }
    }
    const merged = {
      ...existing,
      ...updates,
      name: updates.name || existing.name,
      note: updates.note || existing.note,
      tags: mergedTags
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
