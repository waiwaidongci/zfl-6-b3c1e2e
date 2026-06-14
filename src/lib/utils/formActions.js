import { iso } from './eventActions.js';
import { promoteFromWaitlist } from './storeUtils.js';
import { batchCreateEvents, batchUpdateSeriesEvents } from './seriesStore.js';
import {
  OPERATION_TYPES,
  generateDescription,
  recordOperation,
  buildBeforeStateSnapshot,
  buildAfterStateSnapshot
} from './operationLog.js';
import { createInitialForms, getDefaultEventTime } from './seedData.js';

export function createBookFormState() {
  const initialForms = createInitialForms();
  return {
    bookForm: initialForms.bookForm,
    editingBookId: ''
  };
}

export function handleCreateBook({ books, bookForm, editingBookId }) {
  if (!bookForm.title.trim() || !bookForm.author.trim()) {
    return { books, bookForm, editingBookId, success: false };
  }
  const initialForms = createInitialForms();
  let newBooks = books;
  if (editingBookId) {
    newBooks = books.map((b) => b.id === editingBookId ? { ...bookForm, id: editingBookId } : b);
    editingBookId = '';
  } else {
    const book = { id: crypto.randomUUID(), ...bookForm };
    newBooks = [book, ...books];
  }
  return {
    books: newBooks,
    bookForm: initialForms.bookForm,
    editingBookId,
    success: true
  };
}

export function handleEditBook(book) {
  return {
    bookForm: { title: book.title, author: book.author, description: book.description, question: book.question },
    editingBookId: book.id
  };
}

export function handleDeleteBook({ books, id, selectedBookId, clearBookSelection }) {
  const newBooks = books.filter((b) => b.id !== id);
  let newSelectedBookId = selectedBookId;
  if (selectedBookId === id) {
    newSelectedBookId = '';
    if (clearBookSelection) {
      clearBookSelection();
    }
  }
  return { books: newBooks, selectedBookId: newSelectedBookId };
}

export function handleCancelEditBook() {
  const initialForms = createInitialForms();
  return {
    bookForm: initialForms.bookForm,
    editingBookId: ''
  };
}

export function handleSelectBookForEvent({ books, eventForm, bookId }) {
  const book = books.find((b) => b.id === bookId);
  if (book) {
    return {
      selectedBookId: bookId,
      eventForm: {
        ...eventForm,
        book: book.title,
        author: book.author,
        description: book.description,
        question: book.question
      }
    };
  }
  return { selectedBookId: '', eventForm };
}

export function handleClearBookSelection({ eventForm }) {
  return {
    selectedBookId: '',
    eventForm: {
      ...eventForm,
      book: '',
      author: '',
      description: '',
      question: ''
    }
  };
}

export function handleSelectSeriesBookForEvent({ books, seriesEventForm, bookId }) {
  const book = books.find((b) => b.id === bookId);
  if (book) {
    return {
      selectedSeriesBookId: bookId,
      seriesEventForm: {
        ...seriesEventForm,
        book: book.title,
        author: book.author,
        description: book.description,
        question: book.question
      }
    };
  }
  return { selectedSeriesBookId: '', seriesEventForm };
}

export function handleClearSeriesBookSelection({ seriesEventForm }) {
  return {
    selectedSeriesBookId: '',
    seriesEventForm: {
      ...seriesEventForm,
      book: '',
      author: '',
      description: '',
      question: ''
    }
  };
}

export function handleCreateEvent({
  events,
  signups,
  eventForm,
  editingEventId,
  editingEventPrevLimit,
  editingEventSeriesId,
  editingEventSeriesIndex,
  operationLogs,
  readers,
  mySignupIds,
  series
}) {
  const initialForms = createInitialForms();
  const defaultTime = getDefaultEventTime();

  if (!eventForm.book.trim() || !eventForm.host.trim()) {
    return {
      events,
      signups,
      eventForm,
      editingEventId,
      editingEventPrevLimit,
      editingEventSeriesId,
      editingEventSeriesIndex,
      operationLogs,
      success: false
    };
  }

  const beforeSnapshot = buildBeforeStateSnapshot({ events, signups, readers, mySignupIds, series });
  let newEvents = events;
  let newSignups = signups;
  let newSelectedId = '';

  if (editingEventId) {
    const newLimit = Number(eventForm.limit || 0);
    const eventId = editingEventId;
    const prevLimit = editingEventPrevLimit;
    const beforeEvent = events.find((e) => e.id === eventId);
    newEvents = events.map((e) => e.id === eventId ? { ...eventForm, id: eventId, limit: newLimit, seriesId: editingEventSeriesId, seriesIndex: editingEventSeriesIndex } : e);

    if (newLimit > prevLimit) {
      newSignups = promoteFromWaitlist(newEvents, signups, eventId);
    }

    const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events: newEvents, signups: newSignups, readers, mySignupIds, series });

    if (prevLimit !== newLimit) {
      const target = { eventId, eventName: beforeEvent?.book || eventForm.book, limitChanged: true };
      const description = generateDescription(OPERATION_TYPES.ADJUST_LIMIT, target, { beforeLimit: prevLimit, afterLimit: newLimit, book: eventForm.book });
      const res = recordOperation(
        operationLogs,
        OPERATION_TYPES.ADJUST_LIMIT,
        description,
        target,
        beforeSnapshot,
        afterSnapshot,
        { beforeLimit: prevLimit, afterLimit: newLimit, book: eventForm.book, beforeEvent: beforeSnapshot.events.find((e) => e.id === eventId) }
      );
      operationLogs = res.logs;

      if (JSON.stringify(beforeEvent) !== JSON.stringify({ ...eventForm, id: eventId, limit: newLimit, seriesId: editingEventSeriesId, seriesIndex: editingEventSeriesIndex })) {
        const editTarget = { eventId, eventName: beforeEvent?.book || eventForm.book };
        const editDesc = generateDescription(OPERATION_TYPES.EDIT_EVENT, editTarget, { book: eventForm.book });
        const editRes = recordOperation(
          operationLogs,
          OPERATION_TYPES.EDIT_EVENT,
          editDesc,
          editTarget,
          beforeSnapshot,
          afterSnapshot,
          { book: eventForm.book, beforeEvent }
        );
        operationLogs = editRes.logs;
      }
    } else {
      const target = { eventId, eventName: beforeEvent?.book || eventForm.book };
      const description = generateDescription(OPERATION_TYPES.EDIT_EVENT, target, { book: eventForm.book });
      const res = recordOperation(
        operationLogs,
        OPERATION_TYPES.EDIT_EVENT,
        description,
        target,
        beforeSnapshot,
        afterSnapshot,
        { book: eventForm.book, beforeEvent }
      );
      operationLogs = res.logs;
    }

    editingEventId = '';
    editingEventPrevLimit = 0;
    editingEventSeriesId = undefined;
    editingEventSeriesIndex = undefined;
  } else {
    const event = { id: crypto.randomUUID(), ...eventForm, limit: Number(eventForm.limit || 0) };
    newEvents = [event, ...events];
    newSelectedId = event.id;

    const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events: newEvents, signups: newSignups, readers, mySignupIds, series });
    const target = { eventId: event.id, eventName: event.book };
    const description = generateDescription(OPERATION_TYPES.CREATE_EVENT, target, { book: event.book });
    const res = recordOperation(
      operationLogs,
      OPERATION_TYPES.CREATE_EVENT,
      description,
      target,
      beforeSnapshot,
      afterSnapshot,
      { book: event.book, host: event.host, limit: event.limit }
    );
    operationLogs = res.logs;
  }

  return {
    events: newEvents,
    signups: newSignups,
    eventForm: initialForms.eventForm,
    selectedBookId: '',
    editingEventId,
    editingEventPrevLimit,
    editingEventSeriesId,
    editingEventSeriesIndex,
    operationLogs,
    newSelectedId,
    success: true
  };
}

export function handleEditEvent(event) {
  return {
    editingEventId: event.id,
    editingEventPrevLimit: Number(event.limit),
    editingEventSeriesId: event.seriesId,
    editingEventSeriesIndex: event.seriesIndex,
    selectedBookId: '',
    eventForm: {
      book: event.book,
      author: event.author,
      description: event.description,
      host: event.host,
      time: event.time,
      limit: event.limit,
      question: event.question,
      status: event.status,
      reviewRequired: event.reviewRequired || false
    }
  };
}

export function handleCancelEditEvent() {
  const initialForms = createInitialForms();
  return {
    editingEventId: '',
    editingEventPrevLimit: 0,
    editingEventSeriesId: undefined,
    editingEventSeriesIndex: undefined,
    selectedBookId: '',
    eventForm: initialForms.eventForm
  };
}

export function handleCreateSeries({ series, seriesForm, editingSeriesId }) {
  if (!seriesForm.title.trim()) {
    return { series, seriesForm, editingSeriesId, success: false };
  }
  const initialForms = createInitialForms();
  let newSeries = series;
  if (editingSeriesId) {
    newSeries = series.map((s) => s.id === editingSeriesId ? { ...s, ...seriesForm } : s);
    editingSeriesId = '';
  } else {
    const s = { id: crypto.randomUUID(), ...seriesForm, createdAt: new Date().toLocaleString() };
    newSeries = [s, ...series];
  }
  return {
    series: newSeries,
    seriesForm: initialForms.seriesForm,
    editingSeriesId,
    success: true
  };
}

export function handleEditSeries(s) {
  return {
    editingSeriesId: s.id,
    seriesForm: { title: s.title, description: s.description || '' }
  };
}

export function handleDeleteSeries({ series, events, seriesId, selectedSeriesId }) {
  if (!confirm('确定要删除此系列吗？系列下的活动将变为单场活动。')) {
    return { series, events, selectedSeriesId, success: false };
  }
  const newEvents = events.map((e) => e.seriesId === seriesId ? { ...e, seriesId: undefined, seriesIndex: undefined } : e);
  const newSeries = series.filter((s) => s.id !== seriesId);
  let newSelectedSeriesId = selectedSeriesId;
  if (selectedSeriesId === seriesId) newSelectedSeriesId = '';
  return {
    series: newSeries,
    events: newEvents,
    selectedSeriesId: newSelectedSeriesId,
    success: true
  };
}

export function handleCancelEditSeries() {
  const initialForms = createInitialForms();
  return {
    editingSeriesId: '',
    seriesForm: initialForms.seriesForm
  };
}

export function handleStartAddEventToSeries(seriesId) {
  const initialForms = createInitialForms();
  return {
    addingEventToSeriesId: seriesId,
    selectedSeriesBookId: '',
    seriesEventForm: initialForms.seriesEventForm
  };
}

export function handleCancelAddEventToSeries() {
  const initialForms = createInitialForms();
  return {
    addingEventToSeriesId: '',
    selectedSeriesBookId: '',
    seriesEventForm: initialForms.seriesEventForm
  };
}

export function handleAddEventToSeries({ series, events, addingEventToSeriesId, seriesEventForm }) {
  if (!seriesEventForm.book.trim() || !seriesEventForm.host.trim() || !addingEventToSeriesId) {
    return { series, events, addingEventToSeriesId, seriesEventForm, success: false };
  }
  const initialForms = createInitialForms();
  const sEvents = events.filter((e) => e.seriesId === addingEventToSeriesId).sort((a, b) => a.time.localeCompare(b.time));
  const event = {
    id: crypto.randomUUID(),
    ...seriesEventForm,
    limit: Number(seriesEventForm.limit || 0),
    seriesId: addingEventToSeriesId,
    seriesIndex: sEvents.length + 1
  };
  return {
    series,
    events: [event, ...events],
    addingEventToSeriesId: '',
    selectedSeriesBookId: '',
    seriesEventForm: initialForms.seriesEventForm,
    success: true
  };
}

export function handleToggleBookSelection({ batchCreateForm, bookId }) {
  const currentIds = batchCreateForm.bookIds;
  let newBookIds;
  if (currentIds.includes(bookId)) {
    newBookIds = currentIds.filter((id) => id !== bookId);
  } else {
    newBookIds = [...currentIds, bookId];
  }
  return {
    batchCreateForm: { ...batchCreateForm, bookIds: newBookIds }
  };
}

export function handleStartBatchCreate(seriesId) {
  const initialForms = createInitialForms();
  return {
    batchCreatingForSeriesId: seriesId,
    batchUpdatingForSeriesId: '',
    addingEventToSeriesId: '',
    batchCreateForm: initialForms.batchCreateForm
  };
}

export function handleCancelBatchCreate() {
  const initialForms = createInitialForms();
  return {
    batchCreatingForSeriesId: '',
    batchCreateForm: initialForms.batchCreateForm
  };
}

export function handleBatchCreateSubmit({
  series,
  events,
  batchCreatingForSeriesId,
  batchCreateForm,
  books,
  operationLogs,
  signups,
  readers,
  mySignupIds
}) {
  if (!batchCreatingForSeriesId) {
    return { success: false };
  }

  const beforeSnapshot = buildBeforeStateSnapshot({ events, signups, readers, mySignupIds, series });
  const seriesObj = series.find((s) => s.id === batchCreatingForSeriesId);

  const result = batchCreateEvents(series, events, batchCreatingForSeriesId, batchCreateForm, books);

  if (!result.success) {
    alert(result.reason || '批量生成失败');
    return { success: false };
  }

  const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events: result.events, signups, readers, mySignupIds, series });
  const target = {
    seriesId: batchCreatingForSeriesId,
    seriesName: seriesObj?.title || '',
    newEventIds: result.createdEvents.map((e) => e.id)
  };
  const description = generateDescription(OPERATION_TYPES.BATCH_CREATE_EVENTS, target, {
    eventCount: result.createdEvents.length,
    seriesName: seriesObj?.title || ''
  });
  const res = recordOperation(
    operationLogs,
    OPERATION_TYPES.BATCH_CREATE_EVENTS,
    description,
    target,
    beforeSnapshot,
    afterSnapshot,
    {
      seriesName: seriesObj?.title || '',
      eventCount: result.createdEvents.length,
      createdEvents: result.createdEvents,
      batchConfig: { ...batchCreateForm }
    }
  );

  const initialForms = createInitialForms();
  return {
    events: result.events,
    operationLogs: res.logs,
    batchCreatingForSeriesId: '',
    batchCreateForm: initialForms.batchCreateForm,
    success: true
  };
}

export function handleStartBatchUpdate(seriesId) {
  const initialForms = createInitialForms();
  return {
    batchUpdatingForSeriesId: seriesId,
    batchCreatingForSeriesId: '',
    addingEventToSeriesId: '',
    batchUpdateForm: initialForms.batchUpdateForm
  };
}

export function handleCancelBatchUpdate() {
  const initialForms = createInitialForms();
  return {
    batchUpdatingForSeriesId: '',
    batchUpdateForm: initialForms.batchUpdateForm
  };
}

export function handleBatchUpdateSubmit({
  series,
  events,
  signups,
  batchUpdatingForSeriesId,
  batchUpdateForm,
  books,
  operationLogs,
  readers,
  mySignupIds
}) {
  if (!batchUpdatingForSeriesId) {
    return { success: false };
  }

  const beforeSnapshot = buildBeforeStateSnapshot({ events, signups, readers, mySignupIds, series });
  const seriesObj = series.find((s) => s.id === batchUpdatingForSeriesId);

  const updates = {};
  if (batchUpdateForm.host.trim()) updates.host = batchUpdateForm.host.trim();
  if (batchUpdateForm.limit !== null && batchUpdateForm.limit !== undefined) updates.limit = batchUpdateForm.limit;
  if (batchUpdateForm.status !== null) updates.status = batchUpdateForm.status;
  if (batchUpdateForm.reviewRequired !== null) updates.reviewRequired = batchUpdateForm.reviewRequired;

  if (Object.keys(updates).length === 0) {
    alert('请至少选择一项要更新的内容');
    return { success: false };
  }

  const result = batchUpdateSeriesEvents(series, events, signups, batchUpdatingForSeriesId, updates, books);

  if (!result.success) {
    alert(result.reason || '批量更新失败');
    return { success: false };
  }

  const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events: result.events, signups: result.signups, readers, mySignupIds, series });
  const target = {
    seriesId: batchUpdatingForSeriesId,
    seriesName: seriesObj?.title || '',
    updatedEventIds: result.updatedEventIds
  };
  const description = generateDescription(OPERATION_TYPES.BATCH_UPDATE_SERIES, target, {
    updatedCount: result.updatedEventIds.length,
    limitChanged: result.limitChangedEventIds.length > 0,
    seriesName: seriesObj?.title || ''
  });
  const res = recordOperation(
    operationLogs,
    OPERATION_TYPES.BATCH_UPDATE_SERIES,
    description,
    target,
    beforeSnapshot,
    afterSnapshot,
    {
      seriesName: seriesObj?.title || '',
      updatedCount: result.updatedEventIds.length,
      limitChangedCount: result.limitChangedEventIds.length,
      updates,
      beforeEvents: beforeSnapshot.events,
      afterEvents: afterSnapshot.events
    }
  );

  const updatedCount = result.updatedEventIds.length;
  const limitChanged = result.limitChangedEventIds.length;
  let msg = `已更新 ${updatedCount} 场活动`;
  if (limitChanged > 0) {
    msg += `，其中 ${limitChanged} 场因名额调整已重新计算候补`;
  }
  alert(msg);

  const initialForms = createInitialForms();
  return {
    events: result.events,
    signups: result.signups,
    operationLogs: res.logs,
    batchUpdatingForSeriesId: '',
    batchUpdateForm: initialForms.batchUpdateForm,
    success: true
  };
}

export function handleStartEditReview(selectedEvent) {
  if (!selectedEvent) return null;
  const review = selectedEvent.review || {};
  return {
    editingReview: true,
    reviewForm: {
      note: review.note || '',
      onSiteCount: review.onSiteCount !== null && review.onSiteCount !== undefined ? String(review.onSiteCount) : '',
      walkInCount: review.walkInCount !== null && review.walkInCount !== undefined ? String(review.walkInCount) : '',
      absenceReasons: review.absenceReasons || '',
      followUpReaders: review.followUpReaders || '',
      recommendedBooks: review.recommendedBooks || ''
    }
  };
}

export function handleCancelEditReview() {
  const initialForms = createInitialForms();
  return {
    editingReview: false,
    reviewForm: initialForms.reviewForm
  };
}

export function handleSaveReview({
  events,
  selectedEvent,
  reviewForm,
  operationLogs,
  signups,
  readers,
  mySignupIds,
  series
}) {
  if (!selectedEvent) {
    return { success: false };
  }

  const beforeSnapshot = buildBeforeStateSnapshot({ events, signups, readers, mySignupIds, series });
  const beforeReview = selectedEvent.review ? { ...selectedEvent.review } : null;
  const onSiteCountText = String(reviewForm.onSiteCount ?? '').trim();
  const walkInCountText = String(reviewForm.walkInCount ?? '').trim();

  const newReview = {
    note: reviewForm.note.trim(),
    onSiteCount: onSiteCountText !== '' ? Number(onSiteCountText) : null,
    walkInCount: walkInCountText !== '' ? Number(walkInCountText) : null,
    absenceReasons: reviewForm.absenceReasons.trim(),
    followUpReaders: reviewForm.followUpReaders.trim(),
    recommendedBooks: reviewForm.recommendedBooks.trim(),
    updatedAt: new Date().toLocaleString()
  };

  const newEvents = events.map((e) =>
    e.id === selectedEvent.id ? { ...e, review: newReview } : e
  );

  const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events: newEvents, signups, readers, mySignupIds, series });
  const target = { eventId: selectedEvent.id, eventName: selectedEvent.book };
  const description = generateDescription(OPERATION_TYPES.UPDATE_EVENT_REVIEW, target, { book: selectedEvent.book });
  const res = recordOperation(
    operationLogs,
    OPERATION_TYPES.UPDATE_EVENT_REVIEW,
    description,
    target,
    beforeSnapshot,
    afterSnapshot,
    { book: selectedEvent.book, beforeReview, afterReview: newReview }
  );

  return {
    events: newEvents,
    operationLogs: res.logs,
    editingReview: false,
    success: true
  };
}
