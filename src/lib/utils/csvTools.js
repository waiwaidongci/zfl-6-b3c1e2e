import { linkSignupToReader } from './readerMigration.js';

export const SYSTEM_FIELDS = [
  { key: 'activity', label: '活动', required: true, hint: '活动/书名名称，用于匹配或创建活动' },
  { key: 'name', label: '姓名', required: true, hint: '报名人姓名' },
  { key: 'phone', label: '手机', required: true, hint: '手机号，用于冲突检测和读者关联' },
  { key: 'answer', label: '回答', required: false, hint: '报名回答/备注' },
  { key: 'signupType', label: '报名类型', required: false, hint: '正式/候补/待审核/已拒绝' },
  { key: 'reviewStatus', label: '审核状态', required: false, hint: '已通过/待审核/已拒绝' },
  { key: 'rejectionReason', label: '拒绝原因', required: false, hint: '审核拒绝原因' },
  { key: 'signupTime', label: '报名时间', required: false, hint: '报名提交时间' },
  { key: 'reviewTime', label: '审核时间', required: false, hint: '审核处理时间' },
  { key: 'checkinStatus', label: '签到状态', required: false, hint: '已到场/未到场' },
  { key: 'checkinTime', label: '签到时间', required: false, hint: '签到时间' },
  { key: 'waitlistPosition', label: '候补顺序', required: false, hint: '候补名单序号' }
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
  const headerLowerToIndex = {};
  headers.forEach((h, i) => {
    headerLowerToIndex[h.toLowerCase()] = String(i);
  });

  const matchRules = {
    activity: ['活动', '活动名称', '书名', '活动名', '名称'],
    name: ['姓名', '名字', '报名人', '读者姓名', '读者'],
    phone: ['手机', '手机号', '电话', '联系方式', '手机号电话'],
    answer: ['回答', '备注', '报名回答', '答案', '讨论章节'],
    signupType: ['报名类型', '类型', '报名状态', '状态'],
    reviewStatus: ['审核状态', '审核'],
    rejectionReason: ['拒绝原因', '原因'],
    signupTime: ['报名时间', '创建时间', '提交时间'],
    reviewTime: ['审核时间', '处理时间'],
    checkinStatus: ['签到状态', '签到', '到场状态'],
    checkinTime: ['签到时间', '到场时间'],
    waitlistPosition: ['候补顺序', '候补号', '候补给号', '候补贴']
  };

  for (const [fieldKey, keywords] of Object.entries(matchRules)) {
    if (mapping[fieldKey] !== undefined && mapping[fieldKey] !== '') continue;
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        const hLower = h.toLowerCase();
        if (hLower === kwLower || hLower.includes(kwLower)) {
          mapping[fieldKey] = String(i);
          break;
        }
      }
      if (mapping[fieldKey] !== undefined && mapping[fieldKey] !== '') break;
    }
  }

  return mapping;
}

function normalizeCheckinStatus(val) {
  if (!val) return false;
  const v = String(val).trim();
  return v === '已到场' || v === '已签到' || v === '是' || v === 'true' || v === '1' || v === '已';
}

function normalizeSignupType(val, reviewStatus) {
  if (!val) return '正式';
  const v = String(val).trim();
  if (v === '正式' || v === '正' || v === 'regular') return '正式';
  if (v === '候补' || v === '候' || v === 'waitlist') return '候补';
  if (v === '待审核' || v === 'pending') return '待审核';
  if (v === '已拒绝' || v === 'rejected') return '已拒绝';
  if (reviewStatus === '待审核') return '待审核';
  if (reviewStatus === '已拒绝') return '已拒绝';
  return v;
}

function normalizeReviewStatus(val, signupType) {
  if (!val) return '已通过';
  const v = String(val).trim();
  if (v === '已通过' || v === '通过' || v === 'approved') return '已通过';
  if (v === '待审核' || v === '待审' || v === 'pending') return '待审核';
  if (v === '已拒绝' || v === '拒绝' || v === 'rejected') return '已拒绝';
  if (signupType === '待审核') return '待审核';
  if (signupType === '已拒绝') return '已拒绝';
  return v;
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
    const checkedIn = normalizeCheckinStatus(getField(row, 'checkinStatus'));
    const checkedInAt = normalizeTime(getField(row, 'checkinTime'));
    const waitlistPosition = normalizeWaitlistPosition(getField(row, 'waitlistPosition'));

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

    const reviewStatus = normalizeReviewStatus(rawReviewStatus, rawSignupType);
    let effectiveStatus = normalizeSignupType(rawSignupType, reviewStatus);
    let effectiveWaitlistPosition = waitlistPosition;
    if (reviewStatus === '已拒绝') {
      effectiveStatus = '已拒绝';
      effectiveWaitlistPosition = undefined;
    } else if (reviewStatus === '待审核') {
      effectiveStatus = '待审核';
      effectiveWaitlistPosition = undefined;
    } else if (effectiveStatus === '候补' && !effectiveWaitlistPosition) {
      effectiveWaitlistPosition = 1;
    }

    const parsedData = {
      name,
      phone,
      answer,
      status: effectiveStatus,
      waitlistPosition: effectiveWaitlistPosition,
      reviewStatus,
      rejectionReason,
      reviewedAt,
      checkedIn,
      checkedInAt,
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
          checkedIn: parsedData.checkedIn,
          checkedInAt: parsedData.checkedInAt
        };
        if (existingSignup.checkedIn !== parsedData.checkedIn ||
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
