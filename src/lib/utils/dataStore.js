import { readBooks, writeBooks, readEvents, writeEvents, readSignups, writeSignups, readMySignupIds, writeMySignupIds, readSeries, writeSeries, KEYS } from './storeUtils.js';
import { readReaders, writeReaders } from './readerStore.js';
import { hasMigratedReaders, markMigrationDone, runFullMigration } from './readerMigration.js';

export function loadAllData() {
  const books = readBooks();
  const events = readEvents();
  const signups = readSignups();
  const mySignupIds = readMySignupIds();
  const series = readSeries();
  let readers = readReaders();
  let migrationStats = null;

  if (!hasMigratedReaders() && signups.length > 0) {
    const result = runFullMigration(readers, signups);
    readers = result.readers;
    writeReaders(readers);
    writeSignups(result.signups);
    markMigrationDone();
    migrationStats = {
      newReaders: result.newReaders,
      updatedReaders: result.updatedReaders,
      linkedCount: result.linkedCount
    };
    return { books, events, signups: result.signups, mySignupIds, series, readers, migrationStats };
  }

  return { books, events, signups, mySignupIds, series, readers, migrationStats };
}

export function saveAllData(data) {
  if (data.books !== undefined) writeBooks(data.books);
  if (data.events !== undefined) writeEvents(data.events);
  if (data.signups !== undefined) writeSignups(data.signups);
  if (data.mySignupIds !== undefined) writeMySignupIds(data.mySignupIds);
  if (data.series !== undefined) writeSeries(data.series);
  if (data.readers !== undefined) writeReaders(data.readers);
}

const KEY_TO_FIELD = {};
KEY_TO_FIELD[KEYS.books] = 'books';
KEY_TO_FIELD[KEYS.events] = 'events';
KEY_TO_FIELD[KEYS.signups] = 'signups';
KEY_TO_FIELD[KEYS.mySignupIds] = 'mySignupIds';
KEY_TO_FIELD[KEYS.series] = 'series';
KEY_TO_FIELD[KEYS.readers] = 'readers';

export function reloadChangedData(changedKeys, currentData) {
  const updated = {};
  for (const key of changedKeys) {
    const field = KEY_TO_FIELD[key];
    if (!field) continue;
    switch (field) {
      case 'books': updated.books = readBooks(); break;
      case 'events': updated.events = readEvents(); break;
      case 'signups': updated.signups = readSignups(); break;
      case 'mySignupIds': updated.mySignupIds = readMySignupIds(); break;
      case 'series': updated.series = readSeries(); break;
      case 'readers': updated.readers = readReaders(); break;
    }
  }
  return { ...currentData, ...updated };
}

export function normalizeEvent(event) {
  if (event.reviewRequired === undefined) {
    return { ...event, reviewRequired: false };
  }
  return event;
}

export function normalizeSignup(signup) {
  let updated = { ...signup };
  if (!updated.status) {
    updated.status = '正式';
    updated.waitlistPosition = undefined;
  }
  if (updated.reviewStatus === undefined) {
    updated.reviewStatus = '已通过';
    updated.rejectionReason = '';
    updated.reviewedAt = '';
  }
  return updated;
}

export function normalizeLegacyEvents(events) {
  return events.map(normalizeEvent);
}

export function normalizeLegacySignups(signups) {
  return signups.map(normalizeSignup);
}
