import { linkSignupToReader } from './readerMigration.js';
import {
  resolveSignupStatusFromCsv,
  deriveLegacyFields,
  SIGNUP_STATUS,
  isCheckedIn,
  isWaitlist,
  isPending
} from './signupStatusMachine.js';

function normalizeCheckinBool(val) {
  if (!val) return false;
  const v = String(val).trim();
  return v === '已到场' || v === '已签到' || v === '是' || v === 'true' || v === '1' || v === '已';
}

export const SYSTEM_FIELDS = [
  { key: 'activity', label: '活动', required: true, hint: '活动/书名名称，用于匹配或创建活动' },
  { key: 'name', label: '姓名', required: true, hint: '报名人姓名' },
  { key: 'phone', label: '手机', required: true, hint: '手机号，用于冲突检测和读者关联' },
  { key: 'answer', label: '回答', required: false, hint: '报名回答/备注' },
  { key: 'signupType', label: '报名类型', required: false, hint: '正式/候补/待审核/已拒绝/候补转正' },
  { key: 'reviewStatus', label: '审核状态', required: false, hint: '已通过/待审核/已拒绝' },
  { key: 'rejectionReason', label: '拒绝原因', required: false, hint: '审核拒绝原因' },
  { key: 'signupTime', label: '报名时间', required: false, hint: '报名提交时间' },
  { key: 'reviewTime', label: '审核时间', required: false, hint: '审核处理时间' },
  { key: 'checkinStatus', label: '签到状态', required: false, hint: '已到场/未到场' },
  { key: 'checkinTime', label: '签到时间', required: false, hint: '签到时间' },
  { key: 'waitlistPosition', label: '候补顺序', required: false, hint: '候补名单序号' },
  { key: 'wasWaitlisted', label: '候补转正标记', required: false, hint: '是/否，标记是否由候补转正' }
];

export const CONFLICT_STRATEGIES = [
  { key: 'skip', label: '跳过重复', desc: '遇到同活动同手机号记录时不做任何处理' },
  { key: 'overwrite', label: '覆盖报名回答', desc: '用CSV中的数据覆盖已有报名的回答、审核状态、报名类型等全部字段' },
  { key: 'checkinOnly', label: '仅补签到状态', desc: '只更新签到状态和签到时间，不改动其他报名信息' }
];

export function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function parseCsv(text) {
  const rows = [];
  const rowLineNumbers = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let currentLineNum = 1;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i += 2;
      } else {
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      i++;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      currentRow.push(currentField);
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
        rowLineNumbers.push(currentLineNum);
      }
      currentRow = [];
      currentField = '';
      currentLineNum++;
      if (char === '\r' && nextChar === '\n') {
        i += 2;
      } else {
        i++;
      }
    } else {
      if (char === '\n' || char === '\r') {
        currentLineNum++;
      }
      currentField += char;
      i++;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((cell) => cell.trim().length > 0)) {
      rows.push(currentRow);
      rowLineNumbers.push(currentLineNum);
    }
  }

  if (rows.length === 0) return { headers: [], rows: [], rowLineNumbers: [] };
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1).map((row) => row.map((c) => c.trim()));
  const dataRowLineNumbers = rowLineNumbers.slice(1);
  return { headers, rows: dataRows, rowLineNumbers: dataRowLineNumbers };
}

export function autoDetectMapping(headers) {
  const mapping = {};
  const usedHeaderIndexes = new Set();
  const normalizedHeaders = headers.map((h) => String(h || '').trim().toLowerCase());

  const matchRules = {
    activity: {
      exact: ['活动', '活动名称', '书名', '活动名', '名称'],
      partial: ['活动名称', '书名', '活动名']
    },
    name: {
      exact: ['姓名', '名字', '报名人', '读者姓名', '读者'],
      partial: ['读者姓名', '报名人']
    },
    phone: {
      exact: ['手机', '手机号', '电话', '联系方式', '手机号电话'],
      partial: ['手机号', '联系方式']
    },
    answer: {
      exact: ['回答', '备注', '报名回答', '答案', '讨论章节', '回答内容'],
      partial: ['报名回答', '回答内容', '讨论章节']
    },
    signupType: {
      exact: ['报名类型', '类型', '报名状态'],
      partial: ['报名类型', '报名状态']
    },
    reviewStatus: {
      exact: ['审核状态', '审核'],
      partial: ['审核状态']
    },
    rejectionReason: {
      exact: ['拒绝原因', '原因'],
      partial: ['拒绝原因']
    },
    signupTime: {
      exact: ['报名时间', '创建时间', '提交时间'],
      partial: ['报名时间', '创建时间', '提交时间']
    },
    reviewTime: {
      exact: ['审核时间', '处理时间'],
      partial: ['审核时间', '处理时间']
    },
    checkinStatus: {
      exact: ['签到状态', '签到', '到场状态'],
      partial: ['签到状态', '到场状态']
    },
    checkinTime: {
      exact: ['签到时间', '到场时间'],
      partial: ['签到时间', '到场时间']
    },
    waitlistPosition: {
      exact: ['候补顺序', '候补号', '候补给号', '候补贴'],
      partial: ['候补顺序', '候补号']
    },
    wasWaitlisted: {
      exact: ['候补转正标记', '候补转正', '是否候补转正', '由候补转正', 'wasWaitlisted'],
      partial: ['候补转正标记', '候补转正']
    }
  };

  const assignMatch = (fieldKey, keywords, matchFn) => {
    if (mapping[fieldKey] !== undefined && mapping[fieldKey] !== '') return;
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      const index = normalizedHeaders.findIndex((header, i) =>
        !usedHeaderIndexes.has(i) && matchFn(header, kwLower)
      );
      if (index !== -1) {
        mapping[fieldKey] = String(index);
        usedHeaderIndexes.add(index);
        return;
      }
    }
  };

  for (const [fieldKey, rule] of Object.entries(matchRules)) {
    assignMatch(fieldKey, rule.exact, (header, kw) => header === kw);
  }

  for (const [fieldKey, rule] of Object.entries(matchRules)) {
    assignMatch(fieldKey, rule.partial, (header, kw) => header.includes(kw));
  }

  return mapping;
}

function normalizeRejectionReason(val) {
  if (!val) return '';
  const v = String(val).trim();
  if (v === '-' || v === '无' || v === 'none') return '';
  return v;
}

function normalizeTime(val) {
  if (!val) return '';
  const v = String(val).trim();
  if (v === '-' || v === '无') return '';
  return v;
}

function normalizeWaitlistPosition(val) {
  if (!val) return undefined;
  const v = String(val).trim();
  if (v === '-' || v === '无') return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function normalizeWasWaitlistedBool(val) {
  if (!val) return false;
  const v = String(val).trim();
  return v === '是' || v === 'true' || v === '1' || v === '候补转正' || v === '已转正' || v === '转正';
}

export function previewImport({
  importCsvText,
  events,
  signups,
  readers,
  fieldMapping,
  conflictStrategy = 'skip',
  isoFn
}) {
  if (!importCsvText.trim()) {
    return { preview: null, errors: ['请先粘贴CSV文本'], stats: null };
  }

  const parsed = parseCsv(importCsvText);
  const { headers, rows, rowLineNumbers } = parsed;
  const errors = [];

  if (headers.length === 0 || rows.length === 0) {
    return { preview: null, errors: ['CSV内容为空或格式不正确'], stats: null };
  }

  const mapping = fieldMapping || autoDetectMapping(headers);

  const missingRequired = SYSTEM_FIELDS
    .filter((f) => f.required && (mapping[f.key] === undefined || mapping[f.key] === null || mapping[f.key] === ''));
  if (missingRequired.length > 0) {
    errors.push(`缺少必要字段映射：${missingRequired.map((f) => f.label).join('、')}。请在下方完成字段映射。`);
    return {
      preview: null,
      errors,
      stats: null,
      headers,
      parsed,
      fieldMapping: mapping
    };
  }

  const getField = (row, key) => {
    const idx = mapping[key];
    if (idx === undefined || idx === null || idx === '') return '';
    const numIdx = Number(idx);
    if (isNaN(numIdx)) return '';
    return row[numIdx] !== undefined ? row[numIdx] : '';
  };

  const eventsToAdd = [];
  const signupsToAdd = [];
  const duplicates = [];
  const updates = [];
  const eventsToUpdate = [];

  const eventBookCache = {};
  events.forEach((e) => { eventBookCache[e.book] = e; });

  rows.forEach((row, idx) => {
    const lineNum = rowLineNumbers[idx] || idx + 2;
    const bookName = getField(row, 'activity');
    const name = getField(row, 'name');
    const phone = getField(row, 'phone');
    const answer = getField(row, 'answer');
    const rawSignupType = getField(row, 'signupType');
    const rawReviewStatus = getField(row, 'reviewStatus');
    const rejectionReason = normalizeRejectionReason(getField(row, 'rejectionReason'));
    const createdAt = normalizeTime(getField(row, 'signupTime'));
    const reviewedAt = normalizeTime(getField(row, 'reviewTime'));
    const checkedInAt = normalizeTime(getField(row, 'checkinTime'));
    const hasCheckinStatusMapping = mapping.checkinStatus !== undefined && mapping.checkinStatus !== null && mapping.checkinStatus !== '';
    const rawCheckedIn = hasCheckinStatusMapping ? normalizeCheckinBool(getField(row, 'checkinStatus')) : !!checkedInAt;
    const rawWaitlistPosition = normalizeWaitlistPosition(getField(row, 'waitlistPosition'));
    const hasWasWaitlistedMapping = mapping.wasWaitlisted !== undefined && mapping.wasWaitlisted !== null && mapping.wasWaitlisted !== '';
    const rawWasWaitlisted = hasWasWaitlistedMapping ? normalizeWasWaitlistedBool(getField(row, 'wasWaitlisted')) : false;

    if (!bookName) {
      errors.push(`第${lineNum}行：活动名称为空`);
      return;
    }
    if (!name) {
      errors.push(`第${lineNum}行：姓名为空`);
      return;
    }
    if (!phone) {
      errors.push(`第${lineNum}行：手机号为空`);
      return;
    }

    let event = eventBookCache[bookName];
    let eventIsNew = false;
    if (!event) {
      const existingInPending = eventsToAdd.find((e) => e.book === bookName);
      if (existingInPending) {
        event = existingInPending;
      } else {
        event = {
          id: crypto.randomUUID(),
          book: bookName,
          author: '',
          description: '',
          host: '',
          time: `${isoFn(7)}T19:30`,
          limit: 20,
          question: '',
          status: '开放报名',
          reviewRequired: false,
          _isNew: true
        };
        eventsToAdd.push(event);
        eventBookCache[bookName] = event;
        eventIsNew = true;
      }
    }

    const resolved = resolveSignupStatusFromCsv({
      signupType: rawSignupType,
      reviewStatus: rawReviewStatus,
      checkedIn: rawCheckedIn,
      wasWaitlisted: rawWasWaitlisted
    });
    const resolvedStatus = resolved.status;
    const derived = deriveLegacyFields(resolvedStatus);
    const finalWasWaitlisted = rawWasWaitlisted || resolved.wasWaitlisted || derived._wasWaitlisted;

    const parsedData = {
      name,
      phone,
      answer,
      status: resolvedStatus,
      waitlistPosition: isWaitlist(resolvedStatus) ? (rawWaitlistPosition || 1) : undefined,
      reviewStatus: derived.reviewStatus,
      rejectionReason: resolvedStatus === SIGNUP_STATUS.REJECTED ? (rejectionReason || '未提供原因') : '',
      reviewedAt,
      checkedIn: derived.checkedIn,
      checkedInAt,
      _wasWaitlisted: finalWasWaitlisted,
      createdAt: createdAt || new Date().toLocaleString()
    };

    const existingSignup = signups.find(
      (s) => s.eventId === event.id && s.phone === phone
    );
    const pendingSignup = signupsToAdd.find(
      (s) => s.eventId === event.id && s.phone === phone
    );
    const pendingUpdate = updates.find(
      (u) => u.eventId === event.id && u.phone === phone
    );

    if (pendingSignup) {
      duplicates.push({
        line: lineNum,
        book: bookName,
        name,
        phone,
        reason: 'CSV内重复（已添加新报名）',
        conflictType: 'csv_duplicate'
      });
      return;
    }

    if (pendingUpdate) {
      duplicates.push({
        line: lineNum,
        book: bookName,
        name,
        phone,
        reason: 'CSV内重复（已标记更新）',
        conflictType: 'csv_duplicate'
      });
      return;
    }

    if (existingSignup) {
      if (conflictStrategy === 'skip') {
        duplicates.push({
          line: lineNum,
          book: bookName,
          name,
          phone,
          reason: '已存在报名记录（已跳过）',
          conflictType: 'existing_skip'
        });
        return;
      }

      const original = { ...existingSignup };
      let updateFields = {};
      let willChange = false;

      if (conflictStrategy === 'overwrite') {
        updateFields = { ...parsedData };
        willChange = true;
      } else if (conflictStrategy === 'checkinOnly') {
        updateFields = {
          status: derived.checkedIn ? SIGNUP_STATUS.CHECKED_IN : existingSignup.status,
          checkedIn: derived.checkedIn,
          checkedInAt: parsedData.checkedInAt
        };
        if (isCheckedIn(existingSignup.status) !== derived.checkedIn ||
            existingSignup.checkedInAt !== parsedData.checkedInAt) {
          willChange = true;
        }
      }

      if (!willChange && conflictStrategy !== 'overwrite') {
        duplicates.push({
          line: lineNum,
          book: bookName,
          name,
          phone,
          reason: '已存在报名记录（无变化，跳过）',
          conflictType: 'existing_nochange'
        });
        return;
      }

      updates.push({
        id: existingSignup.id,
        eventId: event.id,
        _eventBook: bookName,
        _lineNum: lineNum,
        original,
        updates: updateFields,
        strategy: conflictStrategy,
        name: parsedData.name,
        phone: parsedData.phone
      });
      return;
    }

    signupsToAdd.push({
      id: crypto.randomUUID(),
      eventId: event.id,
      ...parsedData,
      _lineNum: lineNum,
      _eventBook: bookName
    });
  });

  const preview = {
    events: eventsToAdd,
    signups: signupsToAdd,
    duplicates,
    updates
  };

  const stats = {
    newEventCount: preview.events.length,
    newSignupCount: preview.signups.length,
    duplicateCount: preview.duplicates.length,
    updateCount: preview.updates.length,
    errorCount: errors.length,
    totalRows: rows.length,
    processedRows: preview.signups.length + preview.updates.length + preview.duplicates.length
  };

  return {
    preview,
    errors,
    stats,
    headers,
    parsed,
    fieldMapping: mapping
  };
}

export function applyImport(preview, existingReaders) {
  if (!preview) return { newEvents: [], newSignups: [], updatedSignups: [], readers: existingReaders || [] };

  let readers = existingReaders ? [...existingReaders] : [];

  const newEvents = preview.events.map((ev) => {
    const { _isNew, ...eventData } = ev;
    return { ...eventData };
  });

  const newSignupsResult = [];
  for (const sg of preview.signups) {
    const linkResult = linkSignupToReader(readers, {
      name: sg.name,
      phone: sg.phone,
      answer: sg.answer
    });
    readers = linkResult.readers;
    const { _lineNum, _eventBook, ...signupData } = sg;
    newSignupsResult.push({
      ...signupData,
      readerId: linkResult.signupData.readerId
    });
  }

  const updatedSignupsResult = [];
  for (const up of preview.updates) {
    const linkResult = linkSignupToReader(readers, {
      name: up.name,
      phone: up.phone,
      answer: up.updates.answer || ''
    });
    readers = linkResult.readers;
    updatedSignupsResult.push({
      id: up.id,
      updates: {
        ...up.updates,
        readerId: linkResult.signupData.readerId
      }
    });
  }

  return {
    newEvents,
    newSignups: newSignupsResult,
    updatedSignups: updatedSignupsResult,
    readers
  };
}
