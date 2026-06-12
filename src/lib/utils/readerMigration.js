import { createReader, normalizeReader, findReaderByPhone, upsertReader, normalizeTags } from './readerStore.js';

const MIGRATION_FLAG_KEY = 'zfl-6-readers-migrated';

export function hasMigratedReaders() {
  return localStorage.getItem(MIGRATION_FLAG_KEY) === '1';
}

export function markMigrationDone() {
  localStorage.setItem(MIGRATION_FLAG_KEY, '1');
}

export function resetMigrationFlag() {
  localStorage.removeItem(MIGRATION_FLAG_KEY);
}

function pickLatestName(existingReader, signupName) {
  if (!existingReader.name && signupName) return signupName;
  if (existingReader.name && !signupName) return existingReader.name;
  return signupName || existingReader.name;
}

function pickBestNote(existingReader, signupAnswer) {
  if (existingReader.note && existingReader.note.trim()) return existingReader.note;
  return signupAnswer || existingReader.note || '';
}

export function migrateReadersFromSignups(existingReaders, signups) {
  let readers = [...existingReaders];
  const createdCount = { newReaders: 0, updatedReaders: 0 };

  const phoneToSignups = new Map();
  for (const signup of signups) {
    const phone = (signup.phone || '').trim();
    if (!phone) continue;
    if (!phoneToSignups.has(phone)) {
      phoneToSignups.set(phone, []);
    }
    phoneToSignups.get(phone).push(signup);
  }

  for (const [phone, signupList] of phoneToSignups.entries()) {
    const sortedSignups = [...signupList].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    const latestSignup = sortedSignups[0];
    const existingReader = findReaderByPhone(readers, phone);

    if (!existingReader) {
      const oldestSignup = sortedSignups[sortedSignups.length - 1];
      const noteCandidates = sortedSignups
        .filter((s) => s.answer && s.answer.trim())
        .map((s) => s.answer.trim());

      readers.push(
        normalizeReader({
          id: crypto.randomUUID(),
          name: latestSignup.name || '',
          phone: phone,
          note: noteCandidates[0] || '',
          tags: [],
          createdAt: oldestSignup.createdAt || new Date().toLocaleString(),
          updatedAt: latestSignup.createdAt || new Date().toLocaleString()
        })
      );
      createdCount.newReaders++;
    } else {
      const updatedName = pickLatestName(existingReader, latestSignup.name);
      const updatedNote = pickBestNote(existingReader, latestSignup.answer);
      const normalizedTags = normalizeTags(existingReader.tags || []);

      if (
        updatedName !== existingReader.name ||
        updatedNote !== existingReader.note ||
        JSON.stringify(normalizedTags) !== JSON.stringify(existingReader.tags || [])
      ) {
        readers = readers.map((r) =>
          r.id === existingReader.id
            ? {
                ...r,
                name: updatedName,
                note: updatedNote,
                tags: normalizedTags,
                updatedAt: latestSignup.createdAt || r.updatedAt
              }
            : r
        );
        createdCount.updatedReaders++;
      }
    }
  }

  return { readers, ...createdCount };
}

export function ensureSignupsLinkedToReaders(readers, signups) {
  let updatedReaders = [...readers];
  const readerPhoneIndex = new Map();
  for (const r of updatedReaders) {
    if (r.phone) readerPhoneIndex.set(r.phone.trim(), r);
  }

  let linkedCount = 0;
  const linkedSignups = signups.map((signup) => {
    if (signup.readerId) return signup;

    const phone = (signup.phone || '').trim();
    if (!phone) return signup;

    let reader = readerPhoneIndex.get(phone);
    if (!reader) {
      reader = createReader({
        name: signup.name || '',
        phone: phone,
        note: signup.answer || ''
      });
      updatedReaders.push(reader);
      readerPhoneIndex.set(phone, reader);
    } else if (signup.answer && signup.answer.trim() && !reader.note) {
      updatedReaders = updatedReaders.map((r) =>
        r.id === reader.id ? { ...r, note: signup.answer.trim() } : r
      );
      readerPhoneIndex.set(phone, { ...reader, note: signup.answer.trim() });
    }

    linkedCount++;
    return { ...signup, readerId: reader.id };
  });

  return { readers: updatedReaders, signups: linkedSignups, linkedCount };
}

export function runFullMigration(existingReaders, existingSignups) {
  const migrationResult = migrateReadersFromSignups(existingReaders, existingSignups);
  const linkResult = ensureSignupsLinkedToReaders(migrationResult.readers, existingSignups);

  return {
    readers: linkResult.readers,
    signups: linkResult.signups,
    newReaders: migrationResult.newReaders,
    updatedReaders: migrationResult.updatedReaders,
    linkedCount: linkResult.linkedCount
  };
}

export function linkSignupToReader(readers, signupData) {
  const phone = (signupData.phone || '').trim();
  if (!phone) {
    return { readers, signupData, reader: null };
  }

  const result = upsertReader(readers, phone, {
    name: signupData.name,
    note: signupData.answer
  });

  return {
    readers: result.readers,
    signupData: { ...signupData, readerId: result.reader.id },
    reader: result.reader,
    isNewReader: result.isNew
  };
}
