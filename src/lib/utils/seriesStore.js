import { readSeries, writeSeries, getSeriesEvents as getSeriesEventsFromStore, promoteFromWaitlist, getRegularSignupCount } from './storeUtils.js';

export function createSeriesStore() {
  let series = readSeries();

  return {
    get: () => series,
    set: (newSeries) => {
      series = newSeries;
      writeSeries(series);
      return series;
    },
    reload: () => {
      series = readSeries();
      return series;
    }
  };
}

export function createSeriesItem(seriesList, formData) {
  if (!formData.title?.trim()) return null;
  const item = {
    id: crypto.randomUUID(),
    ...formData,
    createdAt: new Date().toLocaleString()
  };
  return [item, ...seriesList];
}

export function updateSeriesItem(seriesList, seriesId, formData) {
  return seriesList.map((s) =>
    s.id === seriesId ? { ...s, ...formData } : s
  );
}

export function deleteSeriesItem(seriesList, events, seriesId) {
  const updatedEvents = events.map((e) =>
    e.seriesId === seriesId
      ? { ...e, seriesId: undefined, seriesIndex: undefined }
      : e
  );
  const updatedSeries = seriesList.filter((s) => s.id !== seriesId);
  return { series: updatedSeries, events: updatedEvents };
}

export function addEventToSeries(seriesList, events, seriesId, eventForm) {
  if (!eventForm.book?.trim() || !eventForm.host?.trim() || !seriesId) {
    return { series: seriesList, events, success: false };
  }
  const sEvents = getSeriesEventsFromStore(events, seriesId);
  const event = {
    id: crypto.randomUUID(),
    ...eventForm,
    limit: Number(eventForm.limit || 0),
    seriesId,
    seriesIndex: sEvents.length + 1
  };
  return {
    series: seriesList,
    events: [event, ...events],
    success: true,
    event
  };
}

export function getSeriesWithEvents(seriesList, events) {
  return seriesList.map((s) => {
    const sEvents = events
      .filter((e) => e.seriesId === s.id)
      .sort((a, b) => a.time.localeCompare(b.time));
    return { ...s, events: sEvents };
  });
}

export function getSeriesPublicEventLinks(events, seriesId) {
  return events
    .filter((e) => e.seriesId === seriesId)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((e) => ({
      eventId: e.id,
      book: e.book,
      time: e.time,
      status: e.status
    }));
}

function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function batchCreateEvents(seriesList, events, seriesId, batchConfig, books) {
  const series = seriesList.find((s) => s.id === seriesId);
  if (!series) return { series: seriesList, events, success: false, reason: '系列不存在' };

  const {
    bookIds = [],
    host = '',
    limit = 10,
    question = '',
    startDate = '',
    intervalDays = 7,
    status = '开放报名',
    reviewRequired = false
  } = batchConfig;

  if (!host.trim()) return { series: seriesList, events, success: false, reason: '请输入主持人' };
  if (!startDate) return { series: seriesList, events, success: false, reason: '请选择起始日期' };
  if (bookIds.length === 0) return { series: seriesList, events, success: false, reason: '请至少选择一本书' };
  if (intervalDays < 1) return { series: seriesList, events, success: false, reason: '每期间隔至少为1天' };

  const sEvents = getSeriesEventsFromStore(events, seriesId);
  const startIndex = sEvents.length;
  const newEvents = [];

  for (let i = 0; i < bookIds.length; i++) {
    const bookId = bookIds[i];
    const book = books.find((b) => b.id === bookId);
    if (!book) continue;

    const eventDate = addDays(startDate, i * intervalDays);
    const timeStr = formatDateTime(eventDate);

    const event = {
      id: crypto.randomUUID(),
      book: book.title,
      author: book.author || '',
      description: book.description || '',
      host: host.trim(),
      time: timeStr,
      limit: Number(limit) || 0,
      question: question || book.question || '',
      status,
      reviewRequired: !!reviewRequired,
      seriesId,
      seriesIndex: startIndex + i + 1,
      _fromTemplate: true,
      _templateBookId: bookId,
      createdAt: new Date().toLocaleString()
    };
    newEvents.push(event);
  }

  return {
    series: seriesList,
    events: [...newEvents, ...events],
    success: true,
    createdEvents: newEvents
  };
}

const PROTECTED_FIELDS = ['book', 'author', 'description', 'question', 'reviewRequired'];

export function detectManuallyEditedFields(event, seriesTemplate, books) {
  const edited = {};
  if (!event._fromTemplate) {
    PROTECTED_FIELDS.forEach((field) => {
      edited[field] = true;
    });
    return edited;
  }

  const templateBook = event._templateBookId ? books.find((b) => b.id === event._templateBookId) : null;

  if (templateBook) {
    if (event.book !== templateBook.title) edited.book = true;
    if (event.author !== (templateBook.author || '')) edited.author = true;
    if (event.description !== (templateBook.description || '')) edited.description = true;
    if (event.question !== (seriesTemplate?.question || templateBook.question || '')) edited.question = true;
  } else {
    if (event.book) edited.book = true;
    if (event.author) edited.author = true;
    if (event.description) edited.description = true;
    if (event.question) edited.question = true;
  }

  if (event.reviewRequired !== !!seriesTemplate?.reviewRequired) edited.reviewRequired = true;

  return edited;
}

export function batchUpdateSeriesEvents(seriesList, events, signups, seriesId, updates, books) {
  const series = seriesList.find((s) => s.id === seriesId);
  if (!series) return { series: seriesList, events, signups, success: false, reason: '系列不存在' };

  const {
    host,
    limit,
    status,
    reviewRequired
  } = updates;

  if (host === undefined && limit === undefined && status === undefined && reviewRequired === undefined) {
    return { series: seriesList, events, signups, success: false, reason: '没有需要更新的字段' };
  }

  const sEvents = getSeriesEventsFromStore(events, seriesId);
  let updatedSignups = signups;
  const updatedEventIds = [];
  const limitChangedEventIds = [];

  const updatedEvents = events.map((event) => {
    if (event.seriesId !== seriesId) return event;

    const editedFields = detectManuallyEditedFields(event, updates, books);
    const newEvent = { ...event };
    let changed = false;

    if (host !== undefined && host !== null && host.trim() !== '') {
      newEvent.host = host.trim();
      changed = true;
    }

    if (limit !== undefined && limit !== null) {
      const newLimit = Number(limit) || 0;
      const oldLimit = Number(event.limit) || 0;
      if (newLimit !== oldLimit) {
        newEvent.limit = newLimit;
        changed = true;
        limitChangedEventIds.push(event.id);
      }
    }

    if (status !== undefined && status !== null) {
      newEvent.status = status;
      changed = true;
    }

    if (reviewRequired !== undefined && reviewRequired !== null && !editedFields.reviewRequired) {
      newEvent.reviewRequired = !!reviewRequired;
      changed = true;
    }

    if (changed) {
      updatedEventIds.push(event.id);
    }

    return changed ? newEvent : event;
  });

  for (const eventId of limitChangedEventIds) {
    const event = updatedEvents.find((e) => e.id === eventId);
    if (event && Number(event.limit) > 0) {
      const signupCount = getRegularSignupCount(updatedSignups, eventId);
      if (signupCount > 0) {
        updatedSignups = promoteFromWaitlist(updatedEvents, updatedSignups, eventId);
      }
    }
  }

  return {
    series: seriesList,
    events: updatedEvents,
    signups: updatedSignups,
    success: true,
    updatedEventIds,
    limitChangedEventIds
  };
}
