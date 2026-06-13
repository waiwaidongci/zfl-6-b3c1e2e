import {
  isApproved,
  isPending,
  isRejected,
  isRegular,
  isWaitlist,
  isPromoted,
  isCheckedIn
} from './signupStatusMachine.js';

export function getEventStats(events, signups, series) {
  const now = new Date();
  return events.map((event) => {
    const eventSignups = signups.filter((s) => s.eventId === event.id);
    const approved = eventSignups.filter((s) => isApproved(s.status));
    const regular = approved.filter((s) => isRegular(s.status));
    const waitlist = approved.filter((s) => isWaitlist(s.status));
    const pending = eventSignups.filter((s) => isPending(s.status));
    const rejected = eventSignups.filter((s) => isRejected(s.status));
    const checkedIn = approved.filter((s) => isCheckedIn(s.status));
    const promoted = approved.filter((s) => isPromoted(s.status));
    const limit = Number(event.limit);
    const review = event.review || {};
    const eventTime = new Date(event.time);
    const isEnded = eventTime < now;
    const hasReview = !!(review.note || review.onSiteCount !== null || review.walkInCount !== null || review.absenceReasons || review.followUpReaders || review.recommendedBooks);

    const signupConversionRate = eventSignups.length > 0
      ? Math.round((approved.length / eventSignups.length) * 100)
      : 0;

    const fullnessRate = limit > 0
      ? Math.round((regular.length / limit) * 100)
      : 0;

    const waitlistPromotionRate = (waitlist.length + promoted.length) > 0
      ? Math.round((promoted.length / (waitlist.length + promoted.length)) * 100)
      : 0;

    const checkinRate = regular.length > 0
      ? Math.round((checkedIn.length / regular.length) * 100)
      : 0;

    const rejectionRate = eventSignups.length > 0
      ? Math.round((rejected.length / eventSignups.length) * 100)
      : 0;

    const onSiteCount = review.onSiteCount !== undefined && review.onSiteCount !== null ? Number(review.onSiteCount) : null;
    const walkInCount = review.walkInCount !== undefined && review.walkInCount !== null ? Number(review.walkInCount) : null;
    const attendanceDiff = onSiteCount !== null ? Math.abs(onSiteCount - checkedIn.length) : null;

    const s = series.find((sr) => sr.id === event.seriesId);
    const seriesName = s ? s.title : null;

    return {
      eventId: event.id,
      book: event.book,
      host: event.host,
      time: event.time,
      status: event.status,
      seriesId: event.seriesId || null,
      seriesName,
      reviewRequired: event.reviewRequired || false,
      limit,
      totalSignups: eventSignups.length,
      approvedCount: approved.length,
      regularCount: regular.length,
      waitlistCount: waitlist.length,
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      checkedInCount: checkedIn.length,
      promotedCount: promoted.length,
      signupConversionRate,
      fullnessRate,
      waitlistPromotionRate,
      checkinRate,
      rejectionRate,
      isEnded,
      hasReview,
      reviewNote: review.note || '',
      onSiteCount,
      walkInCount,
      absenceReasons: review.absenceReasons || '',
      followUpReaders: review.followUpReaders || '',
      recommendedBooks: review.recommendedBooks || '',
      reviewUpdatedAt: review.updatedAt || '',
      attendanceDiff
    };
  });
}

export function getAggregateStats(eventStatsList) {
  if (eventStatsList.length === 0) {
    return {
      totalEvents: 0,
      totalSignups: 0,
      totalRegular: 0,
      totalWaitlist: 0,
      totalCheckedIn: 0,
      totalPromoted: 0,
      totalRejected: 0,
      avgConversionRate: 0,
      avgFullnessRate: 0,
      avgWaitlistPromotionRate: 0,
      totalPendingBacklog: 0,
      avgCheckinRate: 0,
      avgRejectionRate: 0,
      fullEvents: 0,
      lowCheckinEvents: 0,
      lowFullnessEvents: 0,
      highRejectionEvents: 0
    };
  }

  const totalEvents = eventStatsList.length;
  const totalSignups = eventStatsList.reduce((sum, e) => sum + e.totalSignups, 0);
  const totalRegular = eventStatsList.reduce((sum, e) => sum + e.regularCount, 0);
  const totalWaitlist = eventStatsList.reduce((sum, e) => sum + e.waitlistCount, 0);
  const totalCheckedIn = eventStatsList.reduce((sum, e) => sum + e.checkedInCount, 0);
  const totalPromoted = eventStatsList.reduce((sum, e) => sum + e.promotedCount, 0);
  const totalRejected = eventStatsList.reduce((sum, e) => sum + e.rejectedCount, 0);
  const avgConversionRate = Math.round(
    eventStatsList.reduce((sum, e) => sum + e.signupConversionRate, 0) / totalEvents
  );
  const avgFullnessRate = Math.round(
    eventStatsList.reduce((sum, e) => sum + e.fullnessRate, 0) / totalEvents
  );
  const waitlistEvents = eventStatsList.filter((e) => (e.waitlistCount + e.promotedCount) > 0);
  const avgWaitlistPromotionRate = waitlistEvents.length > 0
    ? Math.round(waitlistEvents.reduce((sum, e) => sum + e.waitlistPromotionRate, 0) / waitlistEvents.length)
    : 0;
  const totalPendingBacklog = eventStatsList.reduce((sum, e) => sum + e.pendingCount, 0);
  const eventsWithRegular = eventStatsList.filter((e) => e.regularCount > 0);
  const avgCheckinRate = eventsWithRegular.length > 0
    ? Math.round(eventsWithRegular.reduce((sum, e) => sum + e.checkinRate, 0) / eventsWithRegular.length)
    : 0;
  const eventsWithSignups = eventStatsList.filter((e) => e.totalSignups > 0);
  const avgRejectionRate = eventsWithSignups.length > 0
    ? Math.round(eventsWithSignups.reduce((sum, e) => sum + e.rejectionRate, 0) / eventsWithSignups.length)
    : 0;
  const fullEvents = eventStatsList.filter((e) => e.fullnessRate >= 100).length;
  const lowCheckinEvents = eventStatsList.filter((e) => e.regularCount > 0 && e.checkinRate < 50).length;
  const lowFullnessEvents = eventStatsList.filter((e) => e.fullnessRate < 30).length;
  const highRejectionEvents = eventStatsList.filter((e) => e.totalSignups > 0 && e.rejectionRate >= 30).length;

  return {
    totalEvents,
    totalSignups,
    totalRegular,
    totalWaitlist,
    totalCheckedIn,
    totalPromoted,
    totalRejected,
    avgConversionRate,
    avgFullnessRate,
    avgWaitlistPromotionRate,
    totalPendingBacklog,
    avgCheckinRate,
    avgRejectionRate,
    fullEvents,
    lowCheckinEvents,
    lowFullnessEvents,
    highRejectionEvents
  };
}

export function getSeriesStats(eventStatsList) {
  const grouped = {};
  eventStatsList.forEach((stat) => {
    const key = stat.seriesId || '__standalone__';
    if (!grouped[key]) {
      grouped[key] = {
        seriesId: stat.seriesId,
        seriesName: stat.seriesName || '单场活动',
        events: []
      };
    }
    grouped[key].events.push(stat);
  });

  return Object.values(grouped).map((group) => {
    const agg = getAggregateStats(group.events);
    return {
      seriesId: group.seriesId,
      seriesName: group.seriesName,
      eventCount: group.events.length,
      ...agg
    };
  }).sort((a, b) => b.eventCount - a.eventCount);
}

export function getTimeTrend(eventStatsList, granularity = 'month') {
  const grouped = {};
  eventStatsList.forEach((stat) => {
    let key;
    if (granularity === 'week') {
      const d = new Date(stat.time);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      key = monday.toISOString().slice(0, 10);
    } else {
      key = stat.time.slice(0, 7);
    }
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(stat);
  });

  return Object.keys(grouped).sort().map((key) => {
    const stats = grouped[key];
    const agg = getAggregateStats(stats);
    return {
      period: key,
      eventCount: stats.length,
      totalSignups: agg.totalSignups,
      avgConversionRate: agg.avgConversionRate,
      avgFullnessRate: agg.avgFullnessRate,
      avgCheckinRate: agg.avgCheckinRate
    };
  });
}

export function filterEvents(events, { dateFrom, dateTo, seriesId, status } = {}) {
  return events.filter((event) => {
    if (dateFrom && event.time < dateFrom) return false;
    if (dateTo && event.time > dateTo + 'T23:59') return false;
    if (seriesId && event.seriesId !== seriesId) return false;
    if (status && event.status !== status) return false;
    return true;
  });
}

export function getAnomalies(eventStatsList) {
  const anomalies = [];

  eventStatsList.forEach((stat) => {
    if (stat.pendingCount > 0) {
      anomalies.push({
        type: '审核积压',
        severity: stat.pendingCount >= 5 ? 'high' : 'medium',
        eventId: stat.eventId,
        book: stat.book,
        detail: `${stat.pendingCount}人待审核`,
        metric: 'pendingCount',
        value: stat.pendingCount,
        navigateTarget: { type: 'pending', eventId: stat.eventId }
      });
    }

    if (stat.regularCount > 0 && stat.checkinRate < 50) {
      anomalies.push({
        type: '签到率低',
        severity: stat.checkinRate < 30 ? 'high' : 'medium',
        eventId: stat.eventId,
        book: stat.book,
        detail: `签到率${stat.checkinRate}%`,
        metric: 'checkinRate',
        value: stat.checkinRate,
        navigateTarget: { type: 'checkin', eventId: stat.eventId }
      });
    }

    if (stat.fullnessRate >= 100 && stat.waitlistCount > 0) {
      anomalies.push({
        type: '满员候补',
        severity: stat.waitlistCount >= 3 ? 'high' : 'low',
        eventId: stat.eventId,
        book: stat.book,
        detail: `${stat.waitlistCount}人候补`,
        metric: 'waitlistCount',
        value: stat.waitlistCount,
        navigateTarget: { type: 'waitlist', eventId: stat.eventId }
      });
    }

    if (stat.totalSignups > 0 && stat.signupConversionRate < 60) {
      anomalies.push({
        type: '转化率低',
        severity: stat.signupConversionRate < 40 ? 'high' : 'medium',
        eventId: stat.eventId,
        book: stat.book,
        detail: `转化率${stat.signupConversionRate}%`,
        metric: 'signupConversionRate',
        value: stat.signupConversionRate,
        navigateTarget: { type: 'rejected', eventId: stat.eventId }
      });
    }

    if (stat.fullnessRate < 30 && stat.limit > 0) {
      anomalies.push({
        type: '满员率低',
        severity: stat.fullnessRate < 15 ? 'high' : 'low',
        eventId: stat.eventId,
        book: stat.book,
        detail: `满员率${stat.fullnessRate}%`,
        metric: 'fullnessRate',
        value: stat.fullnessRate,
        navigateTarget: { type: 'regular', eventId: stat.eventId }
      });
    }

    if (stat.totalSignups > 2 && stat.rejectionRate >= 30) {
      anomalies.push({
        type: '拒绝率偏高',
        severity: stat.rejectionRate >= 50 ? 'high' : 'medium',
        eventId: stat.eventId,
        book: stat.book,
        detail: `拒绝率${stat.rejectionRate}%`,
        metric: 'rejectionRate',
        value: stat.rejectionRate,
        navigateTarget: { type: 'rejected', eventId: stat.eventId }
      });
    }

    if (stat.isEnded && !stat.hasReview && stat.regularCount > 0) {
      anomalies.push({
        type: '未填复盘',
        severity: 'low',
        eventId: stat.eventId,
        book: stat.book,
        detail: '活动已结束，尚未填写复盘',
        metric: 'hasReview',
        value: 0,
        navigateTarget: { type: 'review', eventId: stat.eventId }
      });
    }

    if (stat.isEnded && stat.hasReview && stat.attendanceDiff !== null && stat.attendanceDiff > 3) {
      anomalies.push({
        type: '人数差异',
        severity: stat.attendanceDiff >= 5 ? 'high' : 'medium',
        eventId: stat.eventId,
        book: stat.book,
        detail: `现场${stat.onSiteCount}人 vs 签到${stat.checkedInCount}人，差${stat.attendanceDiff}人`,
        metric: 'attendanceDiff',
        value: stat.attendanceDiff,
        navigateTarget: { type: 'review', eventId: stat.eventId }
      });
    }

    if (stat.isEnded && stat.regularCount > 0 && stat.checkinRate < 80 && stat.hasReview && !stat.absenceReasons) {
      anomalies.push({
        type: '缺席未记录原因',
        severity: 'medium',
        eventId: stat.eventId,
        book: stat.book,
        detail: `签到率${stat.checkinRate}%，未记录缺席原因`,
        metric: 'absenceReasons',
        value: stat.checkinRate,
        navigateTarget: { type: 'review', eventId: stat.eventId }
      });
    }
  });

  return anomalies.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function getSignupGroupsSummary(eventStatsList, signups) {
  const filteredEventIds = new Set(eventStatsList.map((s) => s.eventId));
  const filteredSignups = signups.filter((s) => filteredEventIds.has(s.eventId));
  const groups = {
    total: filteredSignups.length,
    pending: filteredSignups.filter((s) => isPending(s.status)).length,
    approved: filteredSignups.filter((s) => isApproved(s.status)).length,
    rejected: filteredSignups.filter((s) => isRejected(s.status)).length,
    regular: filteredSignups.filter((s) => isRegular(s.status)).length,
    waitlist: filteredSignups.filter((s) => isWaitlist(s.status)).length,
    checkedIn: filteredSignups.filter((s) => isCheckedIn(s.status)).length,
    promoted: filteredSignups.filter((s) => isPromoted(s.status)).length
  };
  return groups;
}

export function getEventsByStatusBucket(eventStatsList) {
  return {
    open: eventStatsList.filter((s) => s.status === '开放报名').length,
    closed: eventStatsList.filter((s) => s.status === '已关闭').length
  };
}

export function buildOpsDashboardData(events, signups, series, filters = {}) {
  const filteredEvents = filterEvents(events, filters);
  const eventStats = getEventStats(filteredEvents, signups, series);
  const aggregate = getAggregateStats(eventStats);
  const seriesStats = getSeriesStats(eventStats);
  const timeTrend = getTimeTrend(eventStats, filters.granularity || 'month');
  const anomalies = getAnomalies(eventStats);
  const groupsSummary = getSignupGroupsSummary(eventStats, signups);
  const statusBucket = getEventsByStatusBucket(eventStats);

  return {
    filteredEvents,
    eventStats,
    aggregate,
    seriesStats,
    timeTrend,
    anomalies,
    groupsSummary,
    statusBucket
  };
}

export function buildFiltersFromView(view) {
  if (!view) {
    return {
      dateFrom: undefined,
      dateTo: undefined,
      seriesId: undefined,
      status: undefined,
      granularity: 'month'
    };
  }
  return {
    dateFrom: view.filters?.dateFrom || undefined,
    dateTo: view.filters?.dateTo || undefined,
    seriesId: view.filters?.seriesId || undefined,
    status: view.filters?.status || undefined,
    granularity: view.granularity || 'month'
  };
}
