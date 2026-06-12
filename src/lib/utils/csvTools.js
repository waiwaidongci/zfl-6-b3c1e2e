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

export function previewImport({ importCsvText, events, signups, isoFn }) {
  if (!importCsvText.trim()) {
    return { preview: null, errors: ['请先粘贴CSV文本'], stats: null };
  }

  const { headers, rows, rowLineNumbers } = parseCsv(importCsvText);
  const errors = [];
  const eventsToAdd = [];
  const signupsToAdd = [];
  const duplicates = [];

  const headerMap = {};
  headers.forEach((h, i) => { headerMap[h] = i; });

  const requiredSignupHeaders = ['活动', '姓名', '手机'];
  const missingHeaders = requiredSignupHeaders.filter((h) => !(h in headerMap));
  if (missingHeaders.length > 0) {
    errors.push(`缺少必要列：${missingHeaders.join('、')}`);
  }

  if (errors.length > 0) {
    return { preview: null, errors, stats: null };
  }

  const eventBookCache = {};
  events.forEach((e) => { eventBookCache[e.book] = e; });

  rows.forEach((row, idx) => {
    const lineNum = rowLineNumbers[idx] || idx + 2;
    const bookName = row[headerMap['活动']] || '';
    const name = row[headerMap['姓名']] || '';
    const phone = row[headerMap['手机']] || '';
    const answer = headerMap['回答'] in row ? row[headerMap['回答']] : '';
    const status = headerMap['报名类型'] in row ? row[headerMap['报名类型']] : '正式';
    const reviewStatus = headerMap['审核状态'] in row ? row[headerMap['审核状态']] : '已通过';
    const rejectionReason = headerMap['拒绝原因'] in row && row[headerMap['拒绝原因']] !== '-' ? row[headerMap['拒绝原因']] : '';
    const createdAt = headerMap['报名时间'] in row && row[headerMap['报名时间']] !== '-' ? row[headerMap['报名时间']] : new Date().toLocaleString();
    const reviewedAt = headerMap['审核时间'] in row && row[headerMap['审核时间']] !== '-' ? row[headerMap['审核时间']] : '';
    const checkedIn = headerMap['签到状态'] in row ? row[headerMap['签到状态']] === '已到场' : false;
    const checkedInAt = headerMap['签到时间'] in row && row[headerMap['签到时间']] !== '-' ? row[headerMap['签到时间']] : '';
    const waitlistPosition = headerMap['候补顺序'] in row && row[headerMap['候补顺序']] !== '-' ? Number(row[headerMap['候补顺序']]) : undefined;

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
    if (!event) {
      if (!eventsToAdd.find((e) => e.book === bookName)) {
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
      } else {
        event = eventsToAdd.find((e) => e.book === bookName);
      }
    }

    const existingSignup = signups.find(
      (s) => s.eventId === event.id && s.phone === phone
    );
    const pendingSignup = signupsToAdd.find(
      (s) => s.eventId === event.id && s.phone === phone
    );

    if (existingSignup || pendingSignup) {
      duplicates.push({ line: lineNum, book: bookName, name, phone, reason: existingSignup ? '已存在报名记录' : 'CSV内重复' });
      return;
    }

    let effectiveStatus = status;
    let effectiveWaitlistPosition = waitlistPosition;
    if (reviewStatus === '已拒绝') {
      effectiveStatus = '已拒绝';
      effectiveWaitlistPosition = undefined;
    } else if (reviewStatus === '待审核') {
      effectiveStatus = '待审核';
      effectiveWaitlistPosition = undefined;
    } else if (status === '候补' && !waitlistPosition) {
      effectiveWaitlistPosition = 1;
    }

    signupsToAdd.push({
      id: crypto.randomUUID(),
      eventId: event.id,
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
      createdAt,
      _lineNum: lineNum,
      _eventBook: bookName
    });
  });

  const preview = { events: eventsToAdd, signups: signupsToAdd, duplicates };

  const stats = {
    eventCount: preview.events.length,
    signupCount: preview.signups.length,
    duplicateCount: preview.duplicates.length,
    errorCount: errors.length
  };

  return { preview, errors, stats };
}

export function applyImport(preview) {
  if (!preview) return { newEvents: [], newSignups: [] };

  const newEvents = preview.events.map((ev) => {
    const { _isNew, ...eventData } = ev;
    return { ...eventData };
  });

  const newSignups = preview.signups.map((sg) => {
    const { _lineNum, _eventBook, ...signupData } = sg;
    return { ...signupData };
  });

  return { newEvents, newSignups };
}
