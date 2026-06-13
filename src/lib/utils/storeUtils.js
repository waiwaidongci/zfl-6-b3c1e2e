import { linkSignupToReader } from './readerMigration.js';
import { versionedWrite } from './syncStore.js';
import {
  migrateAllSignups,
  isRegular,
  isWaitlist,
  isPending,
  isApproved,
  isPromoted,
  isCheckedIn,
  promoteFromWaitlistWithStatus,
  cancelSignupWithStatus,
  createNewSignupStatus,
  SIGNUP_STATUS
} from './signupStatusMachine.js';

const KEYS = {
  books: 'zfl-6-books',
  events: 'zfl-6-events',
  signups: 'zfl-6-signups',
  mySignupIds: 'zfl-6-my-signup-ids',
  series: 'zfl-6-series',
  readers: 'zfl-6-readers',
  opsViews: 'zfl-6-ops-views'
};

export { KEYS };

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

export function readBooks() {
  return safeParse(localStorage.getItem(KEYS.books), []);
}

export function writeBooks(books) {
  versionedWrite(KEYS.books, safeStringify(books));
}

export function readEvents() {
  const stored = safeParse(localStorage.getItem(KEYS.events), []);
  return stored.map((item) => {
    let updated = { ...item };
    if (updated.reviewRequired === undefined) {
      updated.reviewRequired = false;
    }
    if (!updated.review || typeof updated.review !== 'object') {
      updated.review = {
        note: '',
        onSiteCount: null,
        walkInCount: null,
        absenceReasons: '',
        followUpReaders: '',
        recommendedBooks: '',
        updatedAt: ''
      };
    } else {
      updated.review = {
        note: updated.review.note || '',
        onSiteCount: updated.review.onSiteCount !== undefined ? updated.review.onSiteCount : null,
        walkInCount: updated.review.walkInCount !== undefined ? updated.review.walkInCount : null,
        absenceReasons: updated.review.absenceReasons || '',
        followUpReaders: updated.review.followUpReaders || '',
        recommendedBooks: updated.review.recommendedBooks || '',
        updatedAt: updated.review.updatedAt || ''
      };
    }
    return updated;
  });
}

export function writeEvents(events) {
  versionedWrite(KEYS.events, safeStringify(events));
}

export function readSignups() {
  const stored = safeParse(localStorage.getItem(KEYS.signups), []);
  const migrated = migrateAllSignups(stored);
  return migrated.map((item) => {
    let updated = { ...item };
    if (!updated.status) {
      updated.status = SIGNUP_STATUS.CONFIRMED;
      updated.waitlistPosition = undefined;
    }
    if (updated.reviewStatus === undefined) {
      updated.reviewStatus = '已通过';
      updated.rejectionReason = '';
      updated.reviewedAt = '';
    }
    return updated;
  });
}

export function writeSignups(signups) {
  versionedWrite(KEYS.signups, safeStringify(signups));
}

export function readMySignupIds() {
  return safeParse(localStorage.getItem(KEYS.mySignupIds), []);
}

export function writeMySignupIds(ids) {
  versionedWrite(KEYS.mySignupIds, safeStringify(ids));
}

export function readSeries() {
  return safeParse(localStorage.getItem(KEYS.series), []);
}

export function writeSeries(series) {
  versionedWrite(KEYS.series, safeStringify(series));
}

export function readViews() {
  return safeParse(localStorage.getItem(KEYS.opsViews), []);
}

export function writeViews(views) {
  versionedWrite(KEYS.opsViews, safeStringify(views));
}

export function createView(viewData) {
  const views = readViews();
  const newView = {
    id: crypto.randomUUID(),
    name: viewData.name.trim(),
    filters: {
      dateFrom: viewData.filters?.dateFrom || '',
      dateTo: viewData.filters?.dateTo || '',
      seriesId: viewData.filters?.seriesId || '',
      status: viewData.filters?.status || ''
    },
    granularity: viewData.granularity || 'month',
    expandedSections: {
      overview: viewData.expandedSections?.overview ?? true,
      groups: viewData.expandedSections?.groups ?? true,
      anomalies: viewData.expandedSections?.anomalies ?? true,
      series: viewData.expandedSections?.series ?? false,
      trend: viewData.expandedSections?.trend ?? false,
      detail: viewData.expandedSections?.detail ?? true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  views.push(newView);
  writeViews(views);
  return newView;
}

export function updateView(viewId, updates) {
  const views = readViews();
  const index = views.findIndex((v) => v.id === viewId);
  if (index === -1) return null;
  views[index] = {
    ...views[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  writeViews(views);
  return views[index];
}

export function deleteView(viewId) {
  const views = readViews();
  const filtered = views.filter((v) => v.id !== viewId);
  writeViews(filtered);
  return filtered;
}

export function renameView(viewId, newName) {
  const trimmedName = newName.trim();
  if (!trimmedName) return null;
  return updateView(viewId, { name: trimmedName });
}

export function readAllStore() {
  return {
    books: readBooks(),
    events: readEvents(),
    signups: readSignups(),
    mySignupIds: readMySignupIds(),
    series: readSeries()
  };
}

export function getEventById(events, eventId) {
  return events.find((e) => e.id === eventId) || null;
}

export function getSeriesOfEvent(events, series, eventId) {
  const event = getEventById(events, eventId);
  if (!event || !event.seriesId) return null;
  return series.find((s) => s.id === event.seriesId) || null;
}

export function getSeriesEvents(events, seriesId) {
  return events
    .filter((e) => e.seriesId === seriesId)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function getSeriesById(series, seriesId) {
  if (!seriesId) return null;
  return series.find((s) => s.id === seriesId) || null;
}

export function isValidSeriesId(series, seriesId) {
  if (!seriesId || typeof seriesId !== 'string') return false;
  return series.some((s) => s.id === seriesId);
}

export function getSeriesStatsSummary(events, signups, seriesId) {
  const sEvents = getSeriesEvents(events, seriesId);
  if (sEvents.length === 0) {
    return {
      eventCount: 0,
      totalSeats: 0,
      totalRegular: 0,
      totalWaitlist: 0,
      openCount: 0,
      closedCount: 0
    };
  }
  let totalSeats = 0;
  let totalRegular = 0;
  let totalWaitlist = 0;
  let openCount = 0;
  let closedCount = 0;
  for (const ev of sEvents) {
    totalSeats += Number(ev.limit) || 0;
    totalRegular += getRegularSignupCount(signups, ev.id);
    totalWaitlist += getWaitlistCount(signups, ev.id);
    if (ev.status === '开放报名') openCount++;
    else closedCount++;
  }
  return {
    eventCount: sEvents.length,
    totalSeats,
    totalRegular,
    totalWaitlist,
    openCount,
    closedCount
  };
}

export function getEventIndexInSeries(events, eventId) {
  const event = getEventById(events, eventId);
  if (!event || !event.seriesId) return 0;
  const sEvents = getSeriesEvents(events, event.seriesId);
  return sEvents.findIndex((e) => e.id === eventId) + 1;
}

export function getRegularSignupCount(signups, eventId) {
  return signups.filter(
    (s) => s.eventId === eventId && (isRegular(s.status) || isPromoted(s.status) || isCheckedIn(s.status))
  ).length;
}

export function getWaitlistCount(signups, eventId) {
  return signups.filter(
    (s) => s.eventId === eventId && isWaitlist(s.status)
  ).length;
}

export function getPendingCount(signups, eventId) {
  return signups.filter(
    (s) => s.eventId === eventId && isPending(s.status)
  ).length;
}

export function getSeatsLeft(events, signups, eventId) {
  const event = getEventById(events, eventId);
  if (!event) return 0;
  return Math.max(0, Number(event.limit) - getRegularSignupCount(signups, eventId));
}

export function promoteFromWaitlist(events, signups, eventId) {
  return promoteFromWaitlistWithStatus(events, signups, eventId);
}

export function createSignup(events, signups, eventId, signupData, readers = []) {
  const event = getEventById(events, eventId);
  if (!event || event.status !== '开放报名' || !signupData.name?.trim()) {
    return { success: false, signups, readers, reason: '无法报名' };
  }

  const eventSignups = signups.filter((item) => item.eventId === eventId);
  const { status, waitlistPosition } = createNewSignupStatus(event, eventSignups);

  const linkResult = linkSignupToReader(readers, signupData);
  const updatedReaders = linkResult.readers;
  const linkedSignupData = linkResult.signupData;

  const now = new Date().toLocaleString();
  const newSignup = {
    id: crypto.randomUUID(),
    eventId,
    name: linkedSignupData.name,
    phone: linkedSignupData.phone || '',
    answer: linkedSignupData.answer || '',
    readerId: linkedSignupData.readerId,
    status,
    waitlistPosition,
    reviewStatus: status === SIGNUP_STATUS.PENDING ? '待审核' : '已通过',
    rejectionReason: '',
    reviewedAt: status === SIGNUP_STATUS.PENDING ? '' : now,
    checkedIn: false,
    checkedInAt: '',
    createdAt: now
  };

  return {
    success: true,
    signup: newSignup,
    signups: [newSignup, ...signups],
    readers: updatedReaders,
    matchedReader: linkResult.reader,
    isNewReader: linkResult.isNewReader
  };
}

export function cancelSignup(events, signups, signupId) {
  return cancelSignupWithStatus(events, signups, signupId);
}
