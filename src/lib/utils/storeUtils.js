import { linkSignupToReader } from './readerMigration.js';

const KEYS = {
  books: 'zfl-6-books',
  events: 'zfl-6-events',
  signups: 'zfl-6-signups',
  mySignupIds: 'zfl-6-my-signup-ids',
  series: 'zfl-6-series',
  readers: 'zfl-6-readers',
  opsViews: 'zfl-6-ops-views'
};

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
  localStorage.setItem(KEYS.books, safeStringify(books));
}

export function readEvents() {
  const stored = safeParse(localStorage.getItem(KEYS.events), []);
  return stored.map((item) => {
    if (item.reviewRequired === undefined) {
      return { ...item, reviewRequired: false };
    }
    return item;
  });
}

export function writeEvents(events) {
  localStorage.setItem(KEYS.events, safeStringify(events));
}

export function readSignups() {
  const stored = safeParse(localStorage.getItem(KEYS.signups), []);
  return stored.map((item) => {
    let updated = { ...item };
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
  });
}

export function writeSignups(signups) {
  localStorage.setItem(KEYS.signups, safeStringify(signups));
}

export function readMySignupIds() {
  return safeParse(localStorage.getItem(KEYS.mySignupIds), []);
}

export function writeMySignupIds(ids) {
  localStorage.setItem(KEYS.mySignupIds, safeStringify(ids));
}

export function readSeries() {
  return safeParse(localStorage.getItem(KEYS.series), []);
}

export function writeSeries(series) {
  localStorage.setItem(KEYS.series, safeStringify(series));
}

export function readViews() {
  return safeParse(localStorage.getItem(KEYS.opsViews), []);
}

export function writeViews(views) {
  localStorage.setItem(KEYS.opsViews, safeStringify(views));
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
    (s) => s.eventId === eventId && s.reviewStatus === '已通过' && s.status === '正式'
  ).length;
}

export function getWaitlistCount(signups, eventId) {
  return signups.filter(
    (s) => s.eventId === eventId && s.reviewStatus === '已通过' && s.status === '候补'
  ).length;
}

export function getPendingCount(signups, eventId) {
  return signups.filter(
    (s) => s.eventId === eventId && s.reviewStatus === '待审核'
  ).length;
}

export function getSeatsLeft(events, signups, eventId) {
  const event = getEventById(events, eventId);
  if (!event) return 0;
  return Math.max(0, Number(event.limit) - getRegularSignupCount(signups, eventId));
}

export function promoteFromWaitlist(events, signups, eventId) {
  const event = getEventById(events, eventId);
  if (!event) return signups;

  const eventSignups = signups.filter(
    (item) => item.eventId === eventId && item.reviewStatus === '已通过'
  );
  const regularCount = eventSignups.filter((item) => item.status === '正式').length;
  const limit = Number(event.limit);

  if (regularCount < limit) {
    const waitlist = eventSignups
      .filter((item) => item.status === '候补')
      .sort((a, b) => a.waitlistPosition - b.waitlistPosition);

    const spotsToFill = limit - regularCount;
    const toPromote = waitlist.slice(0, spotsToFill);

    if (toPromote.length > 0) {
      return signups.map((item) => {
        const promotee = toPromote.find((p) => p.id === item.id);
        if (promotee) {
          return { ...item, status: '正式', waitlistPosition: undefined, _wasWaitlisted: true };
        }
        if (item.eventId === eventId && item.status === '候补') {
          const newPosition = waitlist.findIndex((w) => w.id === item.id) - toPromote.length + 1;
          if (newPosition > 0) {
            return { ...item, waitlistPosition: newPosition };
          }
        }
        return item;
      });
    }
  }
  return signups;
}

export function createSignup(events, signups, eventId, signupData, readers = []) {
  const event = getEventById(events, eventId);
  if (!event || event.status !== '开放报名' || !signupData.name?.trim()) {
    return { success: false, signups, readers, reason: '无法报名' };
  }

  const eventSignups = signups.filter(
    (item) => item.eventId === eventId && item.reviewStatus === '已通过'
  );
  const regularCount = eventSignups.filter((item) => item.status === '正式').length;
  const waitlistCount = eventSignups.filter((item) => item.status === '候补').length;

  let status = '正式';
  let waitlistPosition = undefined;
  let reviewStatus = '已通过';
  let rejectionReason = '';
  let reviewedAt = '';

  if (event.reviewRequired) {
    status = '待审核';
    reviewStatus = '待审核';
  } else if (regularCount >= Number(event.limit)) {
    status = '候补';
    waitlistPosition = waitlistCount + 1;
  }

  const linkResult = linkSignupToReader(readers, signupData);
  const updatedReaders = linkResult.readers;
  const linkedSignupData = linkResult.signupData;

  const newSignup = {
    id: crypto.randomUUID(),
    eventId,
    name: linkedSignupData.name,
    phone: linkedSignupData.phone || '',
    answer: linkedSignupData.answer || '',
    readerId: linkedSignupData.readerId,
    status,
    waitlistPosition,
    reviewStatus,
    rejectionReason,
    reviewedAt,
    checkedIn: false,
    checkedInAt: '',
    createdAt: new Date().toLocaleString()
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
  const signup = signups.find((item) => item.id === signupId);
  if (!signup) return signups;

  let newSignups = signups.filter((item) => item.id !== signupId);

  if (signup.status === '正式' && signup.reviewStatus === '已通过') {
    newSignups = promoteFromWaitlist(events, newSignups, signup.eventId);
  } else if (signup.status === '候补' && signup.reviewStatus === '已通过') {
    newSignups = newSignups.map((item) => {
      if (
        item.eventId === signup.eventId &&
        item.status === '候补' &&
        item.reviewStatus === '已通过' &&
        item.waitlistPosition > signup.waitlistPosition
      ) {
        return { ...item, waitlistPosition: item.waitlistPosition - 1 };
      }
      return item;
    });
  }

  return newSignups;
}
