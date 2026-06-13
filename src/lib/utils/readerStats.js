import { normalizeTags } from './readerStore.js';
import {
  isCheckedIn,
  isApproved,
  isPending,
  isRejected,
  isRegular,
  isWaitlist,
  isPromoted
} from './signupStatusMachine.js';

export function getReaderSignups(readerId, signups) {
  return signups.filter((s) => s.readerId === readerId);
}

export function getAllTagsFromReaders(readers) {
  const tagSet = new Set();
  for (const r of readers) {
    const tags = normalizeTags(r.tags || []);
    for (const t of tags) {
      tagSet.add(t);
    }
  }
  return Array.from(tagSet).sort();
}

export function getTagCounts(readers) {
  const counts = new Map();
  for (const r of readers) {
    const tags = normalizeTags(r.tags || []);
    for (const t of tags) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function filterReaderStatsByTags(readerStats, tags) {
  const normalizedFilterTags = normalizeTags(tags);
  if (normalizedFilterTags.length === 0) return readerStats;
  return readerStats.filter((item) => {
    const readerTags = normalizeTags(item.reader.tags || []);
    return normalizedFilterTags.every((ft) => readerTags.includes(ft));
  });
}

export function getReaderEvents(readerId, signups, events) {
  const readerSignups = getReaderSignups(readerId, signups);
  const eventIds = new Set(readerSignups.map((s) => s.eventId));
  return events.filter((e) => eventIds.has(e.id));
}

export function getReaderActivityHistory(readerId, signups, events) {
  const readerSignups = getReaderSignups(readerId, signups);
  return readerSignups
    .map((signup) => {
      const event = events.find((e) => e.id === signup.eventId);
      const review = event?.review || null;
      return {
        signup,
        event,
        eventName: event?.book || '未知活动',
        eventHost: event?.host || '',
        eventTime: event?.time || '',
        review: review && (review.note || review.onSiteCount !== null || review.walkInCount !== null || review.absenceReasons || review.followUpReaders || review.recommendedBooks)
          ? {
              note: review.note || '',
              onSiteCount: review.onSiteCount !== undefined ? review.onSiteCount : null,
              walkInCount: review.walkInCount !== undefined ? review.walkInCount : null,
              absenceReasons: review.absenceReasons || '',
              followUpReaders: review.followUpReaders || '',
              recommendedBooks: review.recommendedBooks || '',
              updatedAt: review.updatedAt || ''
            }
          : null
      };
    })
    .sort((a, b) => {
      const aTime = a.eventTime || a.signup.createdAt;
      const bTime = b.eventTime || b.signup.createdAt;
      return bTime.localeCompare(aTime);
    });
}

export function countCheckedIn(readerId, signups) {
  const readerSignups = getReaderSignups(readerId, signups);
  return readerSignups.filter(
    (s) => isCheckedIn(s.status)
  ).length;
}

export function countMissed(readerId, signups, events) {
  const readerSignups = getReaderSignups(readerId, signups);
  const now = new Date();

  return readerSignups.filter((s) => {
    if (!isRegular(s.status) && !isPromoted(s.status)) return false;
    if (isCheckedIn(s.status)) return false;

    const event = events.find((e) => e.id === s.eventId);
    if (!event || !event.time) return false;

    const eventTime = new Date(event.time);
    return eventTime < now;
  }).length;
}

export function countWaitlistPromoted(readerId, signups) {
  const readerSignups = getReaderSignups(readerId, signups);
  return readerSignups.filter(
    (s) => isPromoted(s.status)
  ).length;
}

export function countTotalEvents(readerId, signups) {
  const readerSignups = getReaderSignups(readerId, signups);
  return readerSignups.filter((s) => isRegular(s.status) || isPromoted(s.status) || isCheckedIn(s.status)).length;
}

export function getLatestAnswer(readerId, signups) {
  const readerSignups = getReaderSignups(readerId, signups);
  const withAnswers = readerSignups
    .filter((s) => s.answer && s.answer.trim())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return withAnswers[0]?.answer || '';
}

export function getWaitlistPromotions(readerId, signups, events) {
  const readerSignups = getReaderSignups(readerId, signups);
  return readerSignups
    .filter((s) => isPromoted(s.status))
    .map((s) => {
      const event = events.find((e) => e.id === s.eventId);
      return {
        signup: s,
        event,
        eventName: event?.book || '未知活动',
        promotedAt: s.reviewedAt || s.createdAt
      };
    })
    .sort((a, b) => b.promotedAt.localeCompare(a.promotedAt));
}

export function getReaderStats(readerId, signups, events) {
  const history = getReaderActivityHistory(readerId, signups, events);
  const checkedIn = countCheckedIn(readerId, signups);
  const missed = countMissed(readerId, signups, events);
  const totalEvents = countTotalEvents(readerId, signups);
  const promoted = countWaitlistPromoted(readerId, signups);
  const latestAnswer = getLatestAnswer(readerId, signups);
  const promotions = getWaitlistPromotions(readerId, signups, events);

  const signupsWithReader = getReaderSignups(readerId, signups);
  const pending = signupsWithReader.filter((s) => isPending(s.status)).length;
  const rejected = signupsWithReader.filter((s) => isRejected(s.status)).length;
  const waitlisted = signupsWithReader.filter(
    (s) => isWaitlist(s.status)
  ).length;

  const attendanceRate = totalEvents > 0 ? Math.round((checkedIn / totalEvents) * 100) : 0;

  return {
    totalSignups: signupsWithReader.length,
    totalEvents,
    checkedIn,
    missed,
    pending,
    rejected,
    waitlisted,
    promoted,
    attendanceRate,
    latestAnswer,
    history,
    promotions
  };
}

export function getAllReadersStats(readers, signups, events) {
  return readers.map((reader) => ({
    reader,
    stats: getReaderStats(reader.id, signups, events)
  }));
}

export function sortReadersByActivity(readerStats, sortBy = 'lastActive') {
  return [...readerStats].sort((a, b) => {
    switch (sortBy) {
      case 'totalEvents':
        return b.stats.totalEvents - a.stats.totalEvents;
      case 'checkedIn':
        return b.stats.checkedIn - a.stats.checkedIn;
      case 'missed':
        return b.stats.missed - a.stats.missed;
      case 'attendanceRate':
        return b.stats.attendanceRate - a.stats.attendanceRate;
      case 'lastActive':
      default: {
        const aLast = a.stats.history[0]?.eventTime || a.stats.history[0]?.signup.createdAt || '';
        const bLast = b.stats.history[0]?.eventTime || b.stats.history[0]?.signup.createdAt || '';
        return bLast.localeCompare(aLast);
      }
    }
  });
}
