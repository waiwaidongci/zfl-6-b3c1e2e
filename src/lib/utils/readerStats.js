export function getReaderSignups(readerId, signups) {
  return signups.filter((s) => s.readerId === readerId);
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
      return {
        signup,
        event,
        eventName: event?.book || '未知活动',
        eventHost: event?.host || '',
        eventTime: event?.time || ''
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
    (s) => s.checkedIn && s.reviewStatus === '已通过' && s.status === '正式'
  ).length;
}

export function countMissed(readerId, signups, events) {
  const readerSignups = getReaderSignups(readerId, signups);
  const now = new Date();

  return readerSignups.filter((s) => {
    if (s.reviewStatus !== '已通过' || s.status !== '正式') return false;
    if (s.checkedIn) return false;

    const event = events.find((e) => e.id === s.eventId);
    if (!event || !event.time) return false;

    const eventTime = new Date(event.time);
    return eventTime < now;
  }).length;
}

export function countWaitlistPromoted(readerId, signups) {
  const readerSignups = getReaderSignups(readerId, signups);
  return readerSignups.filter(
    (s) => s.reviewStatus === '已通过' && s.status === '正式' && s._wasWaitlisted
  ).length;
}

export function countTotalEvents(readerId, signups) {
  const readerSignups = getReaderSignups(readerId, signups);
  return readerSignups.filter((s) => s.reviewStatus === '已通过' && s.status === '正式').length;
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
    .filter((s) => s.reviewStatus === '已通过' && s.status === '正式' && s._wasWaitlisted)
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
  const pending = signupsWithReader.filter((s) => s.reviewStatus === '待审核').length;
  const rejected = signupsWithReader.filter((s) => s.reviewStatus === '已拒绝').length;
  const waitlisted = signupsWithReader.filter(
    (s) => s.reviewStatus === '已通过' && s.status === '候补'
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
