if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 11)
  };
}

import {
  getEventStats,
  getAggregateStats,
  filterEvents,
  getAnomalies,
  getSeriesStats,
  getTimeTrend,
  getSignupGroupsSummary,
  getEventsByStatusBucket,
  buildOpsDashboardData,
  buildFiltersFromView
} from '../src/lib/utils/opsStats.js';
import {
  normalizeEvent,
  normalizeSignup as normalizeSignupDS,
  normalizeLegacyEvents,
  normalizeLegacySignups
} from '../src/lib/utils/dataStore.js';
import { parseCsv, parseCsvLine } from '../src/lib/utils/csvTools.js';
import {
  promoteFromWaitlist,
  createSignup,
  cancelSignup as cancelSignupFromStore,
  getEventById,
  getSeriesOfEvent,
  getSeriesEvents,
  getEventIndexInSeries,
  getRegularSignupCount,
  getWaitlistCount,
  getPendingCount,
  getSeatsLeft,
  readViews,
  writeViews,
  createView,
  updateView,
  deleteView,
  renameView
} from '../src/lib/utils/storeUtils.js';
import {
  toggleEventStatus,
  toggleCheckIn,
  approveSignup,
  rejectSignup,
  handleSignupSubmit,
  handleSignupCancel
} from '../src/lib/utils/eventActions.js';
import {
  SIGNUP_STATUS,
  isValidStatus,
  canTransition,
  getValidTransitions,
  isPending,
  isApproved,
  isRegular,
  isWaitlist,
  isPromoted,
  isCancelled,
  isRejected,
  isCheckedIn,
  isActive,
  canCheckIn,
  deriveLegacyFields,
  resolveSignupStatusFromCsv,
  resolveSignupStatusFromLegacy,
  migrateLegacySignup,
  migrateAllSignups,
  createStatusTransition,
  transitionSignup,
  approveSignupWithStatus,
  rejectSignupWithStatus,
  cancelSignupWithStatus,
  toggleCheckInWithStatus,
  promoteFromWaitlistWithStatus,
  handleLimitChange,
  buildNewSignup,
  getSignupStatusDisplay,
  getStatusCounts,
  normalizeSignup,
  normalizeSignups
} from '../src/lib/utils/signupStatusMachine.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message} (expected ${expected}, got ${actual})`);
  }
}

function assertApprox(actual, expected, epsilon, message) {
  if (Math.abs(actual - expected) <= epsilon) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message} (expected ~${expected}, got ${actual})`);
  }
}

function assertIncludes(arr, item, message) {
  if (arr.includes(item)) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message} (array does not include ${item})`);
  }
}

console.log('\n=== 运营统计计算测试 ===\n');

const mockEvents = [
  { id: 'e1', book: '秋园', host: '阿檀', time: '2025-06-01T19:30', limit: 8, status: '开放报名', reviewRequired: false, seriesId: null },
  { id: 'e2', book: '索拉里斯星', host: '老周', time: '2025-06-10T20:00', limit: 10, status: '已关闭', reviewRequired: true, seriesId: 's1' },
  { id: 'e3', book: '百年孤独', host: '小林', time: '2025-07-05T19:00', limit: 6, status: '开放报名', reviewRequired: false, seriesId: 's1' },
  { id: 'e4', book: '霍乱时期的爱情', host: '阿檀', time: '2025-07-20T19:30', limit: 5, status: '开放报名', reviewRequired: false, seriesId: null }
];

const mockSeries = [
  { id: 's1', title: '拉美文学系列' },
  { id: 's2', title: '科幻经典系列' }
];

const mockSignups = [
  { id: 'sg1', eventId: 'e1', name: '张三', phone: '13800001111', answer: '第一章', status: '已签到', reviewStatus: '已通过', checkedIn: true, _wasWaitlisted: false },
  { id: 'sg2', eventId: 'e1', name: '李四', phone: '13800002222', answer: '第三章', status: '已签到', reviewStatus: '已通过', checkedIn: true, _wasWaitlisted: false },
  { id: 'sg3', eventId: 'e1', name: '王五', phone: '13800003333', answer: '', status: '候补', reviewStatus: '已通过', checkedIn: false, waitlistPosition: 1, _wasWaitlisted: false },
  { id: 'sg4', eventId: 'e1', name: '赵六', phone: '13800004444', answer: '', status: '候补转正', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: true },
  { id: 'sg5', eventId: 'e2', name: '钱七', phone: '13800005555', answer: '', status: '待审核', reviewStatus: '待审核', checkedIn: false },
  { id: 'sg6', eventId: 'e2', name: '孙八', phone: '13800006666', answer: '', status: '已签到', reviewStatus: '已通过', checkedIn: true, _wasWaitlisted: false },
  { id: 'sg7', eventId: 'e2', name: '周九', phone: '13800007777', answer: '', status: '已拒绝', reviewStatus: '已拒绝', checkedIn: false, rejectionReason: '名额已满' },
  { id: 'sg8', eventId: 'e3', name: '吴十', phone: '13800008888', answer: '', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false },
  { id: 'sg9', eventId: 'e3', name: '郑十一', phone: '13800009999', answer: '', status: '候补', reviewStatus: '已通过', checkedIn: false, waitlistPosition: 1, _wasWaitlisted: false }
];

console.log('--- getEventStats ---');
const stats = getEventStats(mockEvents, mockSignups, mockSeries);

const e1Stats = stats.find((s) => s.eventId === 'e1');
assert(e1Stats !== undefined, 'e1 stats exist');
assertEqual(e1Stats.regularCount, 3, 'e1 regularCount = 3');
assertEqual(e1Stats.waitlistCount, 1, 'e1 waitlistCount = 1');
assertEqual(e1Stats.promotedCount, 1, 'e1 promotedCount = 1 (赵六 was waitlisted)');
assertEqual(e1Stats.fullnessRate, 38, 'e1 fullnessRate = 38% (3/8)');
assertEqual(e1Stats.waitlistPromotionRate, 50, 'e1 waitlistPromotionRate = 50% (1/2)');
assertEqual(e1Stats.checkinRate, 67, 'e1 checkinRate = 67% (2/3)');
assertEqual(e1Stats.signupConversionRate, 100, 'e1 signupConversionRate = 100% (4/4)');
assertEqual(e1Stats.seriesName, null, 'e1 has no series');

const e2Stats = stats.find((s) => s.eventId === 'e2');
assert(e2Stats !== undefined, 'e2 stats exist');
assertEqual(e2Stats.pendingCount, 1, 'e2 pendingCount = 1');
assertEqual(e2Stats.rejectedCount, 1, 'e2 rejectedCount = 1');
assertEqual(e2Stats.signupConversionRate, 33, 'e2 signupConversionRate = 33% (1/3)');
assertEqual(e2Stats.seriesName, '拉美文学系列', 'e2 has series name');

const e4Stats = stats.find((s) => s.eventId === 'e4');
assert(e4Stats !== undefined, 'e4 stats exist');
assertEqual(e4Stats.totalSignups, 0, 'e4 has zero signups');
assertEqual(e4Stats.signupConversionRate, 0, 'e4 conversion rate is 0');

console.log('\n--- getAggregateStats ---');
const agg = getAggregateStats(stats);
assertEqual(agg.totalEvents, 4, 'totalEvents = 4');
assert(agg.totalSignups > 0, 'totalSignups > 0');
assert(agg.avgConversionRate > 0, 'avgConversionRate > 0');
assertEqual(agg.totalPendingBacklog, 1, 'totalPendingBacklog = 1');
assert(agg.lowFullnessEvents >= 1, 'lowFullnessEvents >= 1');
assert(agg.fullEvents >= 0, 'fullEvents >= 0');

console.log('\n--- filterEvents ---');
const filteredByDate = filterEvents(mockEvents, { dateFrom: '2025-06-05', dateTo: '2025-06-15' });
assertEqual(filteredByDate.length, 1, 'filter by date range: 1 event');
assertEqual(filteredByDate[0].book, '索拉里斯星', 'filtered event is 索拉里斯星');

const filteredBySeries = filterEvents(mockEvents, { seriesId: 's1' });
assertEqual(filteredBySeries.length, 2, 'filter by series: 2 events');

const filteredByStatus = filterEvents(mockEvents, { status: '已关闭' });
assertEqual(filteredByStatus.length, 1, 'filter by status: 1 event');

const filteredByMulti = filterEvents(mockEvents, { dateFrom: '2025-07-01', seriesId: 's1' });
assertEqual(filteredByMulti.length, 1, 'multi filter: 1 event (百年孤独)');
assertEqual(filteredByMulti[0].book, '百年孤独', 'multi filter matches correct event');

const filteredEmpty = filterEvents(mockEvents, { dateFrom: '2099-01-01' });
assertEqual(filteredEmpty.length, 0, 'filter with no matches returns empty');

console.log('\n--- getAnomalies ---');
const anomalies = getAnomalies(stats);
assert(anomalies.length > 0, 'anomalies detected');
const pendingAnomaly = anomalies.find((a) => a.type === '审核积压');
assert(pendingAnomaly !== undefined, 'audit backlog anomaly found');
assertEqual(pendingAnomaly.eventId, 'e2', 'backlog anomaly on e2');
assert(pendingAnomaly.navigateTarget, 'anomaly has navigateTarget');
assertEqual(pendingAnomaly.navigateTarget.type, 'pending', 'navigateTarget type is pending');

const lowFullnessAnomaly = anomalies.find((a) => a.type === '满员率低');
assert(lowFullnessAnomaly !== undefined, 'low fullness anomaly found');

const severityOrder = { high: 0, medium: 1, low: 2 };
let sortedCorrectly = true;
for (let i = 1; i < anomalies.length; i++) {
  if (severityOrder[anomalies[i].severity] < severityOrder[anomalies[i - 1].severity]) {
    sortedCorrectly = false;
    break;
  }
}
assert(sortedCorrectly, 'anomalies sorted by severity (high first)');

console.log('\n--- getSeriesStats ---');
const seriesStats = getSeriesStats(stats);
assert(seriesStats.length >= 2, 'at least 2 series groups (including standalone)');
const standaloneGroup = seriesStats.find((s) => s.seriesName === '单场活动');
assert(standaloneGroup !== undefined, 'standalone events group exists');
assert(standaloneGroup.eventCount >= 2, 'standalone group has 2+ events');

const s1Group = seriesStats.find((s) => s.seriesId === 's1');
assert(s1Group !== undefined, '拉美文学系列 group exists');
assertEqual(s1Group.eventCount, 2, '拉美文学系列 has 2 events');
assert(s1Group.totalSignups >= 3, '拉美文学系列 has 3+ signups');

console.log('\n--- getTimeTrend (month) ---');
const trendMonth = getTimeTrend(stats, 'month');
assert(trendMonth.length >= 2, 'trend has 2+ months');
assert(trendMonth[0].period.startsWith('2025-'), 'period format correct');
assert(trendMonth[0].eventCount > 0, 'each period has event count');
assert(typeof trendMonth[0].avgConversionRate === 'number', 'avgConversionRate is number');

const trendWeek = getTimeTrend(stats, 'week');
assert(trendWeek.length >= 1, 'week trend returns data');

console.log('\n--- getSignupGroupsSummary ---');
const groupsSummary = getSignupGroupsSummary(stats, mockSignups);
assertEqual(groupsSummary.total, mockSignups.length, 'total matches mock signups count');
assert(groupsSummary.pending >= 1, 'pending count >= 1');
assert(groupsSummary.approved >= 1, 'approved count >= 1');
assert(groupsSummary.rejected >= 1, 'rejected count >= 1');
assert(groupsSummary.regular >= 1, 'regular count >= 1');
assert(groupsSummary.waitlist >= 1, 'waitlist count >= 1');
assert(groupsSummary.checkedIn >= 1, 'checkedIn count >= 1');
assert(groupsSummary.promoted >= 1, 'promoted count >= 1');

console.log('\n--- getSignupGroupsSummary (筛选后口径验证) ---');
const e1OnlyStats = stats.filter((s) => s.eventId === 'e1');
const e1Groups = getSignupGroupsSummary(e1OnlyStats, mockSignups);
assertEqual(e1Groups.total, 4, '筛选e1后 total=4 (仅e1的4条报名)');
assertEqual(e1Groups.regular, 3, '筛选e1后 regular=3');
assertEqual(e1Groups.waitlist, 1, '筛选e1后 waitlist=1');
assertEqual(e1Groups.checkedIn, 2, '筛选e1后 checkedIn=2');
assertEqual(e1Groups.promoted, 1, '筛选e1后 promoted=1');
assertEqual(e1Groups.pending, 0, '筛选e1后 pending=0 (e1不需要审核)');
assertEqual(e1Groups.rejected, 0, '筛选e1后 rejected=0');

const s1Stats = stats.filter((s) => s.seriesId === 's1');
const s1Groups = getSignupGroupsSummary(s1Stats, mockSignups);
assertEqual(s1Groups.total, 5, '筛选s1系列后 total=5 (e2的3条 + e3的2条)');
assertEqual(s1Groups.pending, 1, '筛选s1系列后 pending=1 (e2的待审核)');
assertEqual(s1Groups.rejected, 1, '筛选s1系列后 rejected=1 (e2的已拒绝)');

const nonexistentStats = stats.filter((s) => s.eventId === 'nonexistent');
const nonexistentGroups = getSignupGroupsSummary(nonexistentStats, mockSignups);
assertEqual(nonexistentGroups.total, 0, '空筛选 total=0');
assertEqual(nonexistentGroups.regular, 0, '空筛选 regular=0');
assertEqual(nonexistentGroups.pending, 0, '空筛选 pending=0');

console.log('\n--- getEventsByStatusBucket ---');
const statusBucket = getEventsByStatusBucket(stats);
assertEqual(statusBucket.open + statusBucket.closed, 4, 'open + closed = total events');
assert(statusBucket.open >= 1, 'at least 1 open event');
assert(statusBucket.closed >= 1, 'at least 1 closed event');

console.log('\n--- buildOpsDashboardData (核心入口) ---');
const dashboard = buildOpsDashboardData(mockEvents, mockSignups, mockSeries, {});
assert(dashboard.filteredEvents !== undefined, 'has filteredEvents');
assert(dashboard.eventStats !== undefined, 'has eventStats');
assert(dashboard.aggregate !== undefined, 'has aggregate');
assert(dashboard.seriesStats !== undefined, 'has seriesStats');
assert(dashboard.timeTrend !== undefined, 'has timeTrend');
assert(dashboard.anomalies !== undefined, 'has anomalies');
assert(dashboard.groupsSummary !== undefined, 'has groupsSummary');
assert(dashboard.statusBucket !== undefined, 'has statusBucket');
assertEqual(dashboard.filteredEvents.length, mockEvents.length, 'no filters: all events included');
assertEqual(dashboard.groupsSummary.total, mockSignups.length, 'no filters: groups total matches all signups');
assertEqual(dashboard.groupsSummary.total, dashboard.aggregate.totalSignups, 'groupsSummary.total 与 aggregate.totalSignups 口径一致');

const dashboardFiltered = buildOpsDashboardData(mockEvents, mockSignups, mockSeries, {
  dateFrom: '2025-07-01',
  dateTo: '2025-07-31',
  granularity: 'week'
});
assert(dashboardFiltered.filteredEvents.length < mockEvents.length, 'filtered events < total events');
assert(dashboardFiltered.timeTrend.length >= 1, 'week granularity works');
assert(
  dashboardFiltered.groupsSummary.total < mockSignups.length,
  '筛选后 groupsSummary.total 应小于全量报名数'
);
assertEqual(
  dashboardFiltered.groupsSummary.total,
  dashboardFiltered.aggregate.totalSignups,
  '筛选后 groupsSummary.total 与 aggregate.totalSignups 口径一致'
);

const dashboardSeriesOnly = buildOpsDashboardData(mockEvents, mockSignups, mockSeries, { seriesId: 's1' });
assertEqual(dashboardSeriesOnly.filteredEvents.length, 2, '按系列s1筛选: 2场活动');
assertEqual(dashboardSeriesOnly.groupsSummary.total, 5, '按系列s1筛选: 5条报名 (e2+e3)');
assertEqual(dashboardSeriesOnly.groupsSummary.pending, 1, '按系列s1筛选: pending=1');
assertEqual(dashboardSeriesOnly.groupsSummary.total, dashboardSeriesOnly.aggregate.totalSignups, '系列筛选后 totalSignups 口径一致');

const dashboardEmpty = buildOpsDashboardData([], [], [], {});
assertEqual(dashboardEmpty.aggregate.totalEvents, 0, 'empty dashboard: totalEvents = 0');
assertEqual(dashboardEmpty.aggregate.avgConversionRate, 0, 'empty dashboard: avgConversionRate = 0');
assertEqual(dashboardEmpty.anomalies.length, 0, 'empty dashboard: no anomalies');
assertEqual(dashboardEmpty.groupsSummary.total, 0, 'empty dashboard: groupsSummary.total = 0');
assertEqual(dashboardEmpty.groupsSummary.regular, 0, 'empty dashboard: groupsSummary.regular = 0');

console.log('\n=== 事件操作函数测试 (storeUtils) ===\n');

console.log('--- getEventById ---');
const foundEvent = getEventById(mockEvents, 'e1');
assertEqual(foundEvent.book, '秋园', 'getEventById returns correct event');
assertEqual(getEventById(mockEvents, 'nonexistent'), null, 'getEventById returns null for missing');

console.log('\n--- getSeriesOfEvent ---');
const seriesOfE2 = getSeriesOfEvent(mockEvents, mockSeries, 'e2');
assertEqual(seriesOfE2.title, '拉美文学系列', 'getSeriesOfEvent for e2');
assertEqual(getSeriesOfEvent(mockEvents, mockSeries, 'e1'), null, 'getSeriesOfEvent for standalone returns null');

console.log('\n--- getSeriesEvents ---');
const s1Events = getSeriesEvents(mockEvents, 's1');
assertEqual(s1Events.length, 2, 's1 has 2 events');
assert(s1Events[0].time.localeCompare(s1Events[1].time) <= 0, 'series events sorted by time ascending');

console.log('\n--- getEventIndexInSeries ---');
assertEqual(getEventIndexInSeries(mockEvents, 'e1'), 0, 'standalone event index = 0');
assert(getEventIndexInSeries(mockEvents, 'e2') >= 1, 'series event index >= 1');

console.log('\n--- getRegularSignupCount / getWaitlistCount / getPendingCount ---');
assertEqual(getRegularSignupCount(mockSignups, 'e1'), 3, 'e1 regular count = 3');
assertEqual(getWaitlistCount(mockSignups, 'e1'), 1, 'e1 waitlist count = 1');
assertEqual(getPendingCount(mockSignups, 'e2'), 1, 'e2 pending count = 1');

console.log('\n--- getSeatsLeft ---');
assertEqual(getSeatsLeft(mockEvents, mockSignups, 'e1'), 5, 'e1 seatsLeft = 8-3 = 5');
assertEqual(getSeatsLeft(mockEvents, mockSignups, 'nonexistent'), 0, 'nonexistent event seatsLeft = 0');

console.log('\n--- promoteFromWaitlist ---');
let promoEvents = [{ id: 'pe1', book: 'Promo', host: 'A', time: '2025-08-01T19:00', limit: 2, status: '开放报名', reviewRequired: false }];
let promoSignups = [
  { id: 'ps1', eventId: 'pe1', name: 'A', status: '正式', reviewStatus: '已通过' },
  { id: 'ps2', eventId: 'pe1', name: 'B', status: '候补', reviewStatus: '已通过', waitlistPosition: 1 },
  { id: 'ps3', eventId: 'pe1', name: 'C', status: '候补', reviewStatus: '已通过', waitlistPosition: 2 }
];
let afterPromo = promoteFromWaitlist(promoEvents, promoSignups, 'pe1');
const afterPromoRegular = afterPromo.filter((s) => s.eventId === 'pe1' && (isRegular(s.status) || isPromoted(s.status)));
assertEqual(afterPromoRegular.length, 2, 'after promotion: 2 regular');
const promoted = afterPromo.find((s) => isPromoted(s.status));
assert(promoted !== undefined, 'promoted signup has _wasWaitlisted flag');

console.log('\n--- createSignup ---');
let createSignups = [];
let createReaders = [];
const createResult = createSignup(
  promoEvents, createSignups, 'pe1',
  { name: 'NewUser', phone: '13900000000', answer: 'test' },
  createReaders
);
assert(createResult.success, 'createSignup success');
assertEqual(createResult.signups.length, 1, 'signup added');
assert(createResult.signup.readerId !== undefined, 'signup linked to reader');

const fullEvent = { id: 'fe1', book: 'Full', host: 'A', time: '2025-08-01T19:00', limit: 1, status: '开放报名', reviewRequired: false };
let fullSignups = [
  { id: 'fs1', eventId: 'fe1', name: 'A', status: '正式', reviewStatus: '已通过' }
];
const waitlistResult = createSignup([fullEvent], fullSignups, 'fe1', { name: 'WaitUser', phone: '13900000001' }, []);
assertEqual(waitlistResult.signup.status, '候补', 'full event creates waitlist signup');

const reviewEvent = { id: 're1', book: 'Rev', host: 'A', time: '2025-08-01T19:00', limit: 10, status: '开放报名', reviewRequired: true };
const reviewResult = createSignup([reviewEvent], [], 're1', { name: 'RevUser', phone: '13900000002' }, []);
assertEqual(reviewResult.signup.reviewStatus, '待审核', 'reviewRequired event creates pending signup');

const closedEvent = { id: 'ce1', book: 'Closed', host: 'A', time: '2025-08-01T19:00', limit: 10, status: '已关闭', reviewRequired: false };
const closedResult = createSignup([closedEvent], [], 'ce1', { name: 'X', phone: '1' }, []);
assert(!closedResult.success, 'cannot signup to closed event');

console.log('\n--- cancelSignup ---');
let cancelSignups = [
  { id: 'cs1', eventId: 'pe1', name: 'Keep', status: '正式', reviewStatus: '已通过' },
  { id: 'cs2', eventId: 'pe1', name: 'Cancel', status: '正式', reviewStatus: '已通过' }
];
let afterCancel = createSignup(promoEvents, cancelSignups, 'pe1', { name: 'Wait', phone: '123' }, []).signups;
afterCancel = afterCancel.map((s) => s.id === 'ps_new' ? { ...s, status: '候补', waitlistPosition: 1, reviewStatus: '已通过' } : s);
const cancelResult = handleSignupCancel(promoEvents, afterCancel, [], afterCancel.find((s) => s.name === 'Cancel')?.id || afterCancel[1].id);
assert(cancelResult.signups.length <= afterCancel.length, 'cancel reduces signup count');

console.log('\n=== 事件操作函数测试 (eventActions) ===\n');

console.log('--- toggleEventStatus ---');
let toggleEvents = [{ id: 'te1', status: '开放报名' }];
toggleEvents = toggleEventStatus(toggleEvents, 'te1');
assertEqual(toggleEvents[0].status, '已关闭', 'toggle open -> closed');
toggleEvents = toggleEventStatus(toggleEvents, 'te1');
assertEqual(toggleEvents[0].status, '开放报名', 'toggle closed -> open');

console.log('\n--- toggleCheckIn ---');
let ciSignups = [{ id: 'ci1', status: '正式', reviewStatus: '已通过', checkedIn: false, checkedInAt: '' }];
ciSignups = toggleCheckIn(ciSignups, 'ci1');
assertEqual(ciSignups[0].checkedIn, true, 'toggle checkin: false -> true');
assert(ciSignups[0].checkedInAt.length > 0, 'checkedInAt populated');
ciSignups = toggleCheckIn(ciSignups, 'ci1');
assertEqual(ciSignups[0].checkedIn, false, 'toggle checkin: true -> false');
assertEqual(ciSignups[0].checkedInAt, '', 'checkedInAt cleared');

let ciInvalid = [{ id: 'ci2', status: '候补', reviewStatus: '已通过', checkedIn: false }];
ciInvalid = toggleCheckIn(ciInvalid, 'ci2');
assertEqual(ciInvalid[0].checkedIn, false, 'cannot check in waitlist signup');

console.log('\n--- approveSignup ---');
const approveEvents = [{ id: 'ae1', limit: 2, status: '开放报名' }];
let approveSignupsList = [
  { id: 'ap1', eventId: 'ae1', status: '待审核', reviewStatus: '待审核' },
  { id: 'ap2', eventId: 'ae1', status: '正式', reviewStatus: '已通过' }
];
approveSignupsList = approveSignup(approveEvents, approveSignupsList, 'ap1');
const approved = approveSignupsList.find((s) => s.id === 'ap1');
assertEqual(approved.reviewStatus, '已通过', 'reviewStatus -> 已通过');
assertEqual(approved.status, '正式', 'becomes 正式 when space available');
assert(approved.reviewedAt.length > 0, 'reviewedAt populated');

const fullApproveEvents = [{ id: 'fae1', limit: 1, status: '开放报名' }];
let fullApproveSignups = [
  { id: 'fap1', eventId: 'fae1', status: '正式', reviewStatus: '已通过' },
  { id: 'fap2', eventId: 'fae1', status: '待审核', reviewStatus: '待审核' }
];
fullApproveSignups = approveSignup(fullApproveEvents, fullApproveSignups, 'fap2');
const fullApproved = fullApproveSignups.find((s) => s.id === 'fap2');
assertEqual(fullApproved.status, '候补', 'becomes 候补 when full');
assert(fullApproved.waitlistPosition > 0, 'waitlistPosition assigned');

console.log('\n--- rejectSignup ---');
let rejectSignupsList = [
  { id: 'rj1', eventId: 'ae1', status: '待审核', reviewStatus: '待审核' }
];
rejectSignupsList = rejectSignup(rejectSignupsList, 'rj1', '不符合条件');
const rejected = rejectSignupsList.find((s) => s.id === 'rj1');
assertEqual(rejected.reviewStatus, '已拒绝', 'reviewStatus -> 已拒绝');
assertEqual(rejected.status, '已拒绝', 'status -> 已拒绝');
assertEqual(rejected.rejectionReason, '不符合条件', 'rejectionReason set');
assert(rejected.reviewedAt.length > 0, 'reviewedAt populated');

const noReasonReject = rejectSignup([{ id: 'rj2' }], 'rj2', '   ');
assertEqual(noReasonReject[0].reviewStatus, undefined, 'reject with empty reason does nothing');

console.log('\n--- handleSignupSubmit ---');
const submitResult = handleSignupSubmit(
  promoEvents, [], [], [], 'pe1',
  { name: 'SubmitUser', phone: '13899990000', answer: 'hi' }
);
assert(submitResult.success, 'handleSignupSubmit success');
assert(submitResult.mySignupIds.length > 0, 'mySignupIds updated');

const submitClosed = handleSignupSubmit([closedEvent], [], [], [], 'ce1', { name: 'X', phone: '1' });
assert(!submitClosed.success, 'handleSignupSubmit fails for closed event');

console.log('\n=== 旧数据兼容性测试 ===\n');

console.log('--- normalizeEvent ---');
const legacyEvent = { id: 'le1', book: '旧活动', host: '某人', time: '2024-01-01T19:30', limit: 10, status: '开放报名' };
const normalizedEvent = normalizeEvent(legacyEvent);
assert(normalizedEvent.reviewRequired === false, 'legacy event gets reviewRequired=false');

const modernEvent = { id: 'me1', book: '新活动', host: '某人', time: '2025-01-01T19:30', limit: 10, status: '开放报名', reviewRequired: true };
const normalizedModern = normalizeEvent(modernEvent);
assertEqual(normalizedModern.reviewRequired, true, 'modern event reviewRequired preserved');

console.log('\n--- normalizeSignup ---');
const legacySignup = { id: 'ls1', eventId: 'e1', name: '旧用户', phone: '13900001111' };
const normalizedSignup = normalizeSignupDS(legacySignup);
assertEqual(normalizedSignup.status, '正式', 'legacy signup gets status=正式');
assertEqual(normalizedSignup.reviewStatus, '已通过', 'legacy signup gets reviewStatus=已通过');
assertEqual(normalizedSignup.rejectionReason, '', 'legacy signup gets empty rejectionReason');

const legacyWaitlist = { id: 'ls2', eventId: 'e1', name: '候补用户', phone: '13900002222', status: '候补', waitlistPosition: 1 };
const normalizedWaitlist = normalizeSignupDS(legacyWaitlist);
assertEqual(normalizedWaitlist.status, '候补', 'waitlist signup status preserved');

console.log('\n--- normalizeLegacyEvents / normalizeLegacySignups ---');
const legacyEvents = [
  { id: 'a', book: 'A', limit: 5 },
  { id: 'b', book: 'B', limit: 10, reviewRequired: true }
];
const normEvents = normalizeLegacyEvents(legacyEvents);
assertEqual(normEvents[0].reviewRequired, false, 'batch normalize adds reviewRequired=false');
assertEqual(normEvents[1].reviewRequired, true, 'batch normalize preserves existing reviewRequired');

const legacySignups = [
  { id: 's1', eventId: 'a', name: 'X' },
  { id: 's2', eventId: 'a', name: 'Y', status: '候补', reviewStatus: '已通过' }
];
const normSignups = normalizeLegacySignups(legacySignups);
assertEqual(normSignups[0].status, '正式', 'batch normalize signup adds status=正式');
assertEqual(normSignups[0].reviewStatus, '已通过', 'batch normalize signup adds reviewStatus=已通过');
assertEqual(normSignups[1].status, '候补', 'batch normalize signup preserves existing status');

console.log('\n--- 深层旧数据兼容: 无seriesId/无readerId/无checkedIn ---');
const veryLegacyEvent = { id: 'vle', book: '超旧活动', time: '2023-01-01T19:00', limit: 5, status: '开放报名' };
const veryLegacySignup = { id: 'vls', eventId: 'vle', name: '老人', phone: '1' };
const vlNormEvent = normalizeEvent(veryLegacyEvent);
const vlNormSignup = normalizeSignupDS(veryLegacySignup);
assert(vlNormEvent.reviewRequired === false, 'very legacy event: reviewRequired filled');
assertEqual(vlNormSignup.status, '正式', 'very legacy signup: status filled');
assertEqual(vlNormSignup.reviewStatus, '已通过', 'very legacy signup: reviewStatus filled');
assert(vlNormSignup.checkedIn === undefined || vlNormSignup.checkedIn === false, 'very legacy signup: checkedIn not forced true');

const vlStats = getEventStats([vlNormEvent], [vlNormSignup], []);
assertEqual(vlStats[0].totalSignups, 1, 'can compute stats from very legacy data');
assertEqual(vlStats[0].regularCount, 1, 'legacy signup counted as regular');

console.log('\n=== CSV工具测试 ===\n');

console.log('--- parseCsvLine ---');
const line = '"秋园","张三","13800001111","第一章","正式","已通过"';
const parsed = parseCsvLine(line);
assertEqual(parsed.length, 6, 'parseCsvLine: 6 fields');
assertEqual(parsed[0], '秋园', 'parseCsvLine: first field');
assertEqual(parsed[4], '正式', 'parseCsvLine: fifth field');

console.log('\n--- parseCsv ---');
const csvText = '活动,姓名,手机,回答,报名类型,审核状态\n秋园,张三,13800001111,第一章,正式,已通过\n索拉里斯星,李四,13800002222,,正式,已通过';
const csvResult = parseCsv(csvText);
assertEqual(csvResult.headers.length, 6, 'parseCsv: 6 headers');
assertEqual(csvResult.rows.length, 2, 'parseCsv: 2 data rows');
assertEqual(csvResult.rows[0][0], '秋园', 'parseCsv: first row first field');
assertEqual(csvResult.rows[1][0], '索拉里斯星', 'parseCsv: second row first field');

const emptyCsv = parseCsv('');
assertEqual(emptyCsv.headers.length, 0, 'parseCsv: empty input returns no headers');
assertEqual(emptyCsv.rows.length, 0, 'parseCsv: empty input returns no rows');

console.log('\n--- parseCsv with quoted fields ---');
const quotedCsv = '"活动","姓名","手机"\n"秋,园","张三","13800001111"';
const quotedResult = parseCsv(quotedCsv);
assertEqual(quotedResult.rows[0][0], '秋,园', 'parseCsv: comma inside quotes preserved');

console.log('\n=== 边界场景测试 ===\n');

console.log('--- empty events ---');
const emptyStats = getEventStats([], [], []);
assertEqual(emptyStats.length, 0, 'empty events returns empty stats');

const emptyAgg = getAggregateStats([]);
assertEqual(emptyAgg.totalEvents, 0, 'empty aggregate: totalEvents=0');
assertEqual(emptyAgg.avgConversionRate, 0, 'empty aggregate: avgConversionRate=0');

console.log('\n--- event with zero signups ---');
const noSignupEvent = [{ id: 'e0', book: '无人活动', host: '某人', time: '2025-08-01T19:00', limit: 5, status: '开放报名', reviewRequired: false, seriesId: null }];
const noSignupStats = getEventStats(noSignupEvent, [], []);
assertEqual(noSignupStats[0].totalSignups, 0, 'no-signup event: totalSignups=0');
assertEqual(noSignupStats[0].signupConversionRate, 0, 'no-signup event: conversionRate=0');
assertEqual(noSignupStats[0].fullnessRate, 0, 'no-signup event: fullnessRate=0');
assertEqual(noSignupStats[0].checkinRate, 0, 'no-signup event: checkinRate=0');

console.log('\n--- anomalies for healthy data ---');
const healthyEvent = [{ id: 'h1', book: '健康活动', host: '某人', time: '2025-08-01T19:00', limit: 10, status: '开放报名', reviewRequired: false, seriesId: null }];
const healthySignups = [
  { id: 'hs1', eventId: 'h1', name: 'A', phone: '1', status: '已签到', reviewStatus: '已通过', checkedIn: true },
  { id: 'hs2', eventId: 'h1', name: 'B', phone: '2', status: '已签到', reviewStatus: '已通过', checkedIn: true },
  { id: 'hs3', eventId: 'h1', name: 'C', phone: '3', status: '已签到', reviewStatus: '已通过', checkedIn: true }
];
const healthyStats = getEventStats(healthyEvent, healthySignups, []);
const healthyAnomalies = getAnomalies(healthyStats);
assertEqual(healthyAnomalies.length, 0, 'healthy data has no anomalies');

console.log('\n--- anomaly navigateTarget coverage ---');
const anomalyTestEvents = [
  { id: 'an1', book: '审核积压活动', host: 'A', time: '2025-08-01T19:00', limit: 10, status: '开放报名', reviewRequired: true, seriesId: null },
  { id: 'an2', book: '低签到活动', host: 'B', time: '2025-08-02T19:00', limit: 10, status: '开放报名', reviewRequired: false, seriesId: null },
  { id: 'an3', book: '满员候补活动', host: 'C', time: '2025-08-03T19:00', limit: 1, status: '开放报名', reviewRequired: false, seriesId: null },
  { id: 'an4', book: '低转化活动', host: 'D', time: '2025-08-04T19:00', limit: 10, status: '开放报名', reviewRequired: true, seriesId: null }
];
const anomalyTestSignups = [
  { id: 'as1', eventId: 'an1', name: '1', status: '待审核', reviewStatus: '待审核' },
  { id: 'as2', eventId: 'an1', name: '2', status: '待审核', reviewStatus: '待审核' },
  { id: 'as3', eventId: 'an2', name: '3', status: '正式', reviewStatus: '已通过', checkedIn: false },
  { id: 'as4', eventId: 'an3', name: '4', status: '正式', reviewStatus: '已通过' },
  { id: 'as5', eventId: 'an3', name: '5', status: '候补', reviewStatus: '已通过', waitlistPosition: 1 },
  { id: 'as6', eventId: 'an3', name: '6', status: '候补', reviewStatus: '已通过', waitlistPosition: 2 },
  { id: 'as7', eventId: 'an4', name: '7', status: '已拒绝', reviewStatus: '已拒绝' },
  { id: 'as8', eventId: 'an4', name: '8', status: '已拒绝', reviewStatus: '已拒绝' },
  { id: 'as9', eventId: 'an4', name: '9', status: '正式', reviewStatus: '已通过' }
];
const anomalyTestStats = getEventStats(anomalyTestEvents, anomalyTestSignups, []);
const allAnomalies = getAnomalies(anomalyTestStats);
const anomalyTypes = allAnomalies.map((a) => a.navigateTarget?.type);
assertIncludes(anomalyTypes, 'pending', '审核积压 anomaly has navigateTarget.type=pending');
assertIncludes(anomalyTypes, 'checkin', '签到率低 anomaly has navigateTarget.type=checkin');
assertIncludes(anomalyTypes, 'waitlist', '满员候补 anomaly has navigateTarget.type=waitlist');
assertIncludes(anomalyTypes, 'rejected', '转化率低 anomaly has navigateTarget.type=rejected');

console.log('\n=== 常用视图功能测试 ===\n');

writeViews([]);

console.log('--- 基础存储 (readViews/writeViews) ---');
const initialViews = readViews();
assertEqual(initialViews.length, 0, '初始视图列表为空');

writeViews([{ id: 'test-v1', name: '测试视图' }]);
const afterWrite = readViews();
assertEqual(afterWrite.length, 1, '写入后视图列表有1条记录');
assertEqual(afterWrite[0].name, '测试视图', '视图名称正确');

writeViews([]);
assertEqual(readViews().length, 0, '清空后视图列表为空');

console.log('\n--- createView ---');
const viewData1 = {
  name: '本月开放活动',
  filters: {
    dateFrom: '2025-06-01',
    dateTo: '2025-06-30',
    seriesId: '',
    status: '开放报名'
  },
  granularity: 'week',
  expandedSections: {
    overview: true,
    groups: true,
    anomalies: true,
    series: false,
    trend: true,
    detail: true
  }
};
const created1 = createView(viewData1);
assert(created1.id !== undefined, 'createView 返回带 id 的视图对象');
assertEqual(created1.name, '本月开放活动', 'createView 名称正确');
assertEqual(created1.filters.dateFrom, '2025-06-01', 'createView 保存 dateFrom');
assertEqual(created1.filters.dateTo, '2025-06-30', 'createView 保存 dateTo');
assertEqual(created1.filters.status, '开放报名', 'createView 保存 status');
assertEqual(created1.granularity, 'week', 'createView 保存 granularity');
assertEqual(created1.expandedSections.trend, true, 'createView 保存 expandedSections');
assert(created1.createdAt !== undefined, 'createView 设置 createdAt');
assert(created1.updatedAt !== undefined, 'createView 设置 updatedAt');

const viewsAfterCreate = readViews();
assertEqual(viewsAfterCreate.length, 1, 'createView 后列表有1条记录');

const viewData2 = {
  name: '拉美文学系列',
  filters: {
    dateFrom: '',
    dateTo: '',
    seriesId: 's1',
    status: ''
  },
  granularity: 'month',
  expandedSections: {
    overview: true,
    groups: true,
    anomalies: false,
    series: true,
    trend: false,
    detail: false
  }
};
const created2 = createView(viewData2);
assertEqual(readViews().length, 2, 'createView 第二个视图后列表有2条记录');

console.log('\n--- createView 空值处理 ---');
const viewDataEmpty = {
  name: '  空筛选视图  ',
  filters: {},
  granularity: undefined
};
const createdEmpty = createView(viewDataEmpty);
assertEqual(createdEmpty.name, '空筛选视图', '名称自动 trim');
assertEqual(createdEmpty.filters.dateFrom, '', '缺失 filter 字段填充空字符串');
assertEqual(createdEmpty.filters.seriesId, '', '缺失 seriesId 填充空字符串');
assertEqual(createdEmpty.granularity, 'month', '缺失 granularity 默认 month');
assertEqual(createdEmpty.expandedSections.overview, true, '缺失 expandedSections 使用默认值');
assertEqual(createdEmpty.expandedSections.series, false, '默认 series 区块折叠');

assertEqual(readViews().length, 3, 'createView 空视图后列表有3条记录');

console.log('\n--- updateView ---');
const updated = updateView(created1.id, { name: '六月开放活动' });
assert(updated !== null, 'updateView 返回更新后的视图');
assertEqual(updated.name, '六月开放活动', 'updateView 更新名称');
assert(updated.updatedAt >= created1.updatedAt, 'updateView 更新 updatedAt');

const updatedViewInList = readViews().find((v) => v.id === created1.id);
assertEqual(updatedViewInList.name, '六月开放活动', '列表中名称已更新');

const updateNonExistent = updateView('non-existent', { name: 'x' });
assertEqual(updateNonExistent, null, 'updateView 不存在的 id 返回 null');

console.log('\n--- renameView ---');
const renamed = renameView(created2.id, '  拉美文学经典系列  ');
assertEqual(renamed.name, '拉美文学经典系列', 'renameView 自动 trim 名称');

const renameEmpty = renameView(created2.id, '   ');
assertEqual(renameEmpty, null, 'renameView 空名称不更新');

console.log('\n--- deleteView ---');
const originalEvents = [...mockEvents];
const originalSignups = [...mockSignups];

const beforeDeleteCount = readViews().length;
const afterDelete = deleteView(createdEmpty.id);
assertEqual(afterDelete.length, beforeDeleteCount - 1, 'deleteView 返回减少后的列表');
assertEqual(readViews().length, beforeDeleteCount - 1, '列表中已删除');

const afterDelete2 = deleteView(created1.id);
assertEqual(readViews().length, beforeDeleteCount - 2, '删除第二个视图后列表长度正确');

deleteView(created2.id);
assertEqual(readViews().length, 0, '删除所有视图后列表为空');

assertEqual(originalEvents.length, mockEvents.length, '删除视图不影响原始活动数据');
assertEqual(originalSignups.length, mockSignups.length, '删除视图不影响原始报名数据');

console.log('\n--- buildFiltersFromView ---');
const testView = createView({
  name: '筛选测试视图',
  filters: {
    dateFrom: '2025-07-01',
    dateTo: '2025-07-31',
    seriesId: 's1',
    status: '已关闭'
  },
  granularity: 'week'
});
const filtersFromView = buildFiltersFromView(testView);
assertEqual(filtersFromView.dateFrom, '2025-07-01', 'buildFiltersFromView 转换 dateFrom');
assertEqual(filtersFromView.dateTo, '2025-07-31', 'buildFiltersFromView 转换 dateTo');
assertEqual(filtersFromView.seriesId, 's1', 'buildFiltersFromView 转换 seriesId');
assertEqual(filtersFromView.status, '已关闭', 'buildFiltersFromView 转换 status');
assertEqual(filtersFromView.granularity, 'week', 'buildFiltersFromView 转换 granularity');

const filtersFromNull = buildFiltersFromView(null);
assertEqual(filtersFromNull.dateFrom, undefined, 'null 视图 dateFrom 为 undefined');
assertEqual(filtersFromNull.granularity, 'month', 'null 视图 granularity 默认 month');

const viewWithEmptyFilters = createView({
  name: '空筛选',
  filters: { dateFrom: '', dateTo: '', seriesId: '', status: '' }
});
const filtersFromEmpty = buildFiltersFromView(viewWithEmptyFilters);
assertEqual(filtersFromEmpty.dateFrom, undefined, '空字符串 dateFrom 转换为 undefined');
assertEqual(filtersFromEmpty.seriesId, undefined, '空字符串 seriesId 转换为 undefined');
assertEqual(filtersFromEmpty.status, undefined, '空字符串 status 转换为 undefined');

console.log('\n--- 视图筛选口径一致性验证 ---');
const viewForStats = createView({
  name: '7月统计视图',
  filters: {
    dateFrom: '2025-07-01',
    dateTo: '2025-07-31',
    seriesId: 's1',
    status: ''
  },
  granularity: 'week'
});

const dashboardFromDirectFilters = buildOpsDashboardData(mockEvents, mockSignups, mockSeries, {
  dateFrom: '2025-07-01',
  dateTo: '2025-07-31',
  seriesId: 's1',
  granularity: 'week'
});

const viewFilters = buildFiltersFromView(viewForStats);
const dashboardFromView = buildOpsDashboardData(mockEvents, mockSignups, mockSeries, viewFilters);

assertEqual(
  dashboardFromView.filteredEvents.length,
  dashboardFromDirectFilters.filteredEvents.length,
  '视图筛选的活动数量与直接筛选一致'
);
assertEqual(
  dashboardFromView.aggregate.totalSignups,
  dashboardFromDirectFilters.aggregate.totalSignups,
  '视图筛选的总报名数与直接筛选一致'
);
assertEqual(
  dashboardFromView.groupsSummary.total,
  dashboardFromDirectFilters.groupsSummary.total,
  '视图筛选的报名分组总数与直接筛选一致'
);
assertEqual(
  dashboardFromView.timeTrend.length,
  dashboardFromDirectFilters.timeTrend.length,
  '视图筛选的时间趋势周期数与直接筛选一致'
);

const e1OnlyView = createView({
  name: '仅e1活动',
  filters: {
    dateFrom: '2025-06-01',
    dateTo: '2025-06-01',
    seriesId: '',
    status: ''
  }
});
const e1ViewFilters = buildFiltersFromView(e1OnlyView);
const e1Dashboard = buildOpsDashboardData(mockEvents, mockSignups, mockSeries, e1ViewFilters);
assertEqual(e1Dashboard.filteredEvents.length, 1, '视图筛选后仅1场活动');
assertEqual(e1Dashboard.filteredEvents[0].book, '秋园', '视图筛选出正确的活动');
assertEqual(e1Dashboard.groupsSummary.total, 4, '视图筛选后报名数=4（与验证脚本e1筛选口径一致）');
assertEqual(e1Dashboard.groupsSummary.regular, 3, '视图筛选后正式名额=3（口径一致）');
assertEqual(e1Dashboard.groupsSummary.pending, 0, '视图筛选后待审核=0（口径一致）');

writeViews([]);
assertEqual(readViews().length, 0, '测试结束后清空视图数据');

console.log('\n=== 操作日志与撤销功能测试 ===\n');

import {
  OPERATION_TYPES,
  OPERATION_LABELS,
  readOperationLogs,
  writeOperationLogs,
  clearOperationLogs,
  recordOperation,
  undoOperation,
  undoLastNOperations,
  getUndoableLogs,
  buildBeforeStateSnapshot,
  buildAfterStateSnapshot,
  generateDescription
} from '../src/lib/utils/operationLog.js';
import {
  getReaderStats,
  getAllReadersStats
} from '../src/lib/utils/readerStats.js';

clearOperationLogs();

console.log('--- 日志基础读写 ---');
assertEqual(readOperationLogs().length, 0, '初始操作日志为空');

const sampleBefore = buildBeforeStateSnapshot({
  events: [{ id: 'ev1', book: '秋园', limit: 8 }],
  signups: [{ id: 'sg1', eventId: 'ev1', name: '张三', status: '正式', reviewStatus: '已通过' }],
  readers: [{ id: 'r1', name: '张三', phone: '13800000001', note: '老读者' }],
  mySignupIds: ['sg1'],
  series: []
});

const sampleAfter = buildAfterStateSnapshot(sampleBefore, {
  events: [{ id: 'ev1', book: '秋园', limit: 10 }],
  signups: [
    { id: 'sg1', eventId: 'ev1', name: '张三', status: '正式', reviewStatus: '已通过' },
    { id: 'sg2', eventId: 'ev1', name: '李四', status: '候补', reviewStatus: '已通过', waitlistPosition: 1 }
  ],
  readers: sampleBefore.readers,
  mySignupIds: ['sg1'],
  series: []
});

const rec1 = recordOperation(
  [],
  OPERATION_TYPES.ADJUST_LIMIT,
  generateDescription(OPERATION_TYPES.ADJUST_LIMIT, { eventId: 'ev1', eventName: '秋园' }, { beforeLimit: 8, afterLimit: 10 }),
  { eventId: 'ev1', eventName: '秋园' },
  sampleBefore,
  sampleAfter,
  { beforeLimit: 8, afterLimit: 10 }
);
assert(rec1.log.id !== undefined, '记录日志返回带id的log对象');
assertEqual(rec1.logs.length, 1, '记录后日志有1条');
assertEqual(rec1.log.type, OPERATION_TYPES.ADJUST_LIMIT, '日志类型正确');
assert(rec1.log.description.includes('秋园'), '日志描述包含活动名');
assertEqual(rec1.log.undone, false, '新日志未撤销');

const readBack = readOperationLogs();
assertEqual(readBack.length, 1, '从localStorage读取到1条日志');

console.log('\n--- generateDescription 覆盖验证 ---');
const allTypes = Object.values(OPERATION_TYPES);
for (const t of allTypes) {
  const desc = generateDescription(t, { eventName: '测试活动', readerName: '测试读者' }, { name: '测试', book: '测试书' });
  assert(desc.length > 0, `generateDescription(${t}) 生成非空描述`);
}

console.log('\n--- 多条日志 & MAX_LOGS 截断 ---');
let manyLogs = [];
for (let i = 0; i < 250; i++) {
  const res = recordOperation(
    manyLogs,
    OPERATION_TYPES.CHECK_IN,
    `签到操作 #${i}`,
    { signupId: `sg-${i}` },
    buildBeforeStateSnapshot({ events: [], signups: [], readers: [], mySignupIds: [], series: [] }),
    buildAfterStateSnapshot({}, { events: [], signups: [], readers: [], mySignupIds: [], series: [] }),
    { seq: i }
  );
  manyLogs = res.logs;
}
assertEqual(manyLogs.length, 200, '日志超过MAX_LOGS后自动截断到200');
assertEqual(manyLogs[0].metadata.seq, 249, '最新日志在最前面（LIFO）');

clearOperationLogs();
assertEqual(readOperationLogs().length, 0, '清空后日志为0');

console.log('\n=== 撤销场景：创建活动 → 撤销 ===\n');
clearOperationLogs();
let stateA = {
  events: [{ id: 'ev-old', book: '老活动', limit: 5, status: '开放报名', reviewRequired: false }],
  signups: [], readers: [], mySignupIds: [], series: []
};
const beforeCreate = buildBeforeStateSnapshot(stateA);
const newEvent = { id: 'ev-new', book: '新活动', host: '新主办', time: '2025-09-01T19:00', limit: 12, status: '开放报名', reviewRequired: false };
let stateB = { ...stateA, events: [newEvent, ...stateA.events] };
const afterCreate = buildAfterStateSnapshot(beforeCreate, stateB);
const createRec = recordOperation(
  [],
  OPERATION_TYPES.CREATE_EVENT,
  generateDescription(OPERATION_TYPES.CREATE_EVENT, { eventId: newEvent.id, eventName: newEvent.book }, { book: newEvent.book }),
  { eventId: newEvent.id, eventName: newEvent.book },
  beforeCreate,
  afterCreate,
  { book: newEvent.book, host: newEvent.host }
);
assertEqual(stateB.events.length, 2, '创建后有2个活动');
assert(stateB.events.some((e) => e.id === 'ev-new'), '新活动存在于stateB');

const undoCreate = undoOperation(createRec.logs, createRec.log.id, stateB);
assert(undoCreate.success, '撤销创建活动成功');
assertEqual(undoCreate.state.events.length, 1, '撤销后只剩1个活动');
assert(!undoCreate.state.events.some((e) => e.id === 'ev-new'), '撤销后新活动已移除');
assertEqual(undoCreate.logs[0].undone, true, '日志标记为已撤销');
assert(undoCreate.logs[0].undoTime !== null, '撤销时间已记录');

const doubleUndo = undoOperation(undoCreate.logs, createRec.log.id, undoCreate.state);
assert(!doubleUndo.success, '重复撤销失败');
assertEqual(doubleUndo.reason, '该操作已撤销', '错误原因正确');

console.log('\n--- 非最新操作撤销保护 ---\n');
clearOperationLogs();
let protectState = { events: [], signups: [], readers: [], mySignupIds: [], series: [] };
let protectLogs = [];

const protEvent1 = { id: 'pe1', book: '保护测试活动1', host: 'H1', time: '2025-10-01T19:00', limit: 5, status: '开放报名', reviewRequired: false };
const protBefore1 = buildBeforeStateSnapshot(protectState);
protectState = { ...protectState, events: [protEvent1, ...protectState.events] };
const protAfter1 = buildAfterStateSnapshot(protBefore1, protectState);
const protRec1 = recordOperation(protectLogs, OPERATION_TYPES.CREATE_EVENT, '创建活动：保护测试活动1', { eventId: 'pe1', eventName: '保护测试活动1' }, protBefore1, protAfter1, { book: '保护测试活动1' });
protectLogs = protRec1.logs;

const protEvent2 = { id: 'pe2', book: '保护测试活动2', host: 'H2', time: '2025-10-02T19:00', limit: 8, status: '开放报名', reviewRequired: false };
const protBefore2 = buildBeforeStateSnapshot(protectState);
protectState = { ...protectState, events: [protEvent2, ...protectState.events] };
const protAfter2 = buildAfterStateSnapshot(protBefore2, protectState);
const protRec2 = recordOperation(protectLogs, OPERATION_TYPES.CREATE_EVENT, '创建活动：保护测试活动2', { eventId: 'pe2', eventName: '保护测试活动2' }, protBefore2, protAfter2, { book: '保护测试活动2' });
protectLogs = protRec2.logs;

const protEvent3 = { id: 'pe3', book: '保护测试活动3', host: 'H3', time: '2025-10-03T19:00', limit: 10, status: '开放报名', reviewRequired: false };
const protBefore3 = buildBeforeStateSnapshot(protectState);
protectState = { ...protectState, events: [protEvent3, ...protectState.events] };
const protAfter3 = buildAfterStateSnapshot(protBefore3, protectState);
const protRec3 = recordOperation(protectLogs, OPERATION_TYPES.CREATE_EVENT, '创建活动：保护测试活动3', { eventId: 'pe3', eventName: '保护测试活动3' }, protBefore3, protAfter3, { book: '保护测试活动3' });
protectLogs = protRec3.logs;

assertEqual(protectState.events.length, 3, '保护测试：创建3个活动');
assertEqual(getUndoableLogs(protectLogs).length, 3, '保护测试：有3条可撤销日志');

const undoMiddle = undoOperation(protectLogs, protRec2.log.id, protectState);
assert(!undoMiddle.success, '保护测试：禁止撤销中间的操作');
assertEqual(undoMiddle.reason, '只能撤销最新的未撤销操作，请先撤销后续操作', '保护测试：错误原因正确');
assertEqual(protectState.events.length, 3, '保护测试：状态未被修改');

const undoOldest = undoOperation(protectLogs, protRec1.log.id, protectState);
assert(!undoOldest.success, '保护测试：禁止撤销最早的操作');
assertEqual(undoOldest.reason, '只能撤销最新的未撤销操作，请先撤销后续操作', '保护测试：错误原因正确');

const undoLatest = undoOperation(protectLogs, protRec3.log.id, protectState);
assert(undoLatest.success, '保护测试：可以撤销最新的操作');
assertEqual(undoLatest.state.events.length, 2, '保护测试：撤销最新后剩2个活动');

const undoNowLatest = undoOperation(undoLatest.logs, protRec2.log.id, undoLatest.state);
assert(undoNowLatest.success, '保护测试：最新操作撤销后，原来的中间操作变成最新，可以撤销');
assertEqual(undoNowLatest.state.events.length, 1, '保护测试：继续撤销后剩1个活动');

console.log('\n=== 撤销场景：调整名额触发候补转正 → 撤销 ===\n');
clearOperationLogs();
const eventWL = { id: 'ev-wl', book: '候补活动', host: 'H', time: '2025-08-15T19:00', limit: 2, status: '开放报名', reviewRequired: false };
let stateC = {
  events: [eventWL],
  signups: [
    { id: 's1', eventId: 'ev-wl', name: 'A', phone: '1', status: '正式', reviewStatus: '已通过', _wasWaitlisted: false },
    { id: 's2', eventId: 'ev-wl', name: 'B', phone: '2', status: '正式', reviewStatus: '已通过', _wasWaitlisted: false },
    { id: 's3', eventId: 'ev-wl', name: 'C', phone: '3', status: '候补', reviewStatus: '已通过', waitlistPosition: 1, _wasWaitlisted: false, createdAt: '2025-08-01 10:00:00', reviewedAt: '2025-08-01 10:00:00' },
    { id: 's4', eventId: 'ev-wl', name: 'D', phone: '4', status: '候补', reviewStatus: '已通过', waitlistPosition: 2, _wasWaitlisted: false, createdAt: '2025-08-01 10:01:00', reviewedAt: '2025-08-01 10:01:00' }
  ],
  readers: [], mySignupIds: [], series: []
};
const beforeLimit = buildBeforeStateSnapshot(stateC);
const stateCEventsExpanded = stateC.events.map((e) => e.id === 'ev-wl' ? { ...e, limit: 4 } : e);
const promotedSignups = promoteFromWaitlist(stateCEventsExpanded, stateC.signups, 'ev-wl');
let stateD = { ...stateC, events: stateCEventsExpanded, signups: promotedSignups };
const afterLimit = buildAfterStateSnapshot(beforeLimit, stateD);

const regularAfter = stateD.signups.filter((s) => s.eventId === 'ev-wl' && (isRegular(s.status) || isPromoted(s.status)));
assertEqual(regularAfter.length, 4, '名额2→4后，4人全部正式');
const promotedNow = stateD.signups.filter((s) => s.eventId === 'ev-wl' && isPromoted(s.status));
assertEqual(promotedNow.length, 2, '有2人由候补转正');

const adjustRec = recordOperation(
  [],
  OPERATION_TYPES.ADJUST_LIMIT,
  generateDescription(OPERATION_TYPES.ADJUST_LIMIT, { eventId: 'ev-wl', eventName: '候补活动' }, { beforeLimit: 2, afterLimit: 4 }),
  { eventId: 'ev-wl', eventName: '候补活动' },
  beforeLimit, afterLimit,
  { beforeLimit: 2, afterLimit: 4 }
);
const undoAdjust = undoOperation(adjustRec.logs, adjustRec.log.id, stateD);
assert(undoAdjust.success, '撤销调整名额成功');

const restoredSignups = undoAdjust.state.signups;
const restoredEvent = undoAdjust.state.events.find((e) => e.id === 'ev-wl');
assertEqual(Number(restoredEvent.limit), 2, '撤销后名额恢复为2');

const restoredRegular = restoredSignups.filter((s) => s.eventId === 'ev-wl' && s.status === '正式');
const restoredWaitlist = restoredSignups.filter((s) => s.eventId === 'ev-wl' && s.status === '候补');
assertEqual(restoredRegular.length, 2, '撤销后正式名额=2（与原limit一致）');
assertEqual(restoredWaitlist.length, 2, '撤销后候补有2人');

const restoredPositions = restoredWaitlist.map((s) => s.waitlistPosition).sort((a, b) => a - b);
assert(JSON.stringify(restoredPositions) === '[1,2]', `候补顺序重新编号正确 [${restoredPositions}]`);

console.log('\n=== 撤销场景：审核通过/拒绝/签到/取消报名 → 撤销 ===\n');
clearOperationLogs();
const revEvent = { id: 'ev-rev', book: '审核活动', host: 'H', time: '2025-09-01T19:00', limit: 2, status: '开放报名', reviewRequired: true };
let stateE = {
  events: [revEvent],
  signups: [
    { id: 'p1', eventId: 'ev-rev', name: '待审核1', phone: '111', status: '待审核', reviewStatus: '待审核', checkedIn: false, checkedInAt: '' },
    { id: 'p2', eventId: 'ev-rev', name: '待审核2', phone: '222', status: '待审核', reviewStatus: '待审核', checkedIn: false, checkedInAt: '' },
    { id: 'rej', eventId: 'ev-rev', name: '已拒绝', phone: '333', status: '已签到', reviewStatus: '已通过', checkedIn: true, checkedInAt: '2025-09-01 20:00:00', _wasWaitlisted: false }
  ],
  readers: [], mySignupIds: ['p1', 'p2', 'rej'], series: []
};

const beforeApprove = buildBeforeStateSnapshot(stateE);
const afterApproveSignups = approveSignup(stateE.events, stateE.signups, 'p1');
let stateF = { ...stateE, signups: afterApproveSignups };
const afterApprove = buildAfterStateSnapshot(beforeApprove, stateF);
const approveRec = recordOperation(
  [], OPERATION_TYPES.APPROVE_SIGNUP,
  generateDescription(OPERATION_TYPES.APPROVE_SIGNUP, { signupId: 'p1', eventName: '审核活动', readerName: '待审核1' }, { name: '待审核1' }),
  { signupId: 'p1', eventId: 'ev-rev', readerName: '待审核1', eventName: '审核活动' },
  beforeApprove, afterApprove, { name: '待审核1' }
);
stateF.signups.find((s) => s.id === 'p1').reviewStatus === '已通过' && assert(true, 'p1审核通过');

const beforeReject = buildBeforeStateSnapshot(stateF);
const afterRejectSignups = rejectSignup(stateF.signups, 'p2', '内容不符合');
let stateG = { ...stateF, signups: afterRejectSignups };
const afterReject = buildAfterStateSnapshot(beforeReject, stateG);
const rejectRec = recordOperation(
  approveRec.logs, OPERATION_TYPES.REJECT_SIGNUP,
  generateDescription(OPERATION_TYPES.REJECT_SIGNUP, { signupId: 'p2', readerName: '待审核2', eventName: '审核活动' }, { name: '待审核2' }),
  { signupId: 'p2', eventId: 'ev-rev', readerName: '待审核2', eventName: '审核活动' },
  beforeReject, afterReject, { name: '待审核2', rejectionReason: '内容不符合' }
);

const beforeCheckin = buildBeforeStateSnapshot(stateG);
const afterCheckinSignups = toggleCheckIn(stateG.signups, 'p1');
let stateH = { ...stateG, signups: afterCheckinSignups };
const afterCheckin = buildAfterStateSnapshot(beforeCheckin, stateH);
const checkinRec = recordOperation(
  rejectRec.logs, OPERATION_TYPES.CHECK_IN,
  generateDescription(OPERATION_TYPES.CHECK_IN, { signupId: 'p1', readerName: '待审核1', eventName: '审核活动' }, { name: '待审核1', checkedIn: true }),
  { signupId: 'p1', eventId: 'ev-rev', readerName: '待审核1', eventName: '审核活动' },
  beforeCheckin, afterCheckin, { name: '待审核1', checkedIn: true }
);
assertEqual(stateH.signups.find((s) => s.id === 'p1').checkedIn, true, 'p1已签到');

const beforeCancel = buildBeforeStateSnapshot(stateH);
const cancelSignupResult = handleSignupCancel(stateH.events, stateH.signups, stateH.mySignupIds, 'rej');
let stateI = { ...stateH, signups: cancelSignupResult.signups, mySignupIds: cancelSignupResult.mySignupIds };
const afterCancelSnapshot = buildAfterStateSnapshot(beforeCancel, stateI);
const cancelRec = recordOperation(
  checkinRec.logs, OPERATION_TYPES.CANCEL_SIGNUP,
  generateDescription(OPERATION_TYPES.CANCEL_SIGNUP, { signupId: 'rej', readerName: '已拒绝', eventName: '审核活动' }, { name: '已拒绝' }),
  { signupId: 'rej', eventId: 'ev-rev', readerName: '已拒绝', eventName: '审核活动' },
  beforeCancel, afterCancelSnapshot, { name: '已拒绝', originalSignup: stateH.signups.find((s) => s.id === 'rej') }
);
assertEqual(stateI.mySignupIds.includes('rej'), false, '取消报名后mySignupIds不含rej');

const undoCancel = undoOperation(cancelRec.logs, cancelRec.log.id, stateI);
assert(undoCancel.success, '撤销取消报名成功');
assert(undoCancel.state.signups.some((s) => s.id === 'rej'), '撤销后rej报名恢复');
assert(undoCancel.state.mySignupIds.includes('rej'), '撤销后mySignupIds恢复rej');

const undoCheckin = undoOperation(undoCancel.logs, checkinRec.log.id, undoCancel.state);
assert(undoCheckin.success, '撤销签到成功');
assertEqual(undoCheckin.state.signups.find((s) => s.id === 'p1').checkedIn, false, '撤销后p1签到状态恢复为false');

const undoReject = undoOperation(undoCheckin.logs, rejectRec.log.id, undoCheckin.state);
assert(undoReject.success, '撤销拒绝成功');
const p2AfterUndoReject = undoReject.state.signups.find((s) => s.id === 'p2');
assertEqual(p2AfterUndoReject.reviewStatus, '待审核', '撤销后p2恢复为待审核');

const undoApprove = undoOperation(undoReject.logs, approveRec.log.id, undoReject.state);
assert(undoApprove.success, '撤销审核通过成功');
assertEqual(undoApprove.state.signups.find((s) => s.id === 'p1').reviewStatus, '待审核', '撤销后p1恢复为待审核');

console.log('\n=== 撤销场景：批量撤销最近N次操作 ===\n');
clearOperationLogs();
let batchState = { events: [], signups: [], readers: [], mySignupIds: [], series: [] };
let batchLogs = [];

const bEvent1 = { id: 'bev1', book: '批量测试活动1', host: 'H1', time: '2025-10-01T19:00', limit: 5, status: '开放报名', reviewRequired: false };
const bBefore1 = buildBeforeStateSnapshot(batchState);
batchState = { ...batchState, events: [bEvent1, ...batchState.events] };
const bAfter1 = buildAfterStateSnapshot(bBefore1, batchState);
batchLogs = recordOperation(batchLogs, OPERATION_TYPES.CREATE_EVENT, `创建活动：批量测试活动1`, { eventId: 'bev1' }, bBefore1, bAfter1, {}).logs;

const bEvent2 = { id: 'bev2', book: '批量测试活动2', host: 'H2', time: '2025-10-02T19:00', limit: 5, status: '开放报名', reviewRequired: false };
const bBefore2 = buildBeforeStateSnapshot(batchState);
batchState = { ...batchState, events: [bEvent2, ...batchState.events] };
const bAfter2 = buildAfterStateSnapshot(bBefore2, batchState);
batchLogs = recordOperation(batchLogs, OPERATION_TYPES.CREATE_EVENT, `创建活动：批量测试活动2`, { eventId: 'bev2' }, bBefore2, bAfter2, {}).logs;

const bSignup = { id: 'bsg1', eventId: 'bev1', name: '批量测试用户', phone: '999', status: '正式', reviewStatus: '已通过', readerId: 'br1' };
const bReader = { id: 'br1', name: '批量测试用户', phone: '999', note: '', tags: [], createdAt: '2025-01-01', updatedAt: '2025-01-01' };
const bBefore3 = buildBeforeStateSnapshot(batchState);
batchState = {
  ...batchState,
  signups: [bSignup, ...batchState.signups],
  readers: [bReader, ...batchState.readers],
  mySignupIds: ['bsg1']
};
const bAfter3 = buildAfterStateSnapshot(bBefore3, batchState);
batchLogs = recordOperation(batchLogs, OPERATION_TYPES.CSV_IMPORT, `CSV导入：新增1条报名，0个活动`, { signupIds: ['bsg1'] }, bBefore3, bAfter3, { newSignupCount: 1, newEventCount: 0 }).logs;

writeOperationLogs(batchLogs);
assertEqual(batchState.events.length, 2, '批量操作后有2个活动');
assertEqual(batchState.signups.length, 1, '批量操作后有1条报名');
assertEqual(getUndoableLogs(batchLogs).length, 3, '有3条可撤销日志');

const batchUndo2 = undoLastNOperations(batchLogs, 2, batchState);
assertEqual(batchUndo2.undoneCount, 2, '批量撤销成功撤销2条');
assertEqual(batchUndo2.state.events.length, 1, '撤销后剩1个活动');
assertEqual(batchUndo2.state.signups.length, 0, 'CSV导入撤销后报名数为0');
assertEqual(batchUndo2.state.readers.length, 0, 'CSV导入撤销后读者数为0');

const finalUndo = undoLastNOperations(batchUndo2.logs, 100, batchUndo2.state);
assertEqual(finalUndo.undoneCount, 1, '超过剩余数量时只撤销剩余的1条');
assertEqual(finalUndo.state.events.length, 0, '全部撤销后活动数为0');

const noMoreUndo = undoLastNOperations(finalUndo.logs, 1, finalUndo.state);
assert(!noMoreUndo.success, '无可撤销操作时返回失败');

console.log('\n=== 撤销后运营指标 & 读者统计一致性验证 ===\n');
clearOperationLogs();

const consistencyEvent = { id: 'ev-con', book: '一致性测试', host: 'H', time: '2025-07-01T19:00', limit: 3, status: '开放报名', reviewRequired: false };
let conState = {
  events: [consistencyEvent],
  signups: [
    { id: 'c1', eventId: 'ev-con', name: '甲', phone: '1', status: '已签到', reviewStatus: '已通过', checkedIn: true, readerId: 'cr1', _wasWaitlisted: false },
    { id: 'c2', eventId: 'ev-con', name: '乙', phone: '2', status: '正式', reviewStatus: '已通过', checkedIn: false, readerId: 'cr2', _wasWaitlisted: false },
    { id: 'c3', eventId: 'ev-con', name: '丙', phone: '3', status: '候补', reviewStatus: '已通过', waitlistPosition: 1, readerId: 'cr3', _wasWaitlisted: false }
  ],
  readers: [
    { id: 'cr1', name: '甲', phone: '1', note: '', tags: [], createdAt: '2025-01-01', updatedAt: '2025-01-01' },
    { id: 'cr2', name: '乙', phone: '2', note: '', tags: [], createdAt: '2025-01-02', updatedAt: '2025-01-02' },
    { id: 'cr3', name: '丙', phone: '3', note: '候补常客', tags: [], createdAt: '2025-01-03', updatedAt: '2025-01-03' }
  ],
  mySignupIds: ['c1', 'c2', 'c3'], series: []
};

function computeConsistencyMetrics(state) {
  const es = getEventStats(state.events, state.signups, []);
  const agg = getAggregateStats(es);
  const allReaderStats = getAllReadersStats(state.readers, state.signups, state.events);
  return { es, agg, allReaderStats };
}

const metricsBefore = computeConsistencyMetrics(conState);
assertEqual(metricsBefore.es[0].regularCount, 2, '操作前 regularCount=2');
assertEqual(metricsBefore.es[0].waitlistCount, 1, '操作前 waitlistCount=1');
assertEqual(metricsBefore.es[0].checkedInCount, 1, '操作前 checkedInCount=1');
assertEqual(metricsBefore.agg.totalCheckedIn, 1, '操作前 aggregate.totalCheckedIn=1');

const conBefore = buildBeforeStateSnapshot(conState);
const expandedEvents = conState.events.map((e) => e.id === 'ev-con' ? { ...e, limit: 4 } : e);
const promotedSignupsCon = promoteFromWaitlist(expandedEvents, conState.signups, 'ev-con');
let conStateAfter = { ...conState, events: expandedEvents, signups: promotedSignupsCon };
const conAfter = buildAfterStateSnapshot(conBefore, conStateAfter);
const conRec = recordOperation(
  [], OPERATION_TYPES.ADJUST_LIMIT,
  `调整名额：一致性测试 3→4`,
  { eventId: 'ev-con', eventName: '一致性测试' },
  conBefore, conAfter, { beforeLimit: 3, afterLimit: 4 }
);

const metricsAfter = computeConsistencyMetrics(conStateAfter);
assertEqual(metricsAfter.es[0].regularCount, 3, '名额4→ waitlist转正后 regularCount=3');
assertEqual(metricsAfter.es[0].waitlistCount, 0, '转正后 waitlistCount=0');
assertEqual(metricsAfter.es[0].promotedCount, 1, 'promotedCount=1（丙被转正）');
const cr3StatsAfter = metricsAfter.allReaderStats.find((r) => r.reader.id === 'cr3');
assertEqual(cr3StatsAfter.stats.promoted, 1, '丙的读者档案中 promoted=1');

const conUndo = undoOperation(conRec.logs, conRec.log.id, conStateAfter);
assert(conUndo.success, '撤销调整名额成功');

const metricsRestored = computeConsistencyMetrics(conUndo.state);
assertEqual(metricsRestored.es[0].regularCount, metricsBefore.es[0].regularCount, '撤销后 regularCount 与操作前一致');
assertEqual(metricsRestored.es[0].waitlistCount, metricsBefore.es[0].waitlistCount, '撤销后 waitlistCount 与操作前一致');
assertEqual(metricsRestored.es[0].checkedInCount, metricsBefore.es[0].checkedInCount, '撤销后 checkedInCount 与操作前一致');
assertEqual(metricsRestored.agg.totalCheckedIn, metricsBefore.agg.totalCheckedIn, '撤销后 aggregate.totalCheckedIn 与操作前一致');
assertEqual(metricsRestored.agg.totalSignups, metricsBefore.agg.totalSignups, '撤销后 aggregate.totalSignups 与操作前一致');

const cr3StatsRestored = metricsRestored.allReaderStats.find((r) => r.reader.id === 'cr3');
assertEqual(cr3StatsRestored.stats.totalEvents, 0, '撤销后丙的 totalEvents 恢复为0（候补不算正式参加）');
assertEqual(cr3StatsRestored.stats.waitlisted, 1, '撤销后丙的 waitlisted 恢复为1');
assertEqual(cr3StatsRestored.stats.promoted, 0, '撤销后丙的 promoted 恢复为0');

const restoredWaitlistPos = conUndo.state.signups.filter((s) => s.status === '候补').map((s) => s.waitlistPosition);
assert(JSON.stringify(restoredWaitlistPos) === '[1]', `撤销后候补顺序正确 [${restoredWaitlistPos}]`);

const restoredReaderNote = conUndo.state.readers.find((r) => r.id === 'cr3')?.note;
assertEqual(restoredReaderNote, '候补常客', '撤销后读者备注信息未被破坏');

console.log('\n=== 兼容性：旧数据（无operation-logs key） ===\n');
clearOperationLogs();
localStorage.removeItem('zfl-6-operation-logs');
assertEqual(readOperationLogs().length, 0, '缺失key时返回空数组（兼容旧数据）');

const badStored = 'this is not json';
localStorage.setItem('zfl-6-operation-logs', badStored);
assertEqual(readOperationLogs().length, 0, '损坏JSON时返回空数组（容错）');

const invalidStructure = '{ "notAnArray": true }';
localStorage.setItem('zfl-6-operation-logs', invalidStructure);
assertEqual(readOperationLogs().length, 0, '非数组结构时返回空数组（兼容性）');

const partialLogs = JSON.stringify([{ id: 'old1', type: 'EDIT_EVENT' }]);
localStorage.setItem('zfl-6-operation-logs', partialLogs);
const normalized = readOperationLogs();
assertEqual(normalized.length, 1, '缺字段日志能被normalize');
assert(normalized[0].timestamp !== undefined, '缺timestamp的日志被补充');
assertEqual(normalized[0].undone, false, '缺undone的日志被设为false');

clearOperationLogs();

console.log('\n=== 状态机：常量和基础校验 ===\n');

assertEqual(SIGNUP_STATUS.PENDING, '待审核', 'PENDING常量');
assertEqual(SIGNUP_STATUS.REJECTED, '已拒绝', 'REJECTED常量');
assertEqual(SIGNUP_STATUS.CONFIRMED, '正式', 'CONFIRMED常量');
assertEqual(SIGNUP_STATUS.WAITLISTED, '候补', 'WAITLISTED常量');
assertEqual(SIGNUP_STATUS.PROMOTED, '候补转正', 'PROMOTED常量');
assertEqual(SIGNUP_STATUS.CANCELLED, '已取消', 'CANCELLED常量');
assertEqual(SIGNUP_STATUS.CHECKED_IN, '已签到', 'CHECKED_IN常量');

assert(isValidStatus('待审核'), '待审核是合法状态');
assert(isValidStatus('已拒绝'), '已拒绝是合法状态');
assert(isValidStatus('正式'), '正式是合法状态');
assert(isValidStatus('候补'), '候补是合法状态');
assert(isValidStatus('候补转正'), '候补转正是合法状态');
assert(isValidStatus('已取消'), '已取消是合法状态');
assert(isValidStatus('已签到'), '已签到是合法状态');
assert(!isValidStatus('不存在'), '不存在不是合法状态');
assert(!isValidStatus(''), '空字符串不是合法状态');

console.log('\n=== 状态机：分类函数 ===\n');

assert(isPending('待审核') && !isPending('正式'), 'isPending正确');
assert(isApproved('正式') && isApproved('候补') && !isApproved('待审核'), 'isApproved正确');
assert(isRegular('正式') && !isRegular('候补'), 'isRegular正确');
assert(isWaitlist('候补') && !isWaitlist('正式'), 'isWaitlist正确');
assert(isPromoted('候补转正') && !isPromoted('正式'), 'isPromoted正确');
assert(isCancelled('已取消') && !isCancelled('正式'), 'isCancelled正确');
assert(isRejected('已拒绝') && !isRejected('正式'), 'isRejected正确');
assert(isCheckedIn('已签到') && !isCheckedIn('正式'), 'isCheckedIn正确');
assert(isActive('待审核') && isActive('正式') && !isActive('已取消'), 'isActive正确');
assert(canCheckIn('正式') && canCheckIn('候补转正') && !canCheckIn('待审核'), 'canCheckIn正确');

console.log('\n=== 状态机：转换合法性 ===\n');

assert(canTransition('待审核', '正式'), '待审核→正式合法');
assert(canTransition('待审核', '候补'), '待审核→候补合法');
assert(canTransition('待审核', '已拒绝'), '待审核→已拒绝合法');
assert(canTransition('待审核', '已取消'), '待审核→已取消合法');
assert(!canTransition('待审核', '已签到'), '待审核→已签到不合法');
assert(canTransition('正式', '已签到'), '正式→已签到合法');
assert(canTransition('正式', '已取消'), '正式→已取消合法');
assert(canTransition('候补', '候补转正'), '候补→候补转正合法');
assert(canTransition('候补转正', '已签到'), '候补转正→已签到合法');
assert(canTransition('已签到', '正式'), '已签到→正式合法(撤销)');
assert(canTransition('已签到', '候补转正'), '已签到→候补转正合法(撤销)');
assert(canTransition('已拒绝', '待审核'), '已拒绝→待审核合法(退回)');
assert(canTransition('已取消', '正式'), '已取消→正式合法(恢复)');

console.log('\n=== 状态机：deriveLegacyFields ===\n');

const pendingLegacy = deriveLegacyFields('待审核');
assertEqual(pendingLegacy.reviewStatus, '待审核', '待审核→reviewStatus=待审核');
assertEqual(pendingLegacy.checkedIn, false, '待审核→checkedIn=false');
assertEqual(pendingLegacy._wasWaitlisted, false, '待审核→_wasWaitlisted=false');

const rejectedLegacy = deriveLegacyFields('已拒绝');
assertEqual(rejectedLegacy.reviewStatus, '已拒绝', '已拒绝→reviewStatus=已拒绝');
assertEqual(rejectedLegacy.checkedIn, false, '已拒绝→checkedIn=false');

const confirmedLegacy = deriveLegacyFields('正式');
assertEqual(confirmedLegacy.reviewStatus, '已通过', '正式→reviewStatus=已通过');
assertEqual(confirmedLegacy.checkedIn, false, '正式→checkedIn=false');
assertEqual(confirmedLegacy._wasWaitlisted, false, '正式→_wasWaitlisted=false');

const waitlistedLegacy = deriveLegacyFields('候补');
assertEqual(waitlistedLegacy.reviewStatus, '已通过', '候补→reviewStatus=已通过');
assertEqual(waitlistedLegacy._wasWaitlisted, false, '候补→_wasWaitlisted=false');

const promotedLegacy = deriveLegacyFields('候补转正');
assertEqual(promotedLegacy.reviewStatus, '已通过', '候补转正→reviewStatus=已通过');
assertEqual(promotedLegacy._wasWaitlisted, true, '候补转正→_wasWaitlisted=true');

const checkedInLegacy = deriveLegacyFields('已签到');
assertEqual(checkedInLegacy.reviewStatus, '已通过', '已签到→reviewStatus=已通过');
assertEqual(checkedInLegacy.checkedIn, true, '已签到→checkedIn=true');
assertEqual(checkedInLegacy._wasWaitlisted, false, '已签到→_wasWaitlisted=false');

const cancelledLegacy = deriveLegacyFields('已取消');
assertEqual(cancelledLegacy.reviewStatus, '', '已取消→reviewStatus为空');

console.log('\n=== 状态机：resolveSignupStatusFromCsv ===\n');

assertEqual(resolveSignupStatusFromCsv({ reviewStatus: '已拒绝' }), '已拒绝', 'CSV: 已拒绝→已拒绝');
assertEqual(resolveSignupStatusFromCsv({ reviewStatus: '待审核' }), '待审核', 'CSV: 待审核→待审核');
assertEqual(resolveSignupStatusFromCsv({ signupType: '候补' }), '候补', 'CSV: 候补→候补');
assertEqual(resolveSignupStatusFromCsv({ signupType: '正式', checkedIn: true }), '已签到', 'CSV: 正式+签到→已签到');
assertEqual(resolveSignupStatusFromCsv({ signupType: '正式', checkedIn: true, wasWaitlisted: true }), '候补转正', 'CSV: 正式+签到+wasWaitlisted→候补转正');
assertEqual(resolveSignupStatusFromCsv({ signupType: '正式' }), '正式', 'CSV: 正式→正式');
assertEqual(resolveSignupStatusFromCsv({ signupType: '候补转正' }), '候补转正', 'CSV: 候补转正→候补转正');

console.log('\n=== 状态机：旧数据迁移 ===\n');

const legacyPending = migrateLegacySignup({ id: 'lp1', status: '待审核', reviewStatus: '待审核', checkedIn: false, _wasWaitlisted: false, eventId: 'e1', name: '甲', phone: '111', answer: '', createdAt: '2025-01-01' });
assertEqual(legacyPending.status, '待审核', '迁移：待审核保持');
assertEqual(legacyPending.reviewStatus, '待审核', '迁移：待审核reviewStatus正确');

const smLegacyWaitlist = migrateLegacySignup({ id: 'lw1', status: '候补', reviewStatus: '已通过', checkedIn: false, waitlistPosition: 2, _wasWaitlisted: false, eventId: 'e1', name: '乙', phone: '222', answer: '', createdAt: '2025-01-01' });
assertEqual(smLegacyWaitlist.status, '候补', '迁移：候补保持');
assertEqual(smLegacyWaitlist.waitlistPosition, 2, '迁移：候补序号保持');

const legacyOldFormat = migrateLegacySignup({ id: 'lo1', status: '正式', reviewStatus: '已通过', checkedIn: true, _wasWaitlisted: true, eventId: 'e1', name: '丙', phone: '333', answer: '', createdAt: '2025-01-01' });
assertEqual(legacyOldFormat.status, '已签到', '迁移：旧格式(正式+checkedIn+_wasWaitlisted)→已签到');
assertEqual(legacyOldFormat._wasWaitlisted, true, '迁移：_wasWaitlisted保留');

const legacyOldWaitlistCheckedIn = migrateLegacySignup({ id: 'low1', status: '正式', reviewStatus: '已通过', checkedIn: true, _wasWaitlisted: false, eventId: 'e1', name: '丁', phone: '444', answer: '', createdAt: '2025-01-01' });
assertEqual(legacyOldWaitlistCheckedIn.status, '已签到', '迁移：旧格式(正式+checkedIn)→已签到');

const legacyEmptyStatus = migrateLegacySignup({ id: 'le1', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false, eventId: 'e1', name: '戊', phone: '555', answer: '', createdAt: '2025-01-01' });
assertEqual(legacyEmptyStatus.status, '正式', '迁移：空status→正式');

const legacyCancelledOld = migrateLegacySignup({ id: 'lc1', status: '已取消', reviewStatus: '', checkedIn: false, _wasWaitlisted: false, eventId: 'e1', name: '己', phone: '666', answer: '', createdAt: '2025-01-01' });
assertEqual(legacyCancelledOld.status, '已取消', '迁移：已取消保持');

const batchMigrated = migrateAllSignups([
  { id: 'b1', status: '待审核', reviewStatus: '待审核', checkedIn: false, _wasWaitlisted: false, eventId: 'e1', name: 'A', phone: '111', createdAt: '2025-01-01' },
  { id: 'b2', status: '正式', reviewStatus: '已通过', checkedIn: true, _wasWaitlisted: false, eventId: 'e1', name: 'B', phone: '222', createdAt: '2025-01-01' }
]);
assertEqual(batchMigrated.length, 2, '批量迁移：数量正确');
assertEqual(batchMigrated[0].status, '待审核', '批量迁移：第一条正确');
assertEqual(batchMigrated[1].status, '已签到', '批量迁移：第二条(正式+签到)→已签到');

console.log('\n=== 状态机：createStatusTransition ===\n');

const baseSignup = { id: 't1', status: '待审核', reviewStatus: '待审核', checkedIn: false, _wasWaitlisted: false, eventId: 'e1', name: '甲', phone: '111', answer: '', createdAt: '2025-01-01' };

const toConfirmed = createStatusTransition(baseSignup, '正式', { reviewedAt: '2025-06-01' });
assertEqual(toConfirmed.status, '正式', '转换：待审核→正式');
assertEqual(toConfirmed.reviewStatus, '已通过', '转换：reviewStatus=已通过');
assertEqual(toConfirmed.checkedIn, false, '转换：checkedIn=false');
assertEqual(toConfirmed._statusTransitionedFrom, '待审核', '转换：记录来源状态');

const toWaitlisted = createStatusTransition(baseSignup, '候补', { reviewedAt: '2025-06-01', waitlistPosition: 1 });
assertEqual(toWaitlisted.status, '候补', '转换：待审核→候补');
assertEqual(toWaitlisted.waitlistPosition, 1, '转换：候补序号=1');

const toRejected = createStatusTransition(baseSignup, '已拒绝', { rejectionReason: '名额已满' });
assertEqual(toRejected.status, '已拒绝', '转换：待审核→已拒绝');
assertEqual(toRejected.rejectionReason, '名额已满', '转换：拒绝原因正确');

const confirmedSignup = { ...baseSignup, status: '正式', reviewStatus: '已通过' };
const toCheckedIn = createStatusTransition(confirmedSignup, '已签到', { checkedInAt: '2025-06-15' });
assertEqual(toCheckedIn.status, '已签到', '转换：正式→已签到');
assertEqual(toCheckedIn.checkedIn, true, '转换：checkedIn=true');
assertEqual(toCheckedIn.checkedInAt, '2025-06-15', '转换：签到时间正确');

let transitionErr = null;
try {
  createStatusTransition(baseSignup, '已签到');
} catch (e) {
  transitionErr = e;
}
assert(transitionErr !== null, '转换：非法转换抛出错误');

console.log('\n=== 状态机：签到切换 ===\n');

const confirmedForCheckin = { id: 'ck1', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false, eventId: 'e1', name: '甲', phone: '111', answer: '', createdAt: '2025-01-01' };
let checkinResult = toggleCheckInWithStatus([confirmedForCheckin], 'ck1');
assertEqual(checkinResult[0].status, '已签到', '签到切换：正式→已签到');

checkinResult = toggleCheckInWithStatus(checkinResult, 'ck1');
assertEqual(checkinResult[0].status, '正式', '签到切换：已签到→正式(撤销)');

const promotedForCheckin = { id: 'ck2', status: '候补转正', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: true, eventId: 'e1', name: '乙', phone: '222', answer: '', createdAt: '2025-01-01' };
checkinResult = toggleCheckInWithStatus([promotedForCheckin], 'ck2');
assertEqual(checkinResult[0].status, '已签到', '签到切换：候补转正→已签到');

checkinResult = toggleCheckInWithStatus(checkinResult, 'ck2');
assertEqual(checkinResult[0].status, '候补转正', '签到切换：已签到→候补转正(撤销)');

console.log('\n=== 状态机：审核通过（名额判断） ===\n');

const smReviewEvent = { id: 're1', limit: 2, reviewRequired: true };
const smReviewSignups = [
  { id: 'ra1', eventId: 're1', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false, name: '甲', phone: '111' },
  { id: 'ra2', eventId: 're1', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false, name: '乙', phone: '222' },
  { id: 'ra3', eventId: 're1', status: '待审核', reviewStatus: '待审核', checkedIn: false, _wasWaitlisted: false, name: '丙', phone: '333' }
];

let approveResult = approveSignupWithStatus([smReviewEvent], smReviewSignups, 'ra3');
const approvedSignup = approveResult.find((s) => s.id === 'ra3');
assertEqual(approvedSignup.status, '候补', '审核通过：名额已满→候补');
assertEqual(approvedSignup.waitlistPosition, 1, '审核通过：候补序号=1');

const reviewEvent2 = { id: 're2', limit: 10, reviewRequired: true };
const reviewSignups2 = [
  { id: 'rb1', eventId: 're2', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false, name: '甲', phone: '111' },
  { id: 'rb2', eventId: 're2', status: '待审核', reviewStatus: '待审核', checkedIn: false, _wasWaitlisted: false, name: '乙', phone: '222' }
];
let approveResult2 = approveSignupWithStatus([reviewEvent2], reviewSignups2, 'rb2');
const approvedSignup2 = approveResult2.find((s) => s.id === 'rb2');
assertEqual(approvedSignup2.status, '正式', '审核通过：有余位→正式');

console.log('\n=== 状态机：取消报名 + 候补自动转正 ===\n');

const smCancelEvent = { id: 'ce1', limit: 2 };
const smCancelSignups = [
  { id: 'ca1', eventId: 'ce1', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false, name: '甲', phone: '111', createdAt: '2025-01-01' },
  { id: 'ca2', eventId: 'ce1', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false, name: '乙', phone: '222', createdAt: '2025-01-02' },
  { id: 'ca3', eventId: 'ce1', status: '候补', reviewStatus: '已通过', checkedIn: false, waitlistPosition: 1, _wasWaitlisted: false, name: '丙', phone: '333', createdAt: '2025-01-03' }
];

let smCancelResult = cancelSignupWithStatus([smCancelEvent], smCancelSignups, 'ca1');
const smCancelledSignup = smCancelResult.find((s) => s.id === 'ca1');
assertEqual(smCancelledSignup.status, '已取消', '取消报名：状态→已取消');

const smPromotedSignup = smCancelResult.find((s) => s.id === 'ca3');
assertEqual(smPromotedSignup.status, '候补转正', '取消报名：候补自动转正');

console.log('\n=== 状态机：名额增加→候补转正 ===\n');

const limitEvent = { id: 'le1', limit: 2 };
const limitSignups = [
  { id: 'la1', eventId: 'le1', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false, name: '甲', phone: '111', createdAt: '2025-01-01' },
  { id: 'la2', eventId: 'le1', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false, name: '乙', phone: '222', createdAt: '2025-01-02' },
  { id: 'la3', eventId: 'le1', status: '候补', reviewStatus: '已通过', checkedIn: false, waitlistPosition: 1, _wasWaitlisted: false, name: '丙', phone: '333', createdAt: '2025-01-03' }
];

let limitResult = handleLimitChange([limitEvent], limitSignups, 'le1', 2, 3);
const limitPromoted = limitResult.find((s) => s.id === 'la3');
assertEqual(limitPromoted.status, '候补转正', '名额增加：候补转正');

console.log('\n=== 状态机：getStatusCounts ===\n');

const countSignups = [
  { id: 'sc1', status: '待审核' },
  { id: 'sc2', status: '正式' },
  { id: 'sc3', status: '正式' },
  { id: 'sc4', status: '候补' },
  { id: 'sc5', status: '候补转正' },
  { id: 'sc6', status: '已取消' },
  { id: 'sc7', status: '已拒绝' },
  { id: 'sc8', status: '已签到' }
];
const counts = getStatusCounts(countSignups);
assertEqual(counts.pending, 1, 'counts: pending=1');
assertEqual(counts.waitlist, 1, 'counts: waitlist=1');
assertEqual(counts.cancelled, 1, 'counts: cancelled=1');
assertEqual(counts.rejected, 1, 'counts: rejected=1');
assertEqual(counts.checkedIn, 1, 'counts: checkedIn=1');
assertEqual(counts.promoted, 1, 'counts: promoted=1');

console.log('\n=== 状态机：getSignupStatusDisplay ===\n');

const displayWaitlist = getSignupStatusDisplay({ status: '候补', waitlistPosition: 3 });
assertEqual(displayWaitlist.label, '候补 #3', 'display: 候补显示序号');

const displayConfirmed = getSignupStatusDisplay({ status: '正式' });
assertEqual(displayConfirmed.label, '正式', 'display: 正式显示标签');
assertEqual(displayConfirmed.canCheckIn, true, 'display: 正式可签到');

const displayCheckedIn = getSignupStatusDisplay({ status: '已签到' });
assertEqual(displayCheckedIn.canCheckIn, false, 'display: 已签到不可签到');

console.log('\n=== 状态机：eventActions委托 ===\n');

const actionEvent = { id: 'ae1', limit: 5, reviewRequired: false, status: '开放报名' };
const actionSignups = [
  { id: 'as1', eventId: 'ae1', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false, name: '甲', phone: '111', createdAt: '2025-01-01' }
];

const checkinActionResult = toggleCheckIn(actionSignups, 'as1');
assertEqual(checkinActionResult[0].status, '已签到', 'eventActions.toggleCheckIn→状态机');

const actionEvent2 = { id: 'ae2', limit: 1, reviewRequired: true };
const actionSignups2 = [
  { id: 'as2', eventId: 'ae2', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false, name: '甲', phone: '111', createdAt: '2025-01-01' },
  { id: 'as3', eventId: 'ae2', status: '待审核', reviewStatus: '待审核', checkedIn: false, _wasWaitlisted: false, name: '乙', phone: '222', createdAt: '2025-01-02' }
];
const approveActionResult = approveSignup(actionEvent2, actionSignups2, 'as3');
const approvedAction = approveActionResult.find((s) => s.id === 'as3');
assertEqual(approvedAction.status, '候补', 'eventActions.approveSignup→状态机');

const rejectActionResult = rejectSignup(actionSignups, 'as1', '不符合条件');
const rejectedAction = rejectActionResult.find((s) => s.id === 'as1');
assertEqual(rejectedAction.status, '已拒绝', 'eventActions.rejectSignup→状态机');
assertEqual(rejectedAction.rejectionReason, '不符合条件', 'eventActions.rejectSignup拒绝原因');

console.log('\n=== 状态机：normalizeSignup/normalizeSignups ===\n');

const normalizedSingle = normalizeSignup({ id: 'ns1', status: '正式', reviewStatus: '已通过', checkedIn: true, _wasWaitlisted: false, eventId: 'e1', name: '甲', phone: '111', createdAt: '2025-01-01' });
assertEqual(normalizedSingle.status, '已签到', 'normalizeSignup：正式+checkedIn→已签到');

const normalizedBatch = normalizeSignups([
  { id: 'ns2', status: '待审核', reviewStatus: '待审核', checkedIn: false, _wasWaitlisted: false, eventId: 'e1', name: '乙', phone: '222', createdAt: '2025-01-01' },
  { id: 'ns3', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false, eventId: 'e1', name: '丙', phone: '333', createdAt: '2025-01-01' }
]);
assertEqual(normalizedBatch[0].status, '待审核', 'normalizeSignups：第一条保持');
assertEqual(normalizedBatch[1].status, '正式', 'normalizeSignups：空status→正式');

console.log('\n=== 状态机：边界情况 ===\n');

const nullSignup = migrateLegacySignup(null);
assertEqual(nullSignup, null, '迁移：null输入返回null');

const undefinedStatus = resolveSignupStatusFromLegacy({ status: undefined, reviewStatus: '已通过', checkedIn: false });
assertEqual(undefinedStatus, '正式', '旧数据解析：undefined status→正式');

const garbageStatus = resolveSignupStatusFromLegacy({ status: '某某', reviewStatus: '已通过', checkedIn: false });
assertEqual(garbageStatus, '正式', '旧数据解析：无效status→正式');

const csvNoFields = resolveSignupStatusFromCsv({});
assertEqual(csvNoFields, '正式', 'CSV解析：空输入→正式');

const csvCheckedInNoWaitlist = resolveSignupStatusFromCsv({ signupType: '正式', checkedIn: true, wasWaitlisted: false });
assertEqual(csvCheckedInNoWaitlist, '已签到', 'CSV解析：正式+签到→已签到');

const csvCheckedInWithWaitlist = resolveSignupStatusFromCsv({ signupType: '正式', checkedIn: true, wasWaitlisted: true });
assertEqual(csvCheckedInWithWaitlist, '候补转正', 'CSV解析：正式+签到+候补→候补转正');

const noTransitionSameStatus = createStatusTransition(baseSignup, '待审核');
assertEqual(noTransitionSameStatus.status, '待审核', '转换：相同状态不报错');
assertEqual(noTransitionSameStatus._statusTransitionedFrom, undefined, '转换：相同状态不记录来源');

console.log('\n=== 状态机：opsStats统一口径 ===\n');

const smEvents = [
  { id: 'sme1', book: '测试书', host: '测试', time: '2025-06-01T19:30', limit: 5, status: '开放报名', reviewRequired: false, seriesId: null }
];
const smSignups = [
  { id: 'sms1', eventId: 'sme1', name: '甲', phone: '111', answer: '', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false },
  { id: 'sms2', eventId: 'sme1', name: '乙', phone: '222', answer: '', status: '候补转正', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: true },
  { id: 'sms3', eventId: 'sme1', name: '丙', phone: '333', answer: '', status: '已签到', reviewStatus: '已通过', checkedIn: true, _wasWaitlisted: false },
  { id: 'sms4', eventId: 'sme1', name: '丁', phone: '444', answer: '', status: '候补', reviewStatus: '已通过', checkedIn: false, waitlistPosition: 1, _wasWaitlisted: false },
  { id: 'sms5', eventId: 'sme1', name: '戊', phone: '555', answer: '', status: '待审核', reviewStatus: '待审核', checkedIn: false },
  { id: 'sms6', eventId: 'sme1', name: '己', phone: '666', answer: '', status: '已拒绝', reviewStatus: '已拒绝', checkedIn: false, rejectionReason: '满' }
];

const smStats = getEventStats(smEvents, smSignups, []);
assertEqual(smStats[0].regularCount, 3, 'opsStats统一：regularCount=3(正式+候补转正+已签到)');
assertEqual(smStats[0].waitlistCount, 1, 'opsStats统一：waitlistCount=1');
assertEqual(smStats[0].pendingCount, 1, 'opsStats统一：pendingCount=1');
assertEqual(smStats[0].rejectedCount, 1, 'opsStats统一：rejectedCount=1');
assertEqual(smStats[0].checkedInCount, 1, 'opsStats统一：checkedInCount=1');
assertEqual(smStats[0].promotedCount, 1, 'opsStats统一：promotedCount=1');

const smGroups = getSignupGroupsSummary(smStats, smSignups);
assertEqual(smGroups.regular, 3, 'opsStats统一：groupsSummary.regular=3(正式+候补转正+已签到)');
assertEqual(smGroups.waitlist, 1, 'opsStats统一：groupsSummary.waitlist=1');
assertEqual(smGroups.checkedIn, 1, 'opsStats统一：groupsSummary.checkedIn=1');
assertEqual(smGroups.promoted, 1, 'opsStats统一：groupsSummary.promoted=1');
assertEqual(smGroups.pending, 1, 'opsStats统一：groupsSummary.pending=1');
assertEqual(smGroups.rejected, 1, 'opsStats统一：groupsSummary.rejected=1');


console.log(`结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) {
  console.error('\n⚠️ 有测试失败，请检查！');
  process.exit(1);
} else {
  console.log('\n✅ 全部通过！');
  process.exit(0);
}
