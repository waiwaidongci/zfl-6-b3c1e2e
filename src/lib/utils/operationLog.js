import { promoteFromWaitlist } from './storeUtils.js';
import {
  isApproved,
  isRegular,
  isWaitlist,
  isPromoted,
  isCheckedIn,
  SIGNUP_STATUS,
  deriveLegacyFields,
  recountWaitlistPositions
} from './signupStatusMachine.js';

const LOG_KEY = 'zfl-6-operation-logs';
const MAX_LOGS = 200;

export const OPERATION_TYPES = {
  CREATE_EVENT: 'CREATE_EVENT',
  EDIT_EVENT: 'EDIT_EVENT',
  ADJUST_LIMIT: 'ADJUST_LIMIT',
  APPROVE_SIGNUP: 'APPROVE_SIGNUP',
  REJECT_SIGNUP: 'REJECT_SIGNUP',
  CHECK_IN: 'CHECK_IN',
  CANCEL_SIGNUP: 'CANCEL_SIGNUP',
  CSV_IMPORT: 'CSV_IMPORT',
  UPDATE_READER_NOTE: 'UPDATE_READER_NOTE',
  BATCH_CREATE_EVENTS: 'BATCH_CREATE_EVENTS',
  BATCH_UPDATE_SERIES: 'BATCH_UPDATE_SERIES'
};

export const OPERATION_LABELS = {
  [OPERATION_TYPES.CREATE_EVENT]: '创建活动',
  [OPERATION_TYPES.EDIT_EVENT]: '编辑活动',
  [OPERATION_TYPES.ADJUST_LIMIT]: '调整名额',
  [OPERATION_TYPES.APPROVE_SIGNUP]: '审核通过',
  [OPERATION_TYPES.REJECT_SIGNUP]: '拒绝报名',
  [OPERATION_TYPES.CHECK_IN]: '签到',
  [OPERATION_TYPES.CANCEL_SIGNUP]: '取消报名',
  [OPERATION_TYPES.CSV_IMPORT]: 'CSV导入',
  [OPERATION_TYPES.UPDATE_READER_NOTE]: '修改读者备注',
  [OPERATION_TYPES.BATCH_CREATE_EVENTS]: '批量生成活动',
  [OPERATION_TYPES.BATCH_UPDATE_SERIES]: '批量更新系列'
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

export function readOperationLogs() {
  const stored = safeParse(localStorage.getItem(LOG_KEY), []);
  if (!Array.isArray(stored)) return [];
  return stored.map((item) => normalizeLog(item));
}

export function writeOperationLogs(logs) {
  const trimmed = logs.length > MAX_LOGS ? logs.slice(0, MAX_LOGS) : logs;
  localStorage.setItem(LOG_KEY, safeStringify(trimmed));
}

function normalizeLog(log) {
  return {
    id: log.id || crypto.randomUUID(),
    type: log.type || 'UNKNOWN',
    timestamp: log.timestamp || new Date().toISOString(),
    description: log.description || '',
    target: log.target || {},
    beforeState: log.beforeState || {},
    afterState: log.afterState || {},
    metadata: log.metadata || {},
    undone: !!log.undone,
    undoTime: log.undoTime || null
  };
}

export function clearOperationLogs() {
  localStorage.removeItem(LOG_KEY);
}

export function getUndoableLogs(logs) {
  return logs.filter((l) => !l.undone).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function createLogBase(type, description, target) {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    description,
    target: target || {},
    beforeState: {},
    afterState: {},
    metadata: {},
    undone: false,
    undoTime: null
  };
}

export function recordOperation(logs, type, description, target, beforeState, afterState, metadata) {
  const log = createLogBase(type, description, target);
  log.beforeState = beforeState || {};
  log.afterState = afterState || {};
  log.metadata = metadata || {};
  const newLogs = [log, ...logs];
  const trimmed = newLogs.length > MAX_LOGS ? newLogs.slice(0, MAX_LOGS) : newLogs;
  writeOperationLogs(trimmed);
  return { log, logs: trimmed };
}

function deepClone(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = deepClone(obj[key]);
  }
  return result;
}

export function buildBeforeStateSnapshot({ events, signups, readers, mySignupIds, series }) {
  return {
    events: deepClone(events || []),
    signups: deepClone(signups || []),
    readers: deepClone(readers || []),
    mySignupIds: deepClone(mySignupIds || []),
    series: deepClone(series || [])
  };
}

export function buildAfterStateSnapshot(before, { events, signups, readers, mySignupIds, series }) {
  return {
    events: deepClone(events || before.events || []),
    signups: deepClone(signups || before.signups || []),
    readers: deepClone(readers || before.readers || []),
    mySignupIds: deepClone(mySignupIds || before.mySignupIds || []),
    series: deepClone(series || before.series || [])
  };
}

export function undoOperation(logs, logId, currentState) {
  const logIndex = logs.findIndex((l) => l.id === logId);
  if (logIndex === -1) return { success: false, reason: '日志不存在', logs, state: currentState };

  const log = logs[logIndex];
  if (log.undone) return { success: false, reason: '该操作已撤销', logs, state: currentState };

  const undoableLogs = logs.filter((l) => !l.undone);
  const isLatestUndoable = undoableLogs.length > 0 && undoableLogs[0].id === logId;
  if (!isLatestUndoable) {
    return { success: false, reason: '只能撤销最新的未撤销操作，请先撤销后续操作', logs, state: currentState };
  }

  const restoredState = restoreStateFromLog(log, currentState);

  const updatedLogs = logs.map((l, i) =>
    i === logIndex ? { ...l, undone: true, undoTime: new Date().toISOString() } : l
  );
  writeOperationLogs(updatedLogs);

  return {
    success: true,
    logs: updatedLogs,
    state: restoredState,
    undoneLog: { ...log, undone: true, undoTime: new Date().toISOString() }
  };
}

function restoreStateFromLog(log, currentState) {
  const before = log.beforeState || {};
  const after = log.afterState || {};

  let events = currentState.events ? [...currentState.events] : [];
  let signups = currentState.signups ? [...currentState.signups] : [];
  let readers = currentState.readers ? [...currentState.readers] : [];
  let mySignupIds = currentState.mySignupIds ? [...currentState.mySignupIds] : [];
  let series = currentState.series ? [...currentState.series] : [];

  switch (log.type) {
    case OPERATION_TYPES.CREATE_EVENT:
      events = restoreCreatedEvent(before, after, events);
      break;
    case OPERATION_TYPES.EDIT_EVENT:
    case OPERATION_TYPES.ADJUST_LIMIT:
      events = restoreEditedEvent(before, after, events);
      signups = restoreSignupsForEventChange(before, after, events, signups, log.type);
      break;
    case OPERATION_TYPES.APPROVE_SIGNUP:
    case OPERATION_TYPES.REJECT_SIGNUP:
    case OPERATION_TYPES.CHECK_IN:
    case OPERATION_TYPES.CANCEL_SIGNUP:
      signups = restoreSignups(before, after, signups);
      mySignupIds = restoreMySignupIds(before, after, mySignupIds);
      signups = fixWaitlistAfterSignupRestore(events, signups);
      break;
    case OPERATION_TYPES.CSV_IMPORT:
      events = restoreCsvEvents(before, after, events);
      signups = restoreSignups(before, after, signups);
      readers = restoreReaders(before, after, readers);
      mySignupIds = restoreMySignupIds(before, after, mySignupIds);
      signups = fixWaitlistAfterSignupRestore(events, signups);
      break;
    case OPERATION_TYPES.UPDATE_READER_NOTE:
      readers = restoreReaders(before, after, readers);
      break;
    case OPERATION_TYPES.BATCH_CREATE_EVENTS:
      events = restoreCreatedEvent(before, after, events);
      break;
    case OPERATION_TYPES.BATCH_UPDATE_SERIES:
      events = restoreEditedEvent(before, after, events);
      signups = restoreSignupsForEventChange(before, after, events, signups, OPERATION_TYPES.ADJUST_LIMIT);
      break;
    default:
      if (before.events) events = deepClone(before.events);
      if (before.signups) signups = deepClone(before.signups);
      if (before.readers) readers = deepClone(before.readers);
      if (before.mySignupIds) mySignupIds = deepClone(before.mySignupIds);
      if (before.series) series = deepClone(before.series);
  }

  return { events, signups, readers, mySignupIds, series };
}

function restoreCreatedEvent(before, after, currentEvents) {
  const beforeIds = new Set((before.events || []).map((e) => e.id));
  const afterIds = new Set((after.events || []).map((e) => e.id));
  const createdIds = new Set([...afterIds].filter((id) => !beforeIds.has(id)));
  if (createdIds.size > 0) {
    return currentEvents.filter((e) => !createdIds.has(e.id));
  }
  return currentEvents;
}

function restoreEditedEvent(before, after, currentEvents) {
  const result = [...currentEvents];

  if (before.events && before.events.length) {
    before.events.forEach((befEv) => {
      const idx = result.findIndex((e) => e.id === befEv.id);
      if (idx !== -1) {
        result[idx] = deepClone(befEv);
      } else {
        result.push(deepClone(befEv));
      }
    });
  }

  return result;
}

function restoreSignupsForEventChange(before, after, currentEvents, currentSignups, opType) {
  let signups = [...currentSignups];
  const eventIds = new Set();

  if (before.events && before.events.length) {
    before.events.forEach((e) => eventIds.add(e.id));
  }
  if (after.events && after.events.length) {
    after.events.forEach((e) => eventIds.add(e.id));
  }

  const beforeLimitMap = {};
  if (before.events) {
    before.events.forEach((e) => { beforeLimitMap[e.id] = Number(e.limit) || 0; });
  }

  let skipPromoteForEvents = new Set();

  eventIds.forEach((eventId) => {
    const befEv = before.events?.find((e) => e.id === eventId);
    const aftEv = after.events?.find((e) => e.id === eventId);

    if (befEv && aftEv) {
      const befLimit = Number(befEv.limit) || 0;
      const aftLimit = Number(aftEv.limit) || 0;

      if (opType === OPERATION_TYPES.ADJUST_LIMIT && aftLimit > befLimit) {
        const beforeRegularCount = (before.signups || []).filter(
          (s) => s.eventId === eventId && (isRegular(s.status) || isPromoted(s.status) || isCheckedIn(s.status))
        ).length;
        signups = revertWaitlistPromotions(signups, eventId, beforeRegularCount);
        skipPromoteForEvents.add(eventId);
      }
    }
  });

  signups = fixWaitlistAfterSignupRestore(currentEvents, signups, skipPromoteForEvents);
  return signups;
}

function revertWaitlistPromotions(signups, eventId, originalLimit) {
  const eventSignups = signups.filter((s) => s.eventId === eventId && isApproved(s.status));
  const regularSignups = eventSignups.filter((s) => isRegular(s.status) || isPromoted(s.status) || isCheckedIn(s.status));
  const waitlistSignups = eventSignups
    .filter((s) => isWaitlist(s.status))
    .sort((a, b) => (a.waitlistPosition || 0) - (b.waitlistPosition || 0));

  if (regularSignups.length <= originalLimit) return signups;

  const promotedSignups = regularSignups
    .filter((s) => isPromoted(s.status))
    .sort((a, b) => {
      const aTime = a.reviewedAt || a.createdAt;
      const bTime = b.reviewedAt || b.createdAt;
      return bTime.localeCompare(aTime);
    });

  const toRevertCount = regularSignups.length - originalLimit;
  const toRevert = promotedSignups.slice(0, toRevertCount);
  const toRevertIds = new Set(toRevert.map((s) => s.id));

  let updated = signups.map((item) => {
    if (toRevertIds.has(item.id)) {
      let maxWaitPos = 0;
      waitlistSignups.forEach((w) => {
        if (w.waitlistPosition > maxWaitPos) maxWaitPos = w.waitlistPosition;
      });
      const derived = deriveLegacyFields(SIGNUP_STATUS.WAITLISTED);
      return {
        ...item,
        status: SIGNUP_STATUS.WAITLISTED,
        waitlistPosition: maxWaitPos + 1,
        reviewStatus: derived.reviewStatus,
        checkedIn: derived.checkedIn,
        _wasWaitlisted: derived._wasWaitlisted
      };
    }
    return item;
  });

  return recountWaitlistPositions(updated, eventId);
}

function restoreSignups(before, after, currentSignups) {
  const beforeSignups = before.signups || [];
  const afterSignups = after.signups || [];
  let result = [...currentSignups];

  const afterIds = new Set(afterSignups.map((s) => s.id));
  const beforeIds = new Set(beforeSignups.map((s) => s.id));

  const addedIds = new Set([...afterIds].filter((id) => !beforeIds.has(id)));
  const removedIds = new Set([...beforeIds].filter((id) => !afterIds.has(id)));
  const modifiedIds = new Set();
  const beforeMap = {};
  beforeSignups.forEach((s) => { beforeMap[s.id] = s; });

  afterSignups.forEach((aft) => {
    const bef = beforeMap[aft.id];
    if (bef && JSON.stringify(bef) !== JSON.stringify(aft)) {
      modifiedIds.add(aft.id);
    }
  });

  result = result.filter((s) => !addedIds.has(s.id));
  removedIds.forEach((rid) => {
    if (!result.find((s) => s.id === rid)) {
      const original = beforeSignups.find((s) => s.id === rid);
      if (original) result.push(deepClone(original));
    }
  });
  modifiedIds.forEach((mid) => {
    const idx = result.findIndex((s) => s.id === mid);
    if (idx !== -1) {
      const original = beforeSignups.find((s) => s.id === mid);
      if (original) result[idx] = deepClone(original);
    }
  });

  return result;
}

function restoreReaders(before, after, currentReaders) {
  const beforeReaders = before.readers || [];
  const afterReaders = after.readers || [];
  let result = [...currentReaders];

  const afterIds = new Set(afterReaders.map((r) => r.id));
  const beforeIds = new Set(beforeReaders.map((r) => r.id));

  const addedIds = new Set([...afterIds].filter((id) => !beforeIds.has(id)));
  const removedIds = new Set([...beforeIds].filter((id) => !afterIds.has(id)));
  const modifiedIds = new Set();
  const beforeMap = {};
  beforeReaders.forEach((r) => { beforeMap[r.id] = r; });

  afterReaders.forEach((aft) => {
    const bef = beforeMap[aft.id];
    if (bef) {
      const befSimple = { ...bef, updatedAt: '' };
      const aftSimple = { ...aft, updatedAt: '' };
      if (JSON.stringify(befSimple) !== JSON.stringify(aftSimple)) {
        modifiedIds.add(aft.id);
      }
    }
  });

  result = result.filter((r) => !addedIds.has(r.id));
  removedIds.forEach((rid) => {
    if (!result.find((r) => r.id === rid)) {
      const original = beforeReaders.find((r) => r.id === rid);
      if (original) result.push(deepClone(original));
    }
  });
  modifiedIds.forEach((mid) => {
    const idx = result.findIndex((r) => r.id === mid);
    if (idx !== -1) {
      const original = beforeReaders.find((r) => r.id === mid);
      if (original) result[idx] = deepClone(original);
    }
  });

  return result;
}

function restoreMySignupIds(before, after, currentIds) {
  const beforeIds = before.mySignupIds || [];
  const afterIds = after.mySignupIds || [];
  const beforeSet = new Set(beforeIds);
  const afterSet = new Set(afterIds);
  const currentSet = new Set(currentIds || []);

  afterIds.forEach((id) => {
    if (!beforeSet.has(id)) currentSet.delete(id);
  });
  beforeIds.forEach((id) => {
    if (!afterSet.has(id)) currentSet.add(id);
  });

  return Array.from(currentSet);
}

function restoreCsvEvents(before, after, currentEvents) {
  const beforeEvents = before.events || [];
  const afterEvents = after.events || [];
  let result = [...currentEvents];

  const afterIds = new Set(afterEvents.map((e) => e.id));
  const beforeIds = new Set(beforeEvents.map((e) => e.id));

  const addedIds = new Set([...afterIds].filter((id) => !beforeIds.has(id)));
  result = result.filter((e) => !addedIds.has(e.id));

  return result;
}

function fixWaitlistAfterSignupRestore(events, signups, skipPromoteForEvents) {
  let result = [...signups];
  const skipSet = skipPromoteForEvents || new Set();

  const eventIds = new Set(result.map((s) => s.eventId));
  eventIds.forEach((eventId) => {
    result = recountWaitlistPositions(result, eventId);

    if (!skipSet.has(eventId)) {
      result = promoteFromWaitlist(events, result, eventId);
    }
  });

  return result;
}

export function undoLastNOperations(logs, n, currentState) {
  const undoable = getUndoableLogs(logs);
  const toUndo = undoable.slice(0, Math.min(n, undoable.length));
  let state = { ...currentState };
  let currentLogs = [...logs];
  const undoneIds = [];

  for (const log of toUndo) {
    const res = undoOperation(currentLogs, log.id, state);
    if (res.success) {
      state = res.state;
      currentLogs = res.logs;
      undoneIds.push(log.id);
    }
  }

  return {
    success: undoneIds.length > 0,
    undoneCount: undoneIds.length,
    undoneIds,
    logs: currentLogs,
    state
  };
}

export function generateDescription(type, target, metadata) {
  switch (type) {
    case OPERATION_TYPES.CREATE_EVENT:
      return `创建活动：${target.eventName || metadata?.book || '未命名活动'}`;
    case OPERATION_TYPES.EDIT_EVENT:
      return `编辑活动：${target.eventName || metadata?.book || '未知活动'}`;
    case OPERATION_TYPES.ADJUST_LIMIT:
      return `调整名额：${target.eventName || ''} ${metadata?.beforeLimit || 0}→${metadata?.afterLimit || 0}`;
    case OPERATION_TYPES.APPROVE_SIGNUP:
      return `审核通过：${target.readerName || metadata?.name || '未知读者'} - ${target.eventName || ''}`;
    case OPERATION_TYPES.REJECT_SIGNUP:
      return `拒绝报名：${target.readerName || metadata?.name || '未知读者'} - ${target.eventName || ''}`;
    case OPERATION_TYPES.CHECK_IN:
      return `${metadata?.checkedIn ? '签到' : '取消签到'}：${target.readerName || metadata?.name || '未知读者'} - ${target.eventName || ''}`;
    case OPERATION_TYPES.CANCEL_SIGNUP:
      return `取消报名：${target.readerName || metadata?.name || '未知读者'} - ${target.eventName || ''}`;
    case OPERATION_TYPES.CSV_IMPORT:
      return `CSV导入：新增${metadata?.newSignupCount || 0}条报名，${metadata?.newEventCount || 0}个活动`;
    case OPERATION_TYPES.UPDATE_READER_NOTE:
      return `修改读者备注：${target.readerName || metadata?.name || '未知读者'}`;
    case OPERATION_TYPES.BATCH_CREATE_EVENTS:
      return `批量生成：${target.seriesName || ''} 共${metadata?.eventCount || 0}期`;
    case OPERATION_TYPES.BATCH_UPDATE_SERIES:
      return `批量更新：${target.seriesName || ''} 更新${metadata?.updatedCount || 0}场${metadata?.limitChanged ? '（含名额调整）' : ''}`;
    default:
      return '未知操作';
  }
}
