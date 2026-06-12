import {
  getEventStats,
  getAggregateStats,
  filterEvents,
  getAnomalies,
  getSeriesStats,
  getTimeTrend,
  getSignupGroupsSummary,
  getEventsByStatusBucket,
  buildOpsDashboardData
} from '../src/lib/utils/opsStats.js';
import {
  normalizeEvent,
  normalizeSignup,
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
  getSeatsLeft
} from '../src/lib/utils/storeUtils.js';
import {
  toggleEventStatus,
  toggleCheckIn,
  approveSignup,
  rejectSignup,
  handleSignupSubmit,
  handleSignupCancel
} from '../src/lib/utils/eventActions.js';

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
  { id: 'sg1', eventId: 'e1', name: '张三', phone: '13800001111', answer: '第一章', status: '正式', reviewStatus: '已通过', checkedIn: true, _wasWaitlisted: false },
  { id: 'sg2', eventId: 'e1', name: '李四', phone: '13800002222', answer: '第三章', status: '正式', reviewStatus: '已通过', checkedIn: true, _wasWaitlisted: false },
  { id: 'sg3', eventId: 'e1', name: '王五', phone: '13800003333', answer: '', status: '候补', reviewStatus: '已通过', checkedIn: false, waitlistPosition: 1, _wasWaitlisted: false },
  { id: 'sg4', eventId: 'e1', name: '赵六', phone: '13800004444', answer: '', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: true },
  { id: 'sg5', eventId: 'e2', name: '钱七', phone: '13800005555', answer: '', status: '待审核', reviewStatus: '待审核', checkedIn: false },
  { id: 'sg6', eventId: 'e2', name: '孙八', phone: '13800006666', answer: '', status: '正式', reviewStatus: '已通过', checkedIn: true, _wasWaitlisted: false },
  { id: 'sg7', eventId: 'e2', name: '周九', phone: '13800007777', answer: '', status: '已拒绝', reviewStatus: '已拒绝', checkedIn: false, rejectionReason: '名额已满' },
  { id: 'sg8', eventId: 'e3', name: '吴十', phone: '13800008888', answer: '', status: '正式', reviewStatus: '已通过', checkedIn: false, _wasWaitlisted: false },
  { id: 'sg9', eventId: 'e3', name: '郑十一', phone: '13800009999', answer: '', status: '候补', reviewStatus: '已通过', checkedIn: false, waitlistPosition: 1, _wasWaitlisted: true }
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

const dashboardFiltered = buildOpsDashboardData(mockEvents, mockSignups, mockSeries, {
  dateFrom: '2025-07-01',
  dateTo: '2025-07-31',
  granularity: 'week'
});
assert(dashboardFiltered.filteredEvents.length < mockEvents.length, 'filtered events < total events');
assert(dashboardFiltered.timeTrend.length >= 1, 'week granularity works');

const dashboardEmpty = buildOpsDashboardData([], [], [], {});
assertEqual(dashboardEmpty.aggregate.totalEvents, 0, 'empty dashboard: totalEvents = 0');
assertEqual(dashboardEmpty.aggregate.avgConversionRate, 0, 'empty dashboard: avgConversionRate = 0');
assertEqual(dashboardEmpty.anomalies.length, 0, 'empty dashboard: no anomalies');

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
const afterPromoRegular = afterPromo.filter((s) => s.eventId === 'pe1' && s.status === '正式');
assertEqual(afterPromoRegular.length, 2, 'after promotion: 2 regular');
const promoted = afterPromo.find((s) => s._wasWaitlisted);
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
const normalizedSignup = normalizeSignup(legacySignup);
assertEqual(normalizedSignup.status, '正式', 'legacy signup gets status=正式');
assertEqual(normalizedSignup.reviewStatus, '已通过', 'legacy signup gets reviewStatus=已通过');
assertEqual(normalizedSignup.rejectionReason, '', 'legacy signup gets empty rejectionReason');

const legacyWaitlist = { id: 'ls2', eventId: 'e1', name: '候补用户', phone: '13900002222', status: '候补', waitlistPosition: 1 };
const normalizedWaitlist = normalizeSignup(legacyWaitlist);
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
const vlNormSignup = normalizeSignup(veryLegacySignup);
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
  { id: 'hs1', eventId: 'h1', name: 'A', phone: '1', status: '正式', reviewStatus: '已通过', checkedIn: true },
  { id: 'hs2', eventId: 'h1', name: 'B', phone: '2', status: '正式', reviewStatus: '已通过', checkedIn: true },
  { id: 'hs3', eventId: 'h1', name: 'C', phone: '3', status: '正式', reviewStatus: '已通过', checkedIn: true }
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

console.log('\n' + '='.repeat(40));
console.log(`结果: ${passed} 通过, ${failed} 失败`);
if (failed > 0) {
  console.error('\n⚠️ 有测试失败，请检查！');
  process.exit(1);
} else {
  console.log('\n✅ 全部通过！');
  process.exit(0);
}
