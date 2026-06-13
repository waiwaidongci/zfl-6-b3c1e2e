<script>
  import { onMount, tick, afterUpdate } from 'svelte';
  import { BookPlus, CalendarPlus, Download, LibraryBig, ListChecks, UserCheck, Users, X, Layers, Plus, Trash2, ChevronRight, Printer, ExternalLink, Copy, CheckCircle2, Share2, UserCog, Search, Bookmark } from 'lucide-svelte';
  import SignupPrintView from '$lib/components/SignupPrintView.svelte';
  import ReaderList from '$lib/components/ReaderList.svelte';
  import ReaderDetail from '$lib/components/ReaderDetail.svelte';
  import OpsDashboard from '$lib/components/OpsDashboard.svelte';
  import {
    getSignupsByEvent,
    getPendingSignups,
    getRejectedSignups,
    getRegularSignups,
    getWaitlistSignups,
    getCheckedInCount,
    getRegularCheckedInCount,
    sortSignupsForCsv
  } from '$lib/utils/signupUtils.js';
  import {
    buildFullPublicUrl,
    buildFullPublicSeriesUrl,
    copyToClipboard,
    getSeriesPublicEventLinks
  } from '$lib/utils/eventLinkUtils.js';
  import { loadAllData, saveAllData, reloadChangedData } from '$lib/utils/dataStore.js';
  import {
    findReaderByPhone,
    updateReader,
    addTagToReader,
    removeTagFromReader,
    getAllTags
  } from '$lib/utils/readerStore.js';
  import {
    getReaderStats,
    getAllReadersStats,
    sortReadersByActivity,
    filterReaderStatsByTags
  } from '$lib/utils/readerStats.js';
  import { previewImport as csvPreviewImport, applyImport, SYSTEM_FIELDS, CONFLICT_STRATEGIES, autoDetectMapping } from '$lib/utils/csvTools.js';
  import {
    toggleEventStatus as toggleEventStatusAction,
    toggleCheckIn as toggleCheckInAction,
    approveSignup as approveSignupAction,
    rejectSignup as rejectSignupAction,
    handleSignupSubmit,
    handleSignupCancel,
    processEventLimitChanges,
    iso,
    pad as padFn,
    getCalendarData,
    handleCalendarDayToggle
  } from '$lib/utils/eventActions.js';
  import { promoteFromWaitlist } from '$lib/utils/storeUtils.js';
  import {
    OPERATION_TYPES,
    OPERATION_LABELS,
    readOperationLogs,
    writeOperationLogs,
    recordOperation,
    undoOperation,
    undoLastNOperations,
    getUndoableLogs,
    buildBeforeStateSnapshot,
    buildAfterStateSnapshot,
    generateDescription
  } from '$lib/utils/operationLog.js';
  import { onExternalChange, getCurrentVersions, getChangedKeys, getChangedLabels, destroyChannel } from '$lib/utils/syncStore.js';

  const seedBooks = [
    { id: crypto.randomUUID(), title: '秋园', author: '杨本芬', description: '《秋园》是作家杨本芬的处女作，讲述了一位普通女性在时代洪流中艰难生存的故事。', question: '你最想讨论哪一章？' },
    { id: crypto.randomUUID(), title: '索拉里斯星', author: '斯坦尼斯瓦夫·莱姆', description: '《索拉里斯星》是波兰科幻作家莱姆的代表作，探讨了人类与外星文明沟通的困境。', question: '是否读完全文？' }
  ];

  const seedEvents = [
    { id: crypto.randomUUID(), book: '秋园', author: '杨本芬', description: '《秋园》是作家杨本芬的处女作，讲述了一位普通女性在时代洪流中艰难生存的故事。', host: '店员阿檀', time: `${iso(3)}T19:30`, limit: 8, question: '你最想讨论哪一章？', status: '开放报名', reviewRequired: false },
    { id: crypto.randomUUID(), book: '索拉里斯星', author: '斯坦尼斯瓦夫·莱姆', description: '《索拉里斯星》是波兰科幻作家莱姆的代表作，探讨了人类与外星文明沟通的困境。', host: '老周', time: `${iso(10)}T20:00`, limit: 12, question: '是否读完全文？', status: '开放报名', reviewRequired: false }
  ];

  const seedSeries = [];

  let books = seedBooks;
  let events = seedEvents;
  let series = seedSeries;
  let signups = [];
  let readers = [];
  let selectedId = seedEvents[0].id;
  let mode = '用户端';
  let adminTab = '活动管理';
  let listViewTab = '全部活动';
  let selectedSeriesId = '';
  let selectedBookId = '';
  let eventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名', reviewRequired: false };
  let bookForm = { title: '', author: '', description: '', question: '' };
  let editingBookId = '';
  let editingEventId = '';
  let editingEventPrevLimit = 0;
  let editingEventSeriesId = undefined;
  let editingEventSeriesIndex = undefined;
  let mySignupIds = [];
  let signupForm = { name: '', phone: '', answer: '' };
  let matchedReaderInfo = null;
  let hydrated = false;
  let viewMode = '列表';
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let activeDate = '';

  let seriesForm = { title: '', description: '' };
  let editingSeriesId = '';
  let addingEventToSeriesId = '';
  let seriesEventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名', reviewRequired: false };
  let selectedSeriesBookId = '';
  let rejectingSignupId = '';
  let rejectionReason = '';

  let importCsvText = '';
  let importPreview = null;
  let importErrors = [];
  let importStats = null;
  let importCsvHeaders = [];
  let importFieldMapping = {};
  let importConflictStrategy = 'skip';
  let importMappingStep = false;
  let importSampleRows = [];
  let showPrintView = false;
  let showPublicLinkModal = false;
  let publicLinkModalType = 'single';
  let publicLinkTargetEventId = '';
  let publicLinkTargetSeriesId = '';
  let copiedLinkId = '';

  let selectedReaderId = '';
  let readerSearchKeyword = '';
  let readerSortBy = 'lastActive';
  let readerSelectedTags = [];
  let migrationStats = null;

  let pendingNavigateTarget = null;
  let signupListContainer;

  let operationLogs = [];
  let showOperationLogPanel = false;
  let undoCountInput = 1;
  let lastUndoMessage = '';

  let _syncVersions = {};
  let _suppressSave = false;
  let _conflictBanner = null;
  let _pendingChangedKeys = [];
  let _unsubscribeSync = null;
  let _editingReaderDetail = false;

  function scrollToSignupGroup(targetType) {
    if (!signupListContainer) return;
    const selectors = {
      pending: '.pendingSectionTitle',
      checkin: '.signupSectionTitle:not(.pendingSectionTitle):not(.waitlistSectionTitle):not(.rejectedSectionTitle)',
      waitlist: '.waitlistSectionTitle',
      rejected: '.rejectedSectionTitle',
      regular: '.signupSectionTitle:not(.pendingSectionTitle):not(.waitlistSectionTitle):not(.rejectedSectionTitle)'
    };
    const selector = selectors[targetType] || selectors.regular;
    requestAnimationFrame(() => {
      const el = signupListContainer.querySelector(selector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  afterUpdate(() => {
    if (pendingNavigateTarget) {
      scrollToSignupGroup(pendingNavigateTarget);
      pendingNavigateTarget = null;
    }
  });

  onMount(() => {
    const loaded = loadAllData();
    books = loaded.books.length > 0 ? loaded.books : seedBooks;
    events = loaded.events.length > 0 ? loaded.events : seedEvents;
    series = loaded.series.length > 0 ? loaded.series : seedSeries;
    signups = loaded.signups;
    mySignupIds = loaded.mySignupIds;
    readers = loaded.readers;
    migrationStats = loaded.migrationStats;
    operationLogs = readOperationLogs();

    selectedId = events[0]?.id || '';
    hydrated = true;
    _syncVersions = getCurrentVersions();

    _unsubscribeSync = onExternalChange(() => {
      if (_suppressSave) return;
      const changedKeys = getChangedKeys(_syncVersions);
      if (changedKeys.length === 0) return;

      const isDirty = !!(
        editingEventId || editingBookId || editingSeriesId ||
        addingEventToSeriesId || rejectingSignupId ||
        importCsvText.trim() ||
        signupForm.name?.trim() || signupForm.phone?.trim() || signupForm.answer?.trim() ||
        _editingReaderDetail
      );

      if (isDirty) {
        _pendingChangedKeys = [...new Set([..._pendingChangedKeys, ...changedKeys])];
        _conflictBanner = getChangedLabels(_pendingChangedKeys);
      } else {
        applyExternalReload(changedKeys);
      }
    });

    return () => {
      if (_unsubscribeSync) _unsubscribeSync();
      destroyChannel();
    };
  });

  $: if (hydrated && !_suppressSave) {
    saveAllData({ books, events, signups, mySignupIds, series, readers });
    _syncVersions = getCurrentVersions();
  }

  function applyExternalReload(changedKeys) {
    _suppressSave = true;
    const currentData = { books, events, signups, mySignupIds, series, readers };
    const reloaded = reloadChangedData(changedKeys, currentData);
    books = reloaded.books;
    events = reloaded.events;
    signups = reloaded.signups;
    mySignupIds = reloaded.mySignupIds;
    series = reloaded.series;
    readers = reloaded.readers;
    _syncVersions = getCurrentVersions();
    tick().then(() => { _suppressSave = false; });
  }

  function handleConflictRefresh() {
    const changedKeys = [..._pendingChangedKeys];
    _conflictBanner = null;
    _pendingChangedKeys = [];
    applyExternalReload(changedKeys);
  }

  function handleConflictDismiss() {
    _syncVersions = getCurrentVersions();
    _conflictBanner = null;
    _pendingChangedKeys = [];
  }

  $: if (signupForm.phone && signupForm.phone.trim()) {
    const found = findReaderByPhone(readers, signupForm.phone);
    if (found) {
      matchedReaderInfo = found;
      if (!signupForm.name && found.name) {
        signupForm.name = found.name;
      }
    } else {
      matchedReaderInfo = null;
    }
  } else {
    matchedReaderInfo = null;
  }

  $: allReaderStats = getAllReadersStats(readers, signups, events);
  $: allAvailableTags = getAllTags(readers);
  $: if (readerSelectedTags.length > 0) {
    const validTags = readerSelectedTags.filter((t) => allAvailableTags.includes(t));
    if (validTags.length !== readerSelectedTags.length) {
      readerSelectedTags = validTags;
    }
  }
  $: sortedReaderStats = sortReadersByActivity(allReaderStats, readerSortBy);
  $: tagFilteredReaderStats = filterReaderStatsByTags(sortedReaderStats, readerSelectedTags);
  $: filteredReaderStats = tagFilteredReaderStats.filter((item) => {
    if (!readerSearchKeyword.trim()) return true;
    const kw = readerSearchKeyword.trim().toLowerCase();
    return (
      item.reader.name.toLowerCase().includes(kw) ||
      item.reader.phone.includes(kw) ||
      item.reader.note.toLowerCase().includes(kw) ||
      (item.reader.tags || []).some((t) => t.toLowerCase().includes(kw))
    );
  });

  function handleToggleTag(tag) {
    if (readerSelectedTags.includes(tag)) {
      readerSelectedTags = readerSelectedTags.filter((t) => t !== tag);
    } else {
      readerSelectedTags = [...readerSelectedTags, tag];
    }
  }
  $: selectedReader = readers.find((r) => r.id === selectedReaderId) || null;
  $: selectedReaderStats = selectedReader ? getReaderStats(selectedReader.id, signups, events) : null;

  $: standaloneEvents = events.filter((e) => !e.seriesId);
  $: selectedEvent = events.find((event) => event.id === selectedId) || events[0];
  $: selectedSignups = getSignupsByEvent(signups, selectedEvent?.id);
  $: selectedPendingSignups = getPendingSignups(selectedSignups);
  $: selectedRejectedSignups = getRejectedSignups(selectedSignups);
  $: selectedRegularSignups = getRegularSignups(selectedSignups);
  $: selectedWaitlistSignups = getWaitlistSignups(selectedSignups);
  $: mySignups = signups.filter((item) => mySignupIds.includes(item.id));
  $: checkedInCount = getCheckedInCount(signups);
  $: selectedCheckedInCount = getRegularCheckedInCount(selectedSignups);
  $: pendingCount = selectedPendingSignups.length;
  $: rejectedCount = selectedRejectedSignups.length;
  $: seatsLeft = selectedEvent ? Math.max(0, Number(selectedEvent.limit) - selectedRegularSignups.length) : 0;
  $: waitlistCount = selectedWaitlistSignups.length;
  $: csv = ['活动,姓名,手机,回答,报名类型,审核状态,拒绝原因,报名时间,审核时间,签到状态,签到时间,候补顺序', ...sortSignupsForCsv(selectedSignups).map((item) => `"${selectedEvent.book}","${item.name}","${item.phone}","${item.answer}","${item.status}","${item.reviewStatus}","${item.rejectionReason || '-'}","${item.createdAt}","${item.reviewedAt || '-'}","${item.checkedIn ? '已到场' : '未到场'}","${item.checkedInAt || '-'}","${item.status === '候补' ? item.waitlistPosition : '-'}"`)].join('\n');

  $: seriesWithEvents = series.map((s) => {
    const sEvents = events.filter((e) => e.seriesId === s.id).sort((a, b) => a.time.localeCompare(b.time));
    return { ...s, events: sEvents };
  });

  let lastEventLimitsRef = { current: {} };
  $: eventLimits = events.map((e) => `${e.id}:${e.limit}`).join('|');
  $: if (hydrated && eventLimits) {
    const result = processEventLimitChanges(events, signups, true, lastEventLimitsRef);
    signups = result.signups;
    lastEventLimitsRef.current = result.lastLimits;
  }

  $: if (selectedBookId) {
    const book = books.find((b) => b.id === selectedBookId);
    if (book) {
      eventForm.book = book.title;
      eventForm.author = book.author;
      eventForm.description = book.description;
      eventForm.question = book.question;
    }
  } else {
    eventForm.author = '';
    eventForm.description = '';
  }

  $: if (selectedSeriesBookId) {
    const book = books.find((b) => b.id === selectedSeriesBookId);
    if (book) {
      seriesEventForm.book = book.title;
      seriesEventForm.author = book.author;
      seriesEventForm.description = book.description;
      seriesEventForm.question = book.question;
    }
  }

  $: calData = getCalendarData(events, calYear, calMonth);
  $: todayStr = calData.todayStr;
  $: calFirstDay = calData.calFirstDay;
  $: calDaysInMonth = calData.calDaysInMonth;
  $: eventsByDate = calData.eventsByDate;

  function getSeriesOfEvent(eventId) {
    const event = events.find((e) => e.id === eventId);
    if (!event || !event.seriesId) return null;
    return series.find((s) => s.id === event.seriesId) || null;
  }

  function getSeriesEvents(seriesId) {
    return events.filter((e) => e.seriesId === seriesId).sort((a, b) => a.time.localeCompare(b.time));
  }

  function getEventIndexInSeries(eventId) {
    const event = events.find((e) => e.id === eventId);
    if (!event || !event.seriesId) return 0;
    const sEvents = getSeriesEvents(event.seriesId);
    return sEvents.findIndex((e) => e.id === eventId) + 1;
  }

  function createSeries() {
    if (!seriesForm.title.trim()) return;
    if (editingSeriesId) {
      series = series.map((s) => s.id === editingSeriesId ? { ...s, ...seriesForm } : s);
      editingSeriesId = '';
    } else {
      const s = { id: crypto.randomUUID(), ...seriesForm, createdAt: new Date().toLocaleString() };
      series = [s, ...series];
    }
    seriesForm = { title: '', description: '' };
  }

  function editSeries(s) {
    editingSeriesId = s.id;
    seriesForm = { title: s.title, description: s.description || '' };
  }

  function deleteSeries(seriesId) {
    if (!confirm('确定要删除此系列吗？系列下的活动将变为单场活动。')) return;
    events = events.map((e) => e.seriesId === seriesId ? { ...e, seriesId: undefined, seriesIndex: undefined } : e);
    series = series.filter((s) => s.id !== seriesId);
    if (selectedSeriesId === seriesId) selectedSeriesId = '';
  }

  function cancelEditSeries() {
    editingSeriesId = '';
    seriesForm = { title: '', description: '' };
  }

  function startAddEventToSeries(seriesId) {
    addingEventToSeriesId = seriesId;
    selectedSeriesBookId = '';
    seriesEventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名', reviewRequired: false };
  }

  function cancelAddEventToSeries() {
    addingEventToSeriesId = '';
    selectedSeriesBookId = '';
    seriesEventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名', reviewRequired: false };
  }

  function addEventToSeries() {
    if (!seriesEventForm.book.trim() || !seriesEventForm.host.trim() || !addingEventToSeriesId) return;
    const sEvents = getSeriesEvents(addingEventToSeriesId);
    const event = {
      id: crypto.randomUUID(),
      ...seriesEventForm,
      limit: Number(seriesEventForm.limit || 0),
      seriesId: addingEventToSeriesId,
      seriesIndex: sEvents.length + 1
    };
    events = [event, ...events];
    cancelAddEventToSeries();
  }

  function selectSeriesBookForEvent(bookId) {
    selectedSeriesBookId = bookId;
  }

  function clearSeriesBookSelection() {
    selectedSeriesBookId = '';
    seriesEventForm.book = '';
    seriesEventForm.author = '';
    seriesEventForm.description = '';
    seriesEventForm.question = '';
  }

  function selectBookForEvent(bookId) {
    selectedBookId = bookId;
  }

  function clearBookSelection() {
    selectedBookId = '';
    eventForm.book = '';
    eventForm.author = '';
    eventForm.description = '';
    eventForm.question = '';
  }

  function createEvent() {
    if (!eventForm.book.trim() || !eventForm.host.trim()) return;

    const beforeSnapshot = buildBeforeStateSnapshot({ events, signups, readers, mySignupIds, series });

    if (editingEventId) {
      const newLimit = Number(eventForm.limit || 0);
      const eventId = editingEventId;
      const prevLimit = editingEventPrevLimit;
      const beforeEvent = events.find((e) => e.id === eventId);
      const updatedEvents = events.map((e) => e.id === eventId ? { ...eventForm, id: eventId, limit: newLimit, seriesId: editingEventSeriesId, seriesIndex: editingEventSeriesIndex } : e);
      events = updatedEvents;
      let updatedSignups = signups;
      if (newLimit > prevLimit) {
        updatedSignups = promoteFromWaitlist(updatedEvents, signups, eventId);
        signups = updatedSignups;
      }

      const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events, signups, readers, mySignupIds, series });

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
      events = [event, ...events];
      selectedId = event.id;

      const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events, signups, readers, mySignupIds, series });
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
    clearBookSelection();
    eventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名', reviewRequired: false };
  }

  function editEvent(event) {
    editingEventId = event.id;
    editingEventPrevLimit = Number(event.limit);
    editingEventSeriesId = event.seriesId;
    editingEventSeriesIndex = event.seriesIndex;
    selectedBookId = '';
    eventForm = { book: event.book, author: event.author, description: event.description, host: event.host, time: event.time, limit: event.limit, question: event.question, status: event.status, reviewRequired: event.reviewRequired || false };
  }

  function cancelEditEvent() {
    editingEventId = '';
    editingEventPrevLimit = 0;
    editingEventSeriesId = undefined;
    editingEventSeriesIndex = undefined;
    clearBookSelection();
    eventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名', reviewRequired: false };
  }

  function createBook() {
    if (!bookForm.title.trim() || !bookForm.author.trim()) return;
    if (editingBookId) {
      books = books.map((b) => b.id === editingBookId ? { ...bookForm, id: editingBookId } : b);
      editingBookId = '';
    } else {
      const book = { id: crypto.randomUUID(), ...bookForm };
      books = [book, ...books];
    }
    bookForm = { title: '', author: '', description: '', question: '' };
  }

  function editBook(book) {
    bookForm = { title: book.title, author: book.author, description: book.description, question: book.question };
    editingBookId = book.id;
  }

  function deleteBook(id) {
    books = books.filter((b) => b.id !== id);
    if (selectedBookId === id) {
      clearBookSelection();
    }
  }

  function cancelEditBook() {
    bookForm = { title: '', author: '', description: '', question: '' };
    editingBookId = '';
  }

  function dateKey(day) { return `${calYear}-${padFn(calMonth + 1)}-${padFn(day)}`; }
  function prevMonth() {
    if (calMonth === 0) { calMonth = 11; calYear--; }
    else calMonth--;
    activeDate = '';
  }
  function nextMonth() {
    if (calMonth === 11) { calMonth = 0; calYear++; }
    else calMonth++;
    activeDate = '';
  }
  function toggleDay(day) {
    const result = handleCalendarDayToggle(eventsByDate, day, calYear, calMonth, selectedId, activeDate);
    if (result.found) {
      selectedId = result.selectedId;
      activeDate = result.activeDate;
    }
  }

  function signup() {
    if (!selectedEvent || selectedEvent.status !== '开放报名' || !signupForm.name.trim()) return;
    const result = handleSignupSubmit(events, signups, readers, mySignupIds, selectedEvent.id, signupForm);
    if (result.success) {
      signups = result.signups;
      readers = result.readers;
      mySignupIds = result.mySignupIds;
      signupForm = { name: '', phone: '', answer: '' };
      matchedReaderInfo = null;
    }
  }

  function cancelSignup(id) {
    const signup = signups.find((item) => item.id === id);
    const beforeSnapshot = buildBeforeStateSnapshot({ events, signups, readers, mySignupIds, series });
    const event = events.find((e) => e.id === signup?.eventId);

    const result = handleSignupCancel(events, signups, mySignupIds, id);
    signups = result.signups;
    mySignupIds = result.mySignupIds;

    if (signup) {
      const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events, signups, readers, mySignupIds, series });
      const target = { signupId: id, eventId: signup.eventId, readerId: signup.readerId, eventName: event?.book || '', readerName: signup.name };
      const description = generateDescription(OPERATION_TYPES.CANCEL_SIGNUP, target, { name: signup.name });
      const res = recordOperation(
        operationLogs,
        OPERATION_TYPES.CANCEL_SIGNUP,
        description,
        target,
        beforeSnapshot,
        afterSnapshot,
        { name: signup.name, phone: signup.phone, eventName: event?.book, originalSignup: signup }
      );
      operationLogs = res.logs;
    }
  }

  function toggleEventStatus(id) {
    events = toggleEventStatusAction(events, id);
  }

  function toggleCheckIn(id) {
    const signup = signups.find((item) => item.id === id);
    const beforeSnapshot = buildBeforeStateSnapshot({ events, signups, readers, mySignupIds, series });
    const event = events.find((e) => e.id === signup?.eventId);
    const willCheckIn = signup && !signup.checkedIn;

    signups = toggleCheckInAction(signups, id);

    if (signup) {
      const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events, signups, readers, mySignupIds, series });
      const target = { signupId: id, eventId: signup.eventId, readerId: signup.readerId, eventName: event?.book || '', readerName: signup.name };
      const description = generateDescription(OPERATION_TYPES.CHECK_IN, target, { name: signup.name, checkedIn: willCheckIn });
      const res = recordOperation(
        operationLogs,
        OPERATION_TYPES.CHECK_IN,
        description,
        target,
        beforeSnapshot,
        afterSnapshot,
        { name: signup.name, phone: signup.phone, eventName: event?.book, checkedIn: willCheckIn }
      );
      operationLogs = res.logs;
    }
  }

  function approveSignup(id) {
    const signup = signups.find((item) => item.id === id);
    const beforeSnapshot = buildBeforeStateSnapshot({ events, signups, readers, mySignupIds, series });
    const event = events.find((e) => e.id === signup?.eventId);

    signups = approveSignupAction(events, signups, id);

    if (signup) {
      const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events, signups, readers, mySignupIds, series });
      const target = { signupId: id, eventId: signup.eventId, readerId: signup.readerId, eventName: event?.book || '', readerName: signup.name };
      const description = generateDescription(OPERATION_TYPES.APPROVE_SIGNUP, target, { name: signup.name });
      const res = recordOperation(
        operationLogs,
        OPERATION_TYPES.APPROVE_SIGNUP,
        description,
        target,
        beforeSnapshot,
        afterSnapshot,
        { name: signup.name, phone: signup.phone, eventName: event?.book }
      );
      operationLogs = res.logs;
    }
  }

  function startRejectSignup(id) {
    rejectingSignupId = id;
    rejectionReason = '';
  }

  function cancelRejectSignup() {
    rejectingSignupId = '';
    rejectionReason = '';
  }

  function confirmRejectSignup() {
    const signup = signups.find((item) => item.id === rejectingSignupId);
    const beforeSnapshot = buildBeforeStateSnapshot({ events, signups, readers, mySignupIds, series });
    const event = events.find((e) => e.id === signup?.eventId);

    signups = rejectSignupAction(signups, rejectingSignupId, rejectionReason);

    if (signup) {
      const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events, signups, readers, mySignupIds, series });
      const target = { signupId: rejectingSignupId, eventId: signup.eventId, readerId: signup.readerId, eventName: event?.book || '', readerName: signup.name };
      const description = generateDescription(OPERATION_TYPES.REJECT_SIGNUP, target, { name: signup.name });
      const res = recordOperation(
        operationLogs,
        OPERATION_TYPES.REJECT_SIGNUP,
        description,
        target,
        beforeSnapshot,
        afterSnapshot,
        { name: signup.name, phone: signup.phone, eventName: event?.book, rejectionReason }
      );
      operationLogs = res.logs;
    }

    rejectingSignupId = '';
    rejectionReason = '';
  }

  function previewImport() {
    if (!importCsvText.trim()) {
      importErrors = ['请先粘贴CSV文本'];
      return;
    }

    const parsed = csvPreviewImport({
      importCsvText,
      events,
      signups,
      readers,
      fieldMapping: Object.keys(importFieldMapping).length > 0 ? importFieldMapping : undefined,
      conflictStrategy: importConflictStrategy,
      isoFn: iso
    });

    if (parsed.headers && parsed.headers.length > 0) {
      importCsvHeaders = parsed.headers;
      if (parsed.parsed && parsed.parsed.rows && parsed.parsed.rows.length > 0) {
        importSampleRows = parsed.parsed.rows.slice(0, 3);
      } else {
        importSampleRows = [];
      }
      if (parsed.fieldMapping) {
        importFieldMapping = parsed.fieldMapping;
      }
    }

    if (parsed.errors && parsed.errors.length > 0 && !parsed.preview) {
      const hasMappingError = parsed.errors.some((e) => e.includes('字段映射'));
      if (hasMappingError && importCsvHeaders.length > 0) {
        importMappingStep = true;
      }
      importErrors = parsed.errors;
      importPreview = null;
      importStats = null;
      return;
    }

    importPreview = parsed.preview;
    importErrors = parsed.errors || [];
    importStats = parsed.stats;
    importMappingStep = false;
  }

  function confirmImport() {
    if (!importPreview) return;

    const beforeSnapshot = buildBeforeStateSnapshot({ events, signups, readers, mySignupIds, series });
    const importStatsBackup = { ...importStats };

    const result = applyImport(importPreview, readers);
    events = [...result.newEvents, ...events];
    signups = [...result.newSignups, ...signups];

    if (result.updatedSignups && result.updatedSignups.length > 0) {
      const updateMap = new Map();
      result.updatedSignups.forEach((u) => updateMap.set(u.id, u.updates));
      signups = signups.map((s) => {
        const updates = updateMap.get(s.id);
        if (!updates) return s;
        return { ...s, ...updates };
      });
    }

    if (result.readers) {
      readers = result.readers;
    }

    const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events, signups, readers, mySignupIds, series });
    const target = {
      newEventIds: result.newEvents.map((e) => e.id),
      newSignupIds: result.newSignups.map((s) => s.id),
      updatedSignupIds: (result.updatedSignups || []).map((u) => u.id)
    };
    const description = generateDescription(OPERATION_TYPES.CSV_IMPORT, target, {
      newSignupCount: importStatsBackup.newSignupCount || 0,
      newEventCount: importStatsBackup.newEventCount || 0
    });
    const res = recordOperation(
      operationLogs,
      OPERATION_TYPES.CSV_IMPORT,
      description,
      target,
      beforeSnapshot,
      afterSnapshot,
      {
        ...importStatsBackup,
        newEventCount: result.newEvents.length,
        newSignupCount: result.newSignups.length,
        updateCount: (result.updatedSignups || []).length,
        conflictStrategy: importConflictStrategy
      }
    );
    operationLogs = res.logs;

    importCsvText = '';
    importPreview = null;
    importErrors = [];
    importStats = null;
    importCsvHeaders = [];
    importFieldMapping = {};
    importConflictStrategy = 'skip';
    importMappingStep = false;
    importSampleRows = [];
  }

  function cancelImport() {
    importCsvText = '';
    importPreview = null;
    importErrors = [];
    importStats = null;
    importCsvHeaders = [];
    importFieldMapping = {};
    importConflictStrategy = 'skip';
    importMappingStep = false;
    importSampleRows = [];
  }

  function openMappingStep() {
    if (!importCsvText.trim()) return;
    const detectResult = csvPreviewImport({
      importCsvText,
      events,
      signups,
      readers,
      conflictStrategy: importConflictStrategy,
      isoFn: iso
    });
    if (detectResult.headers && detectResult.headers.length > 0) {
      importCsvHeaders = detectResult.headers;
      importFieldMapping = detectResult.fieldMapping || autoDetectMapping(detectResult.headers);
      if (detectResult.parsed && detectResult.parsed.rows && detectResult.parsed.rows.length > 0) {
        importSampleRows = detectResult.parsed.rows.slice(0, 3);
      }
      importMappingStep = true;
      importErrors = [];
      importPreview = null;
      importStats = null;
    }
  }

  function openPublicLinkForEvent(eventId) {
    publicLinkModalType = 'single';
    publicLinkTargetEventId = eventId;
    publicLinkTargetSeriesId = '';
    showPublicLinkModal = true;
  }

  function openPublicLinkForSeries(seriesId) {
    publicLinkModalType = 'series';
    publicLinkTargetEventId = '';
    publicLinkTargetSeriesId = seriesId;
    showPublicLinkModal = true;
  }

  function closePublicLinkModal() {
    showPublicLinkModal = false;
    copiedLinkId = '';
    publicLinkTargetEventId = '';
    publicLinkTargetSeriesId = '';
  }

  function handleModalOverlayClick(event) {
    if (event.target === event.currentTarget) {
      closePublicLinkModal();
    }
  }

  async function handleCopyLink(text, id) {
    try {
      await copyToClipboard(text);
      copiedLinkId = id;
      setTimeout(() => { copiedLinkId = ''; }, 2000);
    } catch (e) {
      alert('复制失败，请手动复制');
    }
  }

  function previewPublicPage(url) {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  function handleUndoOperation(logId) {
    const currentState = { events, signups, readers, mySignupIds, series };
    const result = undoOperation(operationLogs, logId, currentState);
    if (result.success) {
      operationLogs = result.logs;
      events = result.state.events;
      signups = result.state.signups;
      readers = result.state.readers;
      mySignupIds = result.state.mySignupIds;
      series = result.state.series;
      lastUndoMessage = `已撤销：${result.undoneLog.description}`;
      setTimeout(() => { lastUndoMessage = ''; }, 3000);
    } else {
      lastUndoMessage = `撤销失败：${result.reason}`;
      setTimeout(() => { lastUndoMessage = ''; }, 3000);
    }
  }

  function handleUndoLastN() {
    const n = Math.max(1, Math.min(100, Number(undoCountInput) || 1));
    const currentState = { events, signups, readers, mySignupIds, series };
    const result = undoLastNOperations(operationLogs, n, currentState);
    if (result.success) {
      operationLogs = result.logs;
      events = result.state.events;
      signups = result.state.signups;
      readers = result.state.readers;
      mySignupIds = result.state.mySignupIds;
      series = result.state.series;
      lastUndoMessage = `已撤销 ${result.undoneCount} 次操作`;
      setTimeout(() => { lastUndoMessage = ''; }, 3000);
    } else {
      lastUndoMessage = '没有可撤销的操作';
      setTimeout(() => { lastUndoMessage = ''; }, 3000);
    }
  }

  function toggleOperationLogPanel() {
    showOperationLogPanel = !showOperationLogPanel;
  }

  function formatTimestamp(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString('zh-CN', { hour12: false });
    } catch (e) {
      return ts;
    }
  }

  $: undoableLogs = getUndoableLogs(operationLogs);
  $: undoableCount = undoableLogs.length;
  $: latestUndoableId = undoableLogs.length > 0 ? undoableLogs[0].id : null;
</script>

<main>
  <header class="hero">
    <div>
      <span>独立书店</span>
      <h1>读书会排期</h1>
    </div>
    <div class="mode">
      <button class:active={mode === '用户端'} on:click={() => mode = '用户端'}>用户端</button>
      <button class:active={mode === '管理端'} on:click={() => mode = '管理端'}>管理端</button>
      {#if mode === '管理端'}
        <button class="log-btn" class:active={showOperationLogPanel} on:click={toggleOperationLogPanel} title="操作日志与撤销">
          📋 操作日志 {#if undoableCount > 0}<span class="log-badge">{undoableCount}</span>{/if}
        </button>
      {/if}
    </div>
  </header>

  {#if lastUndoMessage}
    <div class="undo-toast">
      <CheckCircle2 size={16} />
      <span>{lastUndoMessage}</span>
    </div>
  {/if}

  {#if _conflictBanner}
    <div class="sync-conflict-banner">
      <span class="sync-conflict-text">⚠️ 其他标签页已更新：{_conflictBanner}</span>
      <div class="sync-conflict-actions">
        <button class="sync-refresh-btn" on:click={handleConflictRefresh}>刷新数据</button>
        <button class="sync-dismiss-btn" on:click={handleConflictDismiss}>继续编辑</button>
      </div>
    </div>
  {/if}

  <section class="metrics">
    <article><LibraryBig size={22} /><strong>{events.length}</strong><span>活动</span></article>
    <article><Layers size={22} /><strong>{series.length}</strong><span>系列</span></article>
    <article><Users size={22} /><strong>{signups.length}</strong><span>报名</span></article>
    <article><UserCog size={22} /><strong>{readers.length}</strong><span>会员读者</span></article>
    <article><ListChecks size={22} /><strong>{events.filter((event) => event.status === '开放报名').length}</strong><span>开放中</span></article>
    <article><UserCheck size={22} /><strong>{checkedInCount}</strong><span>已签到</span></article>
  </section>

  <section class="layout">
    <aside class="panel">
      <div class="panelHeader">
        <h2>活动列表</h2>
        <div class="viewToggle">
          <button class:active={viewMode === '列表'} on:click={() => viewMode = '列表'}>列表</button>
          <button class:active={viewMode === '月历'} on:click={() => viewMode = '月历'}>月历</button>
        </div>
      </div>
      {#if viewMode === '列表'}
        <div class="listViewTabs">
          <button class:active={listViewTab === '全部活动'} on:click={() => { listViewTab = '全部活动'; selectedSeriesId = ''; }}>全部活动</button>
          <button class:active={listViewTab === '按系列'} on:click={() => listViewTab = '按系列'}>按系列</button>
          <button class:active={listViewTab === '单场活动'} on:click={() => { listViewTab = '单场活动'; selectedSeriesId = ''; }}>单场</button>
        </div>
        {#if listViewTab === '全部活动' || listViewTab === '单场活动'}
          {#each (listViewTab === '单场活动' ? standaloneEvents : events) as event}
            <div class="eventItem">
              <button class:event-active={selectedEvent?.id === event.id} class="eventButton" on:click={() => selectedId = event.id}>
                <strong>{event.book}</strong>
                {#if event.seriesId}
                  {@const s = getSeriesOfEvent(event.id)}
                  {#if s}
                    <span class="seriesTag">📚 {s.title} · 第{getEventIndexInSeries(event.id)}期</span>
                  {/if}
                {/if}
                <span>{event.host} · {event.time.replace('T', ' ')}</span>
              </button>
              {#if mode === '管理端'}
                <button class="ghost editEventBtn" on:click={(e) => { e.stopPropagation(); editEvent(event); }}>编辑</button>
                <button class="ghost editEventBtn shareBtn" on:click={(e) => { e.stopPropagation(); openPublicLinkForEvent(event.id); }} title="生成公开报名链接">
                  <Share2 size={14} />
                </button>
              {/if}
            </div>
          {/each}
        {:else if listViewTab === '按系列'}
          {#if series.length === 0}
            <p class="empty empty-small">暂无系列活动</p>
          {/if}
          {#each seriesWithEvents as s}
            <div class="seriesGroup">
              <button class="seriesHeader" class:series-expanded={selectedSeriesId === s.id} on:click={() => selectedSeriesId = selectedSeriesId === s.id ? '' : s.id}>
                <Layers size={14} />
                <strong>{s.title}</strong>
                <span class="seriesCount">{s.events.length}期</span>
                <span style:transform={selectedSeriesId === s.id ? 'rotate(90deg)' : 'rotate(0deg)'} style:transition="transform .2s" style:color="#8a7f6a" style:display="inline-flex" style:align-items="center"><ChevronRight size={14} /></span>
              </button>
              {#if selectedSeriesId === s.id}
                <div class="seriesEvents">
                  {#if s.description}
                    <p class="seriesDesc">{s.description}</p>
                  {/if}
                  {#if s.events.length === 0}
                    <p class="empty empty-small">暂无场次，管理端可添加</p>
                  {/if}
                  {#each s.events as event, idx}
                    <div class="eventItem eventItem-series">
                      <button class:event-active={selectedEvent?.id === event.id} class="eventButton" on:click={() => selectedId = event.id}>
                        <span class="episodeBadge">第{idx + 1}期</span>
                        <strong>{event.book}</strong>
                        <span>{event.host} · {event.time.replace('T', ' ')}</span>
                      </button>
                      {#if mode === '管理端'}
                        <button class="ghost editEventBtn" on:click={(e) => { e.stopPropagation(); editEvent(event); }}>编辑</button>
                        <button class="ghost editEventBtn shareBtn" on:click={(e) => { e.stopPropagation(); openPublicLinkForEvent(event.id); }} title="生成公开报名链接">
                          <Share2 size={12} />
                        </button>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      {:else}
        <div class="calendar">
          <div class="calNav">
            <button class="calArrow" on:click={prevMonth}>‹</button>
            <strong>{calYear}年{calMonth + 1}月</strong>
            <button class="calArrow" on:click={nextMonth}>›</button>
          </div>
          <div class="calGrid">
            <span class="calWeekday">日</span>
            <span class="calWeekday">一</span>
            <span class="calWeekday">二</span>
            <span class="calWeekday">三</span>
            <span class="calWeekday">四</span>
            <span class="calWeekday">五</span>
            <span class="calWeekday">六</span>
            {#each Array(calFirstDay) as _}
              <span class="calEmpty"></span>
            {/each}
            {#each Array(calDaysInMonth) as _, i}
              {@const day = i + 1}
              {@const key = dateKey(day)}
              {@const dayEvents = eventsByDate[key] || []}
              {@const isToday = todayStr === key}
              {@const isSelected = dayEvents.some(e => e.id === selectedId)}
              {@const isExpanded = activeDate === key}
              <button class="calDay" class:calToday={isToday} class:calSelected={isSelected} class:calHasEvents={dayEvents.length > 0} class:calExpanded={isExpanded} on:click={() => toggleDay(day)} disabled={dayEvents.length === 0}>
                <span class="calDayNum">{day}</span>
                {#if dayEvents.length > 0}
                  <span class="calBadge">{dayEvents.length}</span>
                  <span class="calBookNames">{dayEvents.map(e => e.book).join('、')}</span>
                {/if}
              </button>
            {/each}
          </div>
          {#if activeDate && eventsByDate[activeDate]}
            <div class="calExpandedPanel">
              <div class="calExpandedHead">
                <strong>{activeDate} · 当日活动 ({eventsByDate[activeDate].length})</strong>
                <button class="calClose" on:click={() => activeDate = ''}>×</button>
              </div>
              <div class="calExpandedList">
                {#each eventsByDate[activeDate] as event}
                  <button class="calEventItem" class:event-active={selectedId === event.id} on:click={() => { selectedId = event.id; activeDate = ''; }}>
                    <strong>{event.book}</strong>
                    <span>{event.host} · {event.time.replace('T', ' ')} · {event.status}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </aside>

    {#if mode === '用户端'}
      <section class="panel">
        {#if selectedEvent}
          {@const eventSeries = getSeriesOfEvent(selectedEvent.id)}
          {@const seriesEvents = eventSeries ? getSeriesEvents(eventSeries.id) : []}
          {#if eventSeries}
            <div class="seriesBanner">
              <div class="seriesBannerInfo">
                <Layers size={16} />
                <span class="seriesBannerLabel">系列活动</span>
                <strong>{eventSeries.title}</strong>
                {#if seriesEvents.length > 0}
                  <span class="seriesBannerCount">共 {seriesEvents.length} 期</span>
                {/if}
              </div>
              <span class="seriesBannerEpisode">第 {getEventIndexInSeries(selectedEvent.id)} 期</span>
            </div>
          {/if}
          <div class="eventHead">
            <div>
              <h2>{selectedEvent.book}</h2>
              {#if selectedEvent.author}
                <p class="author">作者：{selectedEvent.author}</p>
              {/if}
              <p>{selectedEvent.host} · {selectedEvent.time.replace('T', ' ')} · {selectedEvent.status}</p>
            </div>
            <div class="seatsInfo">
              <strong>{seatsLeft}个余位</strong>
              {#if waitlistCount > 0}
                <span class="waitlistCount">{waitlistCount}人候补</span>
              {/if}
            </div>
          </div>
          {#if selectedEvent.description}
            <div class="bookDescription">
              <h3>书目简介</h3>
              <p>{selectedEvent.description}</p>
            </div>
          {/if}
          {#if eventSeries && eventSeries.description}
            <div class="bookDescription seriesDescription">
              <h3>系列主题</h3>
              <p>{eventSeries.description}</p>
            </div>
          {/if}
          <form on:submit|preventDefault={signup}>
            <input bind:value={signupForm.name} placeholder="姓名" />
            <input bind:value={signupForm.phone} placeholder="联系方式" />
            {#if matchedReaderInfo}
              <div class="readerMatchNotice">
                <span>👤 已识别老读者：{matchedReaderInfo.name}</span>
                {#if matchedReaderInfo.tags && matchedReaderInfo.tags.length > 0}
                  <div class="readerMatchTags">
                    {#each matchedReaderInfo.tags as tag}
                      <span class="readerMatchTag">{tag}</span>
                    {/each}
                  </div>
                {/if}
                {#if matchedReaderInfo.note}
                  <span class="readerNote">历史备注：{matchedReaderInfo.note}</span>
                {/if}
              </div>
            {/if}
            <textarea bind:value={signupForm.answer} placeholder={selectedEvent.question || '报名备注'}></textarea>
            {#if selectedEvent.reviewRequired}
              <p class="reviewNotice">📋 本活动需要审核，提交后请等待管理员审核通过</p>
            {:else if seatsLeft <= 0 && selectedEvent.status === '开放报名'}
              <p class="waitlistNotice">⚠️ 活动已报满，提交后将加入候补名单</p>
            {/if}
            {#if selectedEvent.status === '已关闭'}
              <p class="waitlistNotice">🔒 报名已关闭，无法提交新申请</p>
            {/if}
            <button disabled={selectedEvent.status !== '开放报名'}>
              {selectedEvent.status !== '开放报名' ? '报名已关闭' : (selectedEvent.reviewRequired ? '提交审核' : (seatsLeft <= 0 ? '加入候补' : '提交报名'))}
            </button>
          </form>
          {#if eventSeries && seriesEvents.length > 1}
            <div class="seriesEventsPanel">
              <h3>📚 本系列全部场次</h3>
              <div class="seriesEventsList">
                {#each seriesEvents as ev, idx}
                  <button class="seriesEventItem" class:seriesEventItem-active={ev.id === selectedEvent.id} on:click={() => selectedId = ev.id}>
                    <span class="episodeBadge small">第{idx + 1}期</span>
                    <div class="seriesEventInfo">
                      <strong>{ev.book}</strong>
                      <span>{ev.host} · {ev.time.replace('T', ' ')}</span>
                    </div>
                    <span class="status-badge {ev.status === '开放报名' ? 'regular' : 'waitlist'}">{ev.status}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
          {#if mySignups.length > 0}
            <div class="mySignups">
              <h3>我的报名</h3>
              {#each mySignups as item}
                {@const event = events.find((e) => e.id === item.eventId)}
                <article class="mySignup-card" class:waitlist-card={item.status === '候补'} class:pending-card={item.reviewStatus === '待审核'} class:rejected-card={item.reviewStatus === '已拒绝'}>
                  <strong>{event?.book || '未知活动'}</strong>
                  <span>{event?.host} · {event?.time?.replace('T', ' ')}</span>
                  <span>报名时间：{item.createdAt}</span>
                  <div class="mySignup-status">
                    {#if item.reviewStatus === '待审核'}
                      <span class="status-badge pending">待审核</span>
                    {:else if item.reviewStatus === '已拒绝'}
                      <span class="status-badge rejected">已拒绝</span>
                    {:else if item.status === '正式'}
                      <span class="status-badge regular">正式报名</span>
                    {:else if item.status === '候补'}
                      <span class="status-badge waitlist">候补 #{item.waitlistPosition}</span>
                    {/if}
                    {#if item.reviewStatus === '已通过' && item.status === '正式'}
                      <span class="checkin-badge" class:checked={item.checkedIn} class:unchecked={!item.checkedIn}>
                        {item.checkedIn ? '已到场' : '未到场'}
                      </span>
                    {/if}
                    {#if item.checkedIn && item.checkedInAt}
                      <span class="checkin-time">签到时间：{item.checkedInAt}</span>
                    {/if}
                    {#if item.reviewStatus === '已拒绝' && item.rejectionReason}
                      <span class="rejection-reason-display">拒绝原因：{item.rejectionReason}</span>
                    {/if}
                  </div>
                  <button class="ghost cancel-btn" on:click={() => cancelSignup(item.id)}>
                    {item.reviewStatus === '待审核' ? '取消申请' : (item.reviewStatus === '已拒绝' ? '删除记录' : (item.status === '正式' ? '取消报名' : '退出候补'))}
                  </button>
                </article>
              {/each}
            </div>
          {/if}
        {/if}
      </section>
    {:else}
      <div class="adminLayout">
        <div class="adminTabs">
          <button class:active={adminTab === '活动管理'} on:click={() => adminTab = '活动管理'}>活动管理</button>
          <button class:active={adminTab === '系列活动'} on:click={() => adminTab = '系列活动'}>系列活动</button>
          <button class:active={adminTab === '书目库'} on:click={() => adminTab = '书目库'}>书目库</button>
          <button class:active={adminTab === '会员读者'} on:click={() => adminTab = '会员读者'}>会员读者</button>
          <button class:active={adminTab === '运营看板'} on:click={() => adminTab = '运营看板'}>运营看板</button>
          <button class:active={adminTab === '数据导入'} on:click={() => adminTab = '数据导入'}>数据导入</button>
        </div>

        {#if adminTab === '系列活动'}
          <section class="bookLibrary">
            <form class="panel bookForm" on:submit|preventDefault={createSeries}>
              <h2><Layers size={18} />{editingSeriesId ? '编辑系列' : '创建系列'}</h2>
              <input bind:value={seriesForm.title} placeholder="系列总主题（如：女性文学三部曲）" />
              <textarea bind:value={seriesForm.description} placeholder="系列简介/主题说明"></textarea>
              <div class="formActions">
                <button>{editingSeriesId ? '保存修改' : '创建系列'}</button>
                {#if editingSeriesId}
                  <button type="button" class="ghost" on:click={cancelEditSeries}>取消</button>
                {/if}
              </div>
            </form>

            <section class="panel bookList">
              <h2><Layers size={18} />系列列表 ({series.length})</h2>
              {#if series.length === 0}
                <p class="empty">暂无系列，创建第一个读书会系列吧</p>
              {:else}
                {#each seriesWithEvents as s}
                  <article class="bookCard seriesCard">
                    <div class="bookInfo">
                      <strong>{s.title}</strong>
                      {#if s.description}
                        <p class="desc">{s.description}</p>
                      {/if}
                      <span class="question">共 {s.events.length} 期</span>

                      {#if s.events.length > 0}
                        <div class="seriesEpisodes">
                          {#each s.events as ev, idx}
                            <div class="episodeRow">
                              <span class="episodeBadge small">第{idx + 1}期</span>
                              <span class="episodeTitle">{ev.book}</span>
                              <span class="episodeMeta">{ev.host} · {ev.time.replace('T', ' ')}</span>
                              <button class="ghost episodeEditBtn" on:click={(e) => { e.stopPropagation(); editEvent(ev); adminTab = '活动管理'; }}>编辑</button>
                            </div>
                          {/each}
                        </div>
                      {/if}

                      {#if addingEventToSeriesId === s.id}
                        <div class="addEpisodeForm">
                          <h4>添加新场次</h4>
                          <div class="bookSelector">
                            <label for="seriesBookSelector">从书目库选择</label>
                            <div class="bookSelectorRow">
                              <select id="seriesBookSelector" bind:value={selectedSeriesBookId} on:change={(e) => selectSeriesBookForEvent(e.target.value)}>
                                <option value="">手动输入书名</option>
                                {#each books as book}
                                  <option value={book.id}>{book.title} · {book.author}</option>
                                {/each}
                              </select>
                              {#if selectedSeriesBookId}
                                <button type="button" class="ghost clearBtn" on:click={clearSeriesBookSelection} title="清除选择">
                                  <X size={16} />
                                </button>
                              {/if}
                            </div>
                          </div>
                          <input bind:value={seriesEventForm.book} placeholder="书名" />
                          <input bind:value={seriesEventForm.author} placeholder="作者" />
                          <textarea bind:value={seriesEventForm.description} placeholder="书目简介"></textarea>
                          <input bind:value={seriesEventForm.host} placeholder="主讲人" />
                          <input bind:value={seriesEventForm.time} type="datetime-local" />
                          <input bind:value={seriesEventForm.limit} type="number" min="1" placeholder="人数上限" />
                          <input bind:value={seriesEventForm.question} placeholder="报名问题" />
                          <select bind:value={seriesEventForm.status}>
                            <option>开放报名</option>
                            <option>已关闭</option>
                          </select>
                          <div class="reviewSetting">
                            <label class="reviewLabel">
                              <input type="checkbox" bind:checked={seriesEventForm.reviewRequired} />
                              <span>报名需要审核</span>
                            </label>
                            <p class="reviewHint">{seriesEventForm.reviewRequired ? '用户提交后需管理员审核通过才占用名额' : '用户提交后直接占用名额'}</p>
                          </div>
                          <div class="formActions">
                            <button type="button" on:click={addEventToSeries}>添加到此系列</button>
                            <button type="button" class="ghost" on:click={cancelAddEventToSeries}>取消</button>
                          </div>
                        </div>
                      {:else}
                        <button class="ghost addEpisodeBtn" on:click={() => startAddEventToSeries(s.id)}>
                          <Plus size={14} /> 添加场次
                        </button>
                      {/if}
                    </div>
                    <div class="bookActions">
                      <button class="ghost" on:click={() => openPublicLinkForSeries(s.id)}>
                        <Share2 size={14} /> 分享
                      </button>
                      <button class="ghost" on:click={() => editSeries(s)}>编辑</button>
                      <button class="ghost danger" on:click={() => deleteSeries(s.id)}>
                        <Trash2 size={14} /> 删除
                      </button>
                    </div>
                  </article>
                {/each}
              {/if}
            </section>
          </section>
        {:else if adminTab === '活动管理'}
          <section class="adminGrid">
            <div class="panel">
              <form on:submit|preventDefault={createEvent}>
                <h2><CalendarPlus size={18} />{editingEventId ? '编辑活动' : '创建活动'}</h2>

                <div class="bookSelector">
                  <label for="bookSelector">从书目库选择</label>
                  <div class="bookSelectorRow">
                    <select id="bookSelector" bind:value={selectedBookId} on:change={(e) => selectBookForEvent(e.target.value)}>
                      <option value="">手动输入书名</option>
                      {#each books as book}
                        <option value={book.id}>{book.title} · {book.author}</option>
                      {/each}
                    </select>
                    {#if selectedBookId}
                      <button type="button" class="ghost clearBtn" on:click={clearBookSelection} title="清除选择">
                        <X size={16} />
                      </button>
                    {/if}
                  </div>
                </div>

                <input bind:value={eventForm.book} placeholder="书名" />
                <input bind:value={eventForm.author} placeholder="作者" />
                <textarea bind:value={eventForm.description} placeholder="书目简介"></textarea>
                <input bind:value={eventForm.host} placeholder="主讲人" />
                <input bind:value={eventForm.time} type="datetime-local" />
                <input bind:value={eventForm.limit} type="number" min="1" placeholder="人数上限" />
                <input bind:value={eventForm.question} placeholder="报名问题" />
                <select bind:value={eventForm.status}>
                  <option>开放报名</option>
                  <option>已关闭</option>
                </select>
                <div class="reviewSetting">
                  <label class="reviewLabel">
                    <input type="checkbox" bind:checked={eventForm.reviewRequired} />
                    <span>报名需要审核</span>
                  </label>
                  <p class="reviewHint">{eventForm.reviewRequired ? '用户提交后需管理员审核通过才占用名额' : '用户提交后直接占用名额'}</p>
                </div>
                <div class="formActions">
                  <button>{editingEventId ? '保存修改' : '保存活动'}</button>
                  {#if editingEventId}
                    <button type="button" class="ghost" on:click={cancelEditEvent}>取消</button>
                  {/if}
                </div>
              </form>
            </div>

            {#if showPrintView && selectedEvent}
              <SignupPrintView
                event={selectedEvent}
                signups={selectedSignups}
                onBack={() => showPrintView = false}
              />
            {:else}
            <section class="panel" bind:this={signupListContainer}>
              <div class="eventHead">
                <h2>报名名单</h2>
                <div class="eventHead-actions">
                  <span class="checkin-summary">
                    正式 {selectedRegularSignups.length}/{selectedEvent?.limit || 0} ·
                    候补 {waitlistCount} ·
                    {#if selectedEvent?.reviewRequired}
                      <span class="pending-indicator">待审 {pendingCount} ·</span>
                      <span class="rejected-indicator">已拒 {rejectedCount} ·</span>
                    {/if}
                    签到 {selectedCheckedInCount}/{selectedRegularSignups.length}
                  </span>
                  {#if selectedEvent}<button class="ghost" on:click={() => toggleEventStatus(selectedEvent.id)}>{selectedEvent.status === '开放报名' ? '关闭报名' : '开放报名'}</button>{/if}
                  {#if selectedEvent}<button class="ghost printListBtn" on:click={() => openPublicLinkForEvent(selectedEvent.id)}><Share2 size={16} /> 公开链接</button>{/if}
                  {#if selectedEvent}<button class="ghost printListBtn" on:click={() => showPrintView = true}><Printer size={16} /> 打印名单</button>{/if}
                </div>
              </div>

              {#if selectedEvent?.reviewRequired && selectedPendingSignups.length > 0}
                <h3 class="signupSectionTitle pendingSectionTitle">待审核 ({pendingCount})</h3>
                <div class="signupList">
                  {#each selectedPendingSignups as item}
                    {@const pendingReader = item.readerId ? readers.find(r => r.id === item.readerId) : findReaderByPhone(readers, item.phone)}
                    <article class="pending-card">
                      {#if rejectingSignupId === item.id}
                        <div class="rejectForm">
                          <h4>拒绝原因</h4>
                          <textarea bind:value={rejectionReason} placeholder="请填写拒绝原因"></textarea>
                          <div class="formActions">
                            <button on:click={confirmRejectSignup} disabled={!rejectionReason.trim()}>确认拒绝</button>
                            <button type="button" class="ghost" on:click={cancelRejectSignup}>取消</button>
                          </div>
                        </div>
                      {:else}
                        <div class="signupRow">
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.phone} · {item.createdAt}</span>
                            {#if pendingReader && pendingReader.tags && pendingReader.tags.length > 0}
                              <div class="pendingReaderTags">
                                {#each pendingReader.tags.slice(0, 3) as tag}
                                  <span class="pendingTagChip">{tag}</span>
                                {/each}
                                {#if pendingReader.tags.length > 3}
                                  <span class="pendingTagMore">+{pendingReader.tags.length - 3}</span>
                                {/if}
                              </div>
                            {/if}
                            <p>{item.answer}</p>
                          </div>
                          <span class="status-badge pending">待审核</span>
                        </div>
                        <div class="signupActions">
                          <button class="ghost approve-btn" on:click={() => approveSignup(item.id)}>✓ 通过</button>
                          <button class="ghost danger reject-btn" on:click={() => startRejectSignup(item.id)}>✗ 拒绝</button>
                        </div>
                      {/if}
                    </article>
                  {/each}
                </div>
              {/if}

              {#if selectedRegularSignups.length > 0}
                <h3 class="signupSectionTitle">正式报名 ({selectedRegularSignups.length})</h3>
                <div class="signupList">
                  {#each selectedRegularSignups as item}
                    <article class="regular-card">
                      <div class="signupRow">
                        <div>
                          <strong>{item.name}</strong>
                          <span>{item.phone} · {item.createdAt}</span>
                          <p>{item.answer}</p>
                          {#if item.checkedIn && item.checkedInAt}
                            <span class="checkin-time">签到时间：{item.checkedInAt}</span>
                          {/if}
                        </div>
                        <div class="badgeGroup">
                          <span class="status-badge regular">正式</span>
                          <span class="checkin-badge" class:checked={item.checkedIn} class:unchecked={!item.checkedIn}>
                            {item.checkedIn ? '已到场' : '未到场'}
                          </span>
                        </div>
                      </div>
                      <div class="signupActions">
                        <button class="ghost checkin-btn" class:checkin-active={item.checkedIn} on:click={() => toggleCheckIn(item.id)}>
                          {item.checkedIn ? '标记未到场' : '标记已到场'}
                        </button>
                        <button class="ghost" on:click={() => cancelSignup(item.id)}>取消报名</button>
                      </div>
                    </article>
                  {/each}
                </div>
              {/if}

              {#if selectedWaitlistSignups.length > 0}
                <h3 class="signupSectionTitle waitlistSectionTitle">候补名单 ({waitlistCount})</h3>
                <div class="signupList">
                  {#each selectedWaitlistSignups as item}
                    <article class="waitlist-card">
                      <div class="signupRow">
                        <div>
                          <strong>{item.name}</strong>
                          <span>{item.phone} · {item.createdAt}</span>
                          <p>{item.answer}</p>
                        </div>
                        <span class="status-badge waitlist">候补 #{item.waitlistPosition}</span>
                      </div>
                      <div class="signupActions">
                        <button class="ghost" on:click={() => cancelSignup(item.id)}>退出候补</button>
                      </div>
                    </article>
                  {/each}
                </div>
              {/if}

              {#if selectedEvent?.reviewRequired && selectedRejectedSignups.length > 0}
                <h3 class="signupSectionTitle rejectedSectionTitle">已拒绝 ({rejectedCount})</h3>
                <div class="signupList">
                  {#each selectedRejectedSignups as item}
                    <article class="rejected-card">
                      <div class="signupRow">
                        <div>
                          <strong>{item.name}</strong>
                          <span>{item.phone} · {item.createdAt} · 拒绝时间：{item.reviewedAt}</span>
                          <p>{item.answer}</p>
                          <p class="rejection-reason">拒绝原因：{item.rejectionReason}</p>
                        </div>
                        <span class="status-badge rejected">已拒绝</span>
                      </div>
                      <div class="signupActions">
                        <button class="ghost" on:click={() => cancelSignup(item.id)}>删除记录</button>
                      </div>
                    </article>
                  {/each}
                </div>
              {/if}

              {#if selectedSignups.length === 0}
                <p class="empty">暂无报名</p>
              {/if}
              <label class="csv"><Download size={16} />CSV文本<textarea readonly value={csv}></textarea></label>
            </section>
            {/if}
          </section>
        {:else if adminTab === '书目库'}
          <section class="bookLibrary">
            <form class="panel bookForm" on:submit|preventDefault={createBook}>
              <h2><BookPlus size={18} />{editingBookId ? '编辑书籍' : '添加书籍'}</h2>
              <input bind:value={bookForm.title} placeholder="书名" />
              <input bind:value={bookForm.author} placeholder="作者" />
              <textarea bind:value={bookForm.description} placeholder="书目简介"></textarea>
              <input bind:value={bookForm.question} placeholder="默认讨论问题" />
              <div class="formActions">
                <button>{editingBookId ? '保存修改' : '添加到书目库'}</button>
                {#if editingBookId}
                  <button type="button" class="ghost" on:click={cancelEditBook}>取消</button>
                {/if}
              </div>
            </form>

            <section class="panel bookList">
              <h2><LibraryBig size={18} />书目库 ({books.length})</h2>
              {#if books.length === 0}
                <p class="empty">书库为空，添加第一本书吧</p>
              {:else}
                {#each books as book}
                  <article class="bookCard">
                    <div class="bookInfo">
                      <strong>{book.title}</strong>
                      <span class="author">作者：{book.author}</span>
                      {#if book.description}
                        <p class="desc">{book.description}</p>
                      {/if}
                      {#if book.question}
                        <span class="question">默认问题：{book.question}</span>
                      {/if}
                    </div>
                    <div class="bookActions">
                      <button class="ghost" on:click={() => editBook(book)}>编辑</button>
                      <button class="ghost danger" on:click={() => deleteBook(book.id)}>删除</button>
                    </div>
                  </article>
                {/each}
              {/if}
            </section>
          </section>
        {:else if adminTab === '会员读者'}
          <section class="readerManagement">
            {#if migrationStats}
              <div class="migrationNotice">
                <strong>🎉 数据迁移完成！</strong>
                <span>新增 {migrationStats.newReaders} 位读者，更新 {migrationStats.updatedReaders} 位读者信息，关联 {migrationStats.linkedCount} 条报名记录</span>
                <button class="ghost small" on:click={() => migrationStats = null}>关闭</button>
              </div>
            {/if}
            {#if selectedReader && selectedReaderStats}
              <ReaderDetail
                reader={selectedReader}
                stats={selectedReaderStats}
                onBack={() => { selectedReaderId = ''; }}
                onEditStateChange={(editing) => { _editingReaderDetail = editing; }}
                onUpdateNote={(note) => {
                  const beforeSnapshot = buildBeforeStateSnapshot({ events, signups, readers, mySignupIds, series });
                  const beforeNote = selectedReader?.note || '';
                  readers = updateReader(readers, selectedReader.id, { note });
                  const afterSnapshot = buildAfterStateSnapshot(beforeSnapshot, { events, signups, readers, mySignupIds, series });
                  const target = { readerId: selectedReader.id, readerName: selectedReader.name };
                  const description = generateDescription(OPERATION_TYPES.UPDATE_READER_NOTE, target, { name: selectedReader.name });
                  const res = recordOperation(
                    operationLogs,
                    OPERATION_TYPES.UPDATE_READER_NOTE,
                    description,
                    target,
                    beforeSnapshot,
                    afterSnapshot,
                    { name: selectedReader.name, phone: selectedReader.phone, beforeNote, afterNote: note }
                  );
                  operationLogs = res.logs;
                }}
                onAddTag={(tag) => {
                  readers = addTagToReader(readers, selectedReader.id, tag);
                }}
                onRemoveTag={(tag) => {
                  readers = removeTagFromReader(readers, selectedReader.id, tag);
                }}
              />
            {:else}
              <ReaderList
                readerStats={filteredReaderStats}
                searchKeyword={readerSearchKeyword}
                sortBy={readerSortBy}
                availableTags={allAvailableTags}
                selectedTags={readerSelectedTags}
                onSearch={(kw) => readerSearchKeyword = kw}
                onSort={(sort) => readerSortBy = sort}
                onSelectReader={(id) => { selectedReaderId = id; }}
                onToggleTag={handleToggleTag}
              />
            {/if}
          </section>
        {:else if adminTab === '运营看板'}
          <section class="opsSection">
            <OpsDashboard
              {events}
              {signups}
              {series}
              onNavigateToEvent={(eventId, navigateTarget) => {
                selectedId = eventId;
                adminTab = '活动管理';
                if (navigateTarget?.type) {
                  pendingNavigateTarget = navigateTarget.type;
                }
              }}
            />
          </section>
        {:else if adminTab === '数据导入'}
          <section class="importSection">
            <section class="panel">
              <h2><Download size={18} />CSV数据导入</h2>
              <p class="importHint">支持任意列名的CSV文件，导入前可手动映射字段。必要字段：<strong>活动</strong>、<strong>姓名</strong>、<strong>手机</strong>。可选字段：回答、报名类型、审核状态、拒绝原因、报名时间、审核时间、签到状态、签到时间、候补顺序。</p>
              <textarea bind:value={importCsvText} placeholder="粘贴CSV文本，首行为表头&#10;例如：&#10;活动名称,报名人,联系方式,回答内容,类型,审核&#10;秋园,张三,13800138000,第一章,正式,已通过"></textarea>
              <div class="formActions">
                <button type="button" on:click={previewImport}>预览导入结果</button>
                {#if importCsvText.trim()}
                  <button type="button" class="ghost" on:click={openMappingStep} title="手动设置列与字段的对应关系">设置字段映射</button>
                {/if}
                {#if importPreview || importErrors.length > 0 || importMappingStep}
                  <button type="button" class="ghost" on:click={cancelImport}>清空</button>
                {/if}
              </div>
            </section>

            {#if importErrors.length > 0}
              <section class="panel importErrorsPanel">
                <h3 class="importErrorTitle">⚠️ 发现 {importErrors.length} 个错误</h3>
                <ul class="importErrorList">
                  {#each importErrors as err}
                    <li>{err}</li>
                  {/each}
                </ul>
              </section>
            {/if}

            {#if importMappingStep && importCsvHeaders.length > 0}
              <section class="panel mappingPanel">
                <h3 class="importSectionTitle">🔗 字段映射设置</h3>
                <p class="mappingHint">将CSV中的列映射到系统字段。带 <span class="requiredStar">*</span> 标记的为必填项。已自动尝试识别常见列名，请核对并调整。</p>

                {#if importSampleRows.length > 0}
                  <div class="sampleDataHint">
                    <strong>📋 CSV样例（前{importSampleRows.length}行）：</strong>
                    <div class="sampleTableWrap">
                      <table class="sampleTable">
                        <thead>
                          <tr>
                            {#each importCsvHeaders as h, hi}
                              <th>列{hi + 1}<br /><small>{h}</small></th>
                            {/each}
                          </tr>
                        </thead>
                        <tbody>
                          {#each importSampleRows as row}
                            <tr>
                              {#each importCsvHeaders as _, hi}
                                <td>{row[hi] || '-'}</td>
                              {/each}
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  </div>
                {/if}

                <div class="mappingGrid">
                  {#each SYSTEM_FIELDS as field}
                    <div class="mappingRow">
                      <div class="mappingFieldLabel">
                        <span class:requiredField={field.required}>{field.label}</span>
                        {#if field.required}<span class="requiredStar">*</span>{/if}
                        <span class="fieldHint">{field.hint}</span>
                      </div>
                      <select
                        bind:value={importFieldMapping[field.key]}
                        class:mappingRequired={field.required && (importFieldMapping[field.key] === undefined || importFieldMapping[field.key] === null || importFieldMapping[field.key] === '')}
                      >
                        <option value="">（不映射此字段）</option>
                        {#each importCsvHeaders as h, hi}
                          <option value={String(hi)}>{`列${hi + 1}: ${h}`}</option>
                        {/each}
                      </select>
                    </div>
                  {/each}
                </div>

                <div class="conflictStrategySection">
                  <h4 class="importSubTitle">⚙️ 冲突处理策略</h4>
                  <p class="conflictHint">当CSV中存在与系统「同活动+同手机号」的报名记录时如何处理：</p>
                  <div class="conflictOptions">
                    {#each CONFLICT_STRATEGIES as strategy}
                      <label class="conflictOption" class:conflictActive={importConflictStrategy === strategy.key}>
                        <input type="radio" bind:group={importConflictStrategy} value={strategy.key} />
                        <div class="conflictOptionContent">
                          <strong>{strategy.label}</strong>
                          <span>{strategy.desc}</span>
                        </div>
                      </label>
                    {/each}
                  </div>
                </div>

                <div class="formActions mappingActions">
                  <button type="button" on:click={previewImport}>用此设置预览</button>
                  <button type="button" class="ghost" on:click={() => { importMappingStep = false; }}>返回</button>
                </div>
              </section>
            {/if}

            {#if importPreview}
              <section class="panel importPreviewPanel">
                <div class="previewSummaryBar">
                  <div class="importStats">
                    <div class="importStatItem">
                      <strong>{importStats.newEventCount}</strong>
                      <span>新增活动</span>
                    </div>
                    <div class="importStatItem success">
                      <strong>{importStats.newSignupCount}</strong>
                      <span>新增报名</span>
                    </div>
                    <div class="importStatItem info">
                      <strong>{importStats.updateCount}</strong>
                      <span>将更新</span>
                    </div>
                    <div class="importStatItem warn">
                      <strong>{importStats.duplicateCount}</strong>
                      <span>跳过/重复</span>
                    </div>
                    <div class="importStatItem error">
                      <strong>{importStats.errorCount}</strong>
                      <span>错误行数</span>
                    </div>
                  </div>
                  <div class="conflictSummaryTag">
                    冲突策略：<strong>{CONFLICT_STRATEGIES.find(s => s.key === importConflictStrategy)?.label || '跳过重复'}</strong>
                  </div>
                </div>

                {#if importPreview.events.length > 0}
                  <h3 class="importSectionTitle">📅 新增活动 ({importPreview.events.length})</h3>
                  <div class="importPreviewList">
                    {#each importPreview.events as ev}
                      <div class="importPreviewItem newEvent">
                        <span class="importBadge new">NEW</span>
                        <strong>{ev.book}</strong>
                        <span class="importItemMeta">默认时间：{ev.time.replace('T', ' ')} · 人数上限：{ev.limit} · 可在活动管理中修改</span>
                      </div>
                    {/each}
                  </div>
                {/if}

                {#if importPreview.signups.length > 0}
                  <h3 class="importSectionTitle">👥 新增报名记录 ({importPreview.signups.length})</h3>
                  <div class="importPreviewTableWrap">
                    <table class="importPreviewTable">
                      <thead>
                        <tr>
                          <th>行号</th>
                          <th>活动</th>
                          <th>姓名</th>
                          <th>手机</th>
                          <th>报名类型</th>
                          <th>审核状态</th>
                          <th>签到状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each importPreview.signups.slice(0, 50) as sg}
                          <tr>
                            <td>{sg._lineNum}</td>
                            <td>{sg._eventBook}</td>
                            <td>{sg.name}</td>
                            <td>{sg.phone}</td>
                            <td><span class="status-badge {sg.status === '正式' ? 'regular' : sg.status === '候补' ? 'waitlist' : sg.status === '待审核' ? 'pending' : 'rejected'}">{sg.status}</span></td>
                            <td><span class="status-badge {sg.reviewStatus === '已通过' ? 'regular' : sg.reviewStatus === '待审核' ? 'pending' : 'rejected'}">{sg.reviewStatus}</span></td>
                            <td><span class="checkin-badge {sg.checkedIn ? 'checked' : 'unchecked'}">{sg.checkedIn ? '已到场' : '未到场'}</span></td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                    {#if importPreview.signups.length > 50}
                      <p class="importMoreHint">... 还有 {importPreview.signups.length - 50} 条记录未显示</p>
                    {/if}
                  </div>
                {/if}

                {#if importPreview.updates.length > 0}
                  <h3 class="importSectionTitle">🔄 将更新的报名记录 ({importPreview.updates.length})</h3>
                  <div class="importPreviewTableWrap">
                    <table class="importPreviewTable updateTable">
                      <thead>
                        <tr>
                          <th>行号</th>
                          <th>活动</th>
                          <th>姓名</th>
                          <th>手机</th>
                          <th>更新方式</th>
                          <th>变更内容</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each importPreview.updates.slice(0, 50) as up}
                          <tr>
                            <td>{up._lineNum}</td>
                            <td>{up._eventBook}</td>
                            <td>{up.name}</td>
                            <td>{up.phone}</td>
                            <td>
                              <span class="updateStrategyTag">{up.strategy === 'overwrite' ? '覆盖全字段' : up.strategy === 'checkinOnly' ? '仅补签到' : '更新'}</span>
                            </td>
                            <td class="changeDetailCell">
                              {#if up.strategy === 'checkinOnly'}
                                {#if up.updates.checkedIn !== up.original.checkedIn}
                                  <span class="changeItem">签到：{up.original.checkedIn ? '已到场→未到场' : '未到场→已到场'}</span>
                                {/if}
                                {#if up.updates.checkedInAt !== up.original.checkedInAt}
                                  <span class="changeItem">签到时间：{up.original.checkedInAt || '-'} → {up.updates.checkedInAt || '-'}</span>
                                {/if}
                              {:else}
                                {#if up.updates.answer !== up.original.answer}
                                  <span class="changeItem">回答变更</span>
                                {/if}
                                {#if up.updates.status !== up.original.status}
                                  <span class="changeItem">类型：{up.original.status} → {up.updates.status}</span>
                                {/if}
                                {#if up.updates.reviewStatus !== up.original.reviewStatus}
                                  <span class="changeItem">审核：{up.original.reviewStatus} → {up.updates.reviewStatus}</span>
                                {/if}
                                {#if up.updates.checkedIn !== up.original.checkedIn}
                                  <span class="changeItem">签到：{up.original.checkedIn ? '已→未' : '未→已'}</span>
                                {/if}
                              {/if}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                    {#if importPreview.updates.length > 50}
                      <p class="importMoreHint">... 还有 {importPreview.updates.length - 50} 条更新记录未显示</p>
                    {/if}
                  </div>
                {/if}

                {#if importPreview.duplicates.length > 0}
                  <h3 class="importSectionTitle">⚠️ 跳过/重复记录 ({importPreview.duplicates.length})</h3>
                  <div class="importPreviewList">
                    {#each importPreview.duplicates.slice(0, 50) as dp}
                      <div class="importPreviewItem duplicate" class:csvdup={dp.conflictType === 'csv_duplicate'}>
                        <span class="importItemLine">第{dp.line}行</span>
                        {#if dp.conflictType === 'csv_duplicate'}
                          <span class="importBadge dup">CSV内重复</span>
                        {:else if dp.conflictType === 'existing_skip'}
                          <span class="importBadge skip">已跳过</span>
                        {:else}
                          <span class="importBadge info">无变化</span>
                        {/if}
                        <strong>{dp.name}</strong>
                        <span class="importItemMeta">{dp.book} · {dp.phone} · {dp.reason}</span>
                      </div>
                    {/each}
                  </div>
                  {#if importPreview.duplicates.length > 50}
                    <p class="importMoreHint">... 还有 {importPreview.duplicates.length - 50} 条重复记录未显示</p>
                  {/if}
                {/if}

                <div class="readerImportNote">
                  💡 导入完成后，将自动为有手机号的报名记录<strong>创建或关联读者档案</strong>，使用姓名更新档案信息，用报名回答填充历史备注。
                </div>

                <div class="importConfirmActions">
                  <button on:click={confirmImport} disabled={importPreview.signups.length === 0 && importPreview.events.length === 0 && importPreview.updates.length === 0}>
                    {importPreview.updates.length > 0 ? '确认导入并更新' : '确认导入'}
                  </button>
                  <button type="button" class="ghost" on:click={openMappingStep}>调整字段映射</button>
                  <button type="button" class="ghost" on:click={cancelImport}>取消</button>
                </div>
              </section>
            {/if}
          </section>
        {/if}
      </div>
    {/if}
  </section>

  {#if showPublicLinkModal}
    <div class="modalOverlay" role="dialog" aria-modal="true" aria-label="活动公开报名链接" tabindex="0" on:click={handleModalOverlayClick} on:keydown={(e) => { if (e.key === 'Escape') closePublicLinkModal(); }}>
      <div class="modalContent" role="document">
        <div class="modalHeader">
          <h2><Share2 size={18} />活动公开报名链接</h2>
          <button class="modalClose" on:click={closePublicLinkModal}><X size={18} /></button>
        </div>
        <div class="modalBody">
          {#if publicLinkModalType === 'single'}
            {@const targetEvent = events.find((e) => e.id === publicLinkTargetEventId)}
            {#if targetEvent}
              {@const singleUrl = buildFullPublicUrl(targetEvent.id)}
              {@const targetSeries = getSeriesOfEvent(targetEvent.id)}
              <div class="linkCard">
                <div class="linkCardHead">
                  <strong>{targetEvent.book}</strong>
                  {#if targetSeries}
                    <span class="seriesTag">📚 {targetSeries.title} · 第{getEventIndexInSeries(targetEvent.id)}期</span>
                  {/if}
                  <span>{targetEvent.host} · {targetEvent.time.replace('T', ' ')}</span>
                  <span class="status-badge {targetEvent.status === '开放报名' ? 'regular' : 'waitlist'}">{targetEvent.status}</span>
                </div>
                <div class="linkRow">
                  <input readonly value={singleUrl} />
                  <button class="ghost copyBtn" on:click={() => handleCopyLink(singleUrl, 'single')}>
                    {#if copiedLinkId === 'single'}
                      <CheckCircle2 size={16} /> 已复制
                    {:else}
                      <Copy size={16} /> 复制
                    {/if}
                  </button>
                  <button class="ghost previewBtn" on:click={() => previewPublicPage(singleUrl)}>
                    <ExternalLink size={16} /> 预览
                  </button>
                </div>
              </div>
            {/if}
          {:else if publicLinkModalType === 'series'}
            {@const targetSeries = series.find((s) => s.id === publicLinkTargetSeriesId)}
            {@const seriesLinks = targetSeries ? getSeriesPublicEventLinks(events, targetSeries.id) : []}
            {#if targetSeries}
              {@const seriesPageUrl = buildFullPublicSeriesUrl(targetSeries.id)}
              <div class="linkCard">
                <div class="linkCardHead">
                  <Layers size={16} />
                  <strong>{targetSeries.title}</strong>
                  <span>共 {seriesLinks.length} 期</span>
                  {#if targetSeries.description}
                    <p class="seriesLinkDesc">{targetSeries.description}</p>
                  {/if}
                </div>
                <div class="seriesPageLinkSection">
                  <div class="seriesPageLinkLabel">
                    <Bookmark size={14} /> 系列总览页（推荐分享）
                  </div>
                  <div class="linkRow">
                    <input readonly value={seriesPageUrl} />
                    <button class="ghost copyBtn" on:click={() => handleCopyLink(seriesPageUrl, `series-${targetSeries.id}`)}>
                      {#if copiedLinkId === `series-${targetSeries.id}`}
                        <CheckCircle2 size={16} /> 已复制
                      {:else}
                        <Copy size={16} /> 复制
                      {/if}
                    </button>
                    <button class="ghost previewBtn" on:click={() => previewPublicPage(seriesPageUrl)}>
                      <ExternalLink size={16} /> 预览
                    </button>
                  </div>
                </div>
              </div>
              <div class="seriesSectionDivider">
                <span>单场报名链接</span>
              </div>
              {#if seriesLinks.length === 0}
                <p class="empty empty-small">该系列下暂无活动</p>
              {:else}
                {#each seriesLinks as linkItem, idx}
                  {@const ev = events.find((e) => e.id === linkItem.eventId)}
                  <div class="linkCard linkCard-series">
                    <div class="linkCardHead">
                      <span class="episodeBadge small">第{idx + 1}期</span>
                      <strong>{linkItem.book}</strong>
                      <span>{ev?.host} · {linkItem.time.replace('T', ' ')}</span>
                      {#if ev}
                        <span class="status-badge {ev.status === '开放报名' ? 'regular' : 'waitlist'}">{ev.status}</span>
                      {/if}
                    </div>
                    <div class="linkRow">
                      <input readonly value={buildFullPublicUrl(linkItem.eventId)} />
                      <button class="ghost copyBtn" on:click={() => handleCopyLink(buildFullPublicUrl(linkItem.eventId), linkItem.eventId)}>
                        {#if copiedLinkId === linkItem.eventId}
                          <CheckCircle2 size={16} /> 已复制
                        {:else}
                          <Copy size={16} /> 复制
                        {/if}
                      </button>
                      <button class="ghost previewBtn" on:click={() => previewPublicPage(buildFullPublicUrl(linkItem.eventId))}>
                        <ExternalLink size={16} /> 预览
                      </button>
                    </div>
                  </div>
                {/each}
              {/if}
            {/if}
          {/if}
        </div>
        <div class="modalFooter">
          <button on:click={closePublicLinkModal}>关闭</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showOperationLogPanel && mode === '管理端'}
    <div class="oplog-overlay" on:click|self={toggleOperationLogPanel}>
      <div class="oplog-panel">
        <div class="oplog-header">
          <div class="oplog-title-row">
            <h2>📋 操作日志与撤销</h2>
            <button class="ghost close-btn" on:click={toggleOperationLogPanel}><X size={18} /></button>
          </div>
          <div class="oplog-undo-bar">
            <div class="oplog-undo-info">
              <strong>可撤销操作：{undoableCount}</strong>
              <span class="oplog-hint">仅在当前浏览器会话中有效，按时间倒序排列</span>
            </div>
            <div class="oplog-undo-actions">
              <input
                type="number"
                min="1"
                max="100"
                bind:value={undoCountInput}
                placeholder="数量"
                class="oplog-count-input"
              />
              <button class="undo-n-btn" disabled={undoableCount === 0} on:click={handleUndoLastN}>
                撤销最近 {Math.min(Number(undoCountInput) || 1, undoableCount)} 次
              </button>
            </div>
          </div>
        </div>
        <div class="oplog-content">
          {#if operationLogs.length === 0}
            <div class="oplog-empty">
              <Bookmark size={32} />
              <p>暂无操作记录</p>
              <span class="oplog-empty-hint">创建活动、审核报名等操作将在此处显示</span>
            </div>
          {:else}
            {#each operationLogs as log, i}
              <div class="oplog-item" class:log-undone={log.undone}>
                <div class="oplog-item-main">
                  <div class="oplog-item-type">
                    <span class="oplog-type-tag type-{log.type.toLowerCase().replace(/_/g, '-')}">
                      {OPERATION_LABELS[log.type] || log.type}
                    </span>
                    {#if log.undone}
                      <span class="oplog-undone-tag">已撤销</span>
                    {/if}
                  </div>
                  <div class="oplog-item-desc">{log.description}</div>
                  <div class="oplog-item-meta">
                    <span>🕒 {formatTimestamp(log.timestamp)}</span>
                    {#if log.undoTime}
                      <span>↩️ 撤销于 {formatTimestamp(log.undoTime)}</span>
                    {/if}
                  </div>
                </div>
                {#if !log.undone}
                  <div class="oplog-item-actions">
                    <button
                      class="undo-btn"
                      disabled={log.id !== latestUndoableId}
                      title={log.id === latestUndoableId ? '撤销此操作' : '只能撤销最新的操作，请先撤销后续操作'}
                      on:click={() => handleUndoOperation(log.id)}
                    >
                      ↩️ {log.id === latestUndoableId ? '撤销' : '需先撤销后续'}
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
* { box-sizing: border-box; }
:global(body) { margin: 0; background: #f3f0e8; color: #2a2822; font-family: Inter, "PingFang SC", Arial, sans-serif; }
button, input, select, textarea { font: inherit; }
main { min-height: 100vh; padding: 28px; }
.hero { display: flex; justify-content: space-between; gap: 20px; align-items: end; padding: 30px; border-radius: 8px; color: #fff; background: linear-gradient(135deg, #2b2b25, #7b6b4e); }
.hero span { opacity: .78; }
h1 { margin: 8px 0 0; font-size: clamp(34px, 5vw, 58px); letter-spacing: 0; }
h2 { margin: 0 0 16px; display: flex; align-items: center; gap: 8px; font-size: 18px; }
.mode { display: flex; gap: 8px; }
.mode button { background: rgb(255 255 255 / .12); border: 1px solid rgb(255 255 255 / .2); }
.mode .active { background: #fff; color: #2b2b25; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
.metrics article, .panel { background: #fff; border: 1px solid #ded7c9; border-radius: 8px; padding: 18px; box-shadow: 0 10px 28px rgb(49 43 31 / .07); }
.metrics article { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; align-items: center; }
.metrics strong { font-size: 26px; }
.metrics span { grid-column: 2; color: #686258; }
.layout { display: grid; grid-template-columns: 310px 1fr; gap: 16px; align-items: start; }
.eventItem { display: flex; gap: 6px; align-items: start; margin-bottom: 8px; }
.eventButton { flex: 1; display: block; text-align: left; background: #f8f5ee; color: #29261f; border: 1px solid #e1d8ca; margin-bottom: 0; }
.eventButton strong, .eventButton span, article strong, article span { display: block; }
.eventButton span, article span, p { color: #6b6459; }
.event-active { border-color: #7b6b4e; background: #efe7d8; }
.editEventBtn { padding: 6px 10px; font-size: 12px; flex-shrink: 0; }
form { display: flex; flex-direction: column; gap: 10px; }
input, select, textarea { width: 100%; border: 1px solid #d7ccba; border-radius: 8px; padding: 11px 12px; background: #fff; color: #2a2822; }
textarea { min-height: 96px; resize: vertical; }
button { border: 0; border-radius: 8px; padding: 11px 13px; background: #4b4435; color: #fff; cursor: pointer; }
button:disabled { opacity: .55; cursor: not-allowed; }
.ghost { background: #eee8dc; color: #312d25; }
.eventHead { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 16px; }
.eventHead h2, .eventHead p { margin: 0; }
.eventHead strong { white-space: nowrap; font-size: 24px; }
.seatsInfo { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.waitlistCount { font-size: 13px; color: #b36b00; background: #fff3e0; padding: 2px 8px; border-radius: 10px; }
.waitlistNotice { margin: 0; padding: 10px 12px; background: #fff3e0; border: 1px solid #ffcc80; border-radius: 8px; color: #b36b00; font-size: 14px; }
.status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; white-space: nowrap; }
.status-badge.regular { background: #e6f4ea; color: #1e7e34; }
.status-badge.waitlist { background: #fff3e0; color: #b36b00; }
.badgeGroup { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
.signupSectionTitle { margin: 16px 0 8px; font-size: 15px; color: #4b4435; }
.waitlistSectionTitle { color: #b36b00; }
.regular-card { background: #fffaf2; }
.waitlist-card { background: #fff8ee; border: 1px dashed #ffcc80 !important; }
.mySignup-card.waitlist-card { background: #fff8ee; border: 1px dashed #ffcc80 !important; }
.adminGrid { display: grid; grid-template-columns: 340px 1fr; gap: 16px; }
.signupList { display: grid; gap: 10px; }
.signupList article { border: 1px solid #e3dacb; border-radius: 8px; padding: 14px; background: #fffaf2; }
.csv { display: grid; gap: 8px; margin-top: 14px; color: #4a4439; }
.csv textarea { min-height: 140px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.checkin-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; white-space: nowrap; }
.checkin-badge.checked { background: #e6f4ea; color: #1e7e34; }
.checkin-badge.unchecked { background: #fce4e4; color: #a33; }
.checkin-summary { font-size: 14px; color: #686258; white-space: nowrap; }
.eventHead-actions { display: flex; align-items: center; gap: 10px; }
.signupRow { display: flex; justify-content: space-between; align-items: start; gap: 12px; }
.signupActions { display: flex; gap: 8px; margin-top: 10px; }
.checkin-btn.checkin-active { background: #e6f4ea; color: #1e7e34; border: 1px solid #b7dfbf; }
.mySignups { margin-top: 18px; }
.mySignups h3 { margin: 0 0 12px; font-size: 16px; }
.mySignup-card { border: 1px solid #e3dacb; border-radius: 8px; padding: 14px; background: #fffaf2; margin-bottom: 10px; }
.mySignup-status { margin-top: 8px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.checkin-time { font-size: 13px; color: #686258; }
.mySignup-card .cancel-btn { margin-top: 10px; }
.author { font-size: 14px; color: #6b6459; margin: 4px 0; }
.bookDescription { background: #fff8ee; border: 1px solid #e8ddc8; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
.bookDescription h3 { margin: 0 0 8px; font-size: 15px; color: #4b4435; }
.bookDescription p { margin: 0; line-height: 1.6; }
.adminLayout { display: grid; gap: 16px; }
.adminTabs { display: flex; gap: 8px; }
.adminTabs button { background: #e8e0ce; color: #4b4435; }
.adminTabs .active { background: #4b4435; color: #fff; }
.bookSelector { margin-bottom: 8px; }
.bookSelector label { display: block; font-size: 13px; color: #6b6459; margin-bottom: 6px; }
.bookSelectorRow { display: flex; gap: 8px; align-items: center; }
.bookSelectorRow select { flex: 1; }
.clearBtn { padding: 8px 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.formActions { display: flex; gap: 8px; }
.formActions button { flex: 1; }
.bookLibrary { display: grid; grid-template-columns: 340px 1fr; gap: 16px; }
.bookForm textarea { min-height: 80px; }
.bookCard { display: flex; justify-content: space-between; gap: 12px; padding: 14px; border: 1px solid #e3dacb; border-radius: 8px; background: #fffaf2; margin-bottom: 10px; }
.bookInfo { flex: 1; }
.bookInfo strong { display: block; font-size: 16px; margin-bottom: 4px; }
.bookInfo .author { font-size: 14px; color: #6b6459; margin-bottom: 6px; }
.bookInfo .desc { font-size: 14px; color: #4a4439; margin: 8px 0; line-height: 1.5; }
.bookInfo .question { display: inline-block; font-size: 13px; color: #7b6b4e; background: #efe7d8; padding: 4px 10px; border-radius: 12px; margin-top: 4px; }
.bookActions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.bookActions button { padding: 6px 12px; font-size: 13px; }
.bookActions .danger { background: #fce4e4; color: #a33; }
.empty { text-align: center; color: #999; padding: 40px 20px; }
.panelHeader { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.panelHeader h2 { margin: 0; }
.viewToggle { display: flex; gap: 4px; }
.viewToggle button { padding: 4px 10px; font-size: 13px; background: #eee8dc; color: #312d25; border-radius: 6px; }
.viewToggle .active { background: #4b4435; color: #fff; }
.calendar { margin-top: 0; }
.calNav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.calNav strong { font-size: 15px; }
.calArrow { padding: 4px 10px; background: #eee8dc; color: #312d25; }
.calGrid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.calWeekday { text-align: center; font-size: 12px; color: #999; padding: 6px 0; font-weight: 500; }
.calEmpty { min-height: 44px; }
.calDay { display: flex; flex-direction: column; align-items: center; padding: 4px 2px; min-height: 44px; background: #f8f5ee; border: 1px solid transparent; border-radius: 6px; cursor: pointer; font-size: 12px; color: #2a2822; }
.calDay:disabled { cursor: default; opacity: .35; background: transparent; }
.calDay:not(:disabled):hover { background: #efe7d8; }
.calDayNum { font-weight: 600; font-size: 13px; line-height: 1; }
.calToday .calDayNum { color: #7b6b4e; }
.calToday { border-color: #c4b99a; }
.calSelected { border-color: #4b4435; background: #e2d9c6; }
.calBadge { display: inline-block; background: #7b6b4e; color: #fff; font-size: 10px; line-height: 1; border-radius: 8px; padding: 2px 5px; margin-top: 3px; }
.calBookNames { font-size: 10px; color: #6b6459; text-align: center; line-height: 1.25; margin-top: 2px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-all; }
.calExpanded { border-color: #4b4435; background: #d8ccb2; }
.calExpandedPanel { margin-top: 12px; background: #fff8ee; border: 1px solid #e0d4bc; border-radius: 8px; padding: 12px; }
.calExpandedHead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.calExpandedHead strong { font-size: 14px; color: #4b4435; }
.calClose { padding: 0 8px; background: transparent; color: #8a7f6a; font-size: 18px; line-height: 1; }
.calClose:hover { background: #e8ddc8; color: #2a2822; }
.calExpandedList { display: flex; flex-direction: column; gap: 6px; }
.calEventItem { width: 100%; text-align: left; background: #fff; border: 1px solid #e3dacb; border-radius: 6px; padding: 8px 10px; }
.calEventItem strong, .calEventItem span { display: block; }
.calEventItem strong { font-size: 14px; }
.calEventItem span { font-size: 12px; color: #6b6459; margin-top: 2px; }
.calEventItem.event-active { border-color: #7b6b4e; background: #efe7d8; }
.listViewTabs { display: flex; gap: 4px; margin-bottom: 12px; flex-wrap: wrap; }
.listViewTabs button { padding: 5px 10px; font-size: 12px; background: #eee8dc; color: #312d25; border-radius: 6px; }
.listViewTabs .active { background: #4b4435; color: #fff; }
.seriesTag { display: inline-block; font-size: 11px; color: #7b6b4e; background: #efe7d8; padding: 2px 6px; border-radius: 8px; margin: 2px 0; }
.seriesGroup { margin-bottom: 10px; border: 1px solid #e1d8ca; border-radius: 8px; overflow: hidden; }
.seriesHeader { width: 100%; display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: #f8f5ee; border: 0; cursor: pointer; text-align: left; font-size: 14px; }
.seriesHeader strong { flex: 1; }
.seriesHeader.series-expanded { background: #efe7d8; }
.seriesCount { font-size: 12px; color: #7b6b4e; background: #fff; padding: 2px 8px; border-radius: 10px; }
.seriesEvents { padding: 8px 10px 10px; background: #fffaf2; }
.seriesDesc { margin: 0 0 10px; padding: 8px 10px; background: #fff; border-radius: 6px; font-size: 13px; color: #4a4439; }
.eventItem-series { margin-bottom: 6px; }
.eventItem-series:last-child { margin-bottom: 0; }
.episodeBadge { display: inline-block; font-size: 11px; color: #fff; background: #7b6b4e; padding: 2px 8px; border-radius: 8px; margin-bottom: 4px; }
.episodeBadge.small { font-size: 10px; padding: 1px 6px; }
.empty-small { padding: 20px 10px; font-size: 13px; }
.metrics { grid-template-columns: repeat(5, 1fr); }
.seriesBanner { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: linear-gradient(135deg, #efe7d8, #fff8ee); border: 1px solid #d7cbb3; border-radius: 8px; margin-bottom: 14px; }
.seriesBannerInfo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.seriesBannerLabel { font-size: 12px; color: #7b6b4e; background: #fff; padding: 2px 8px; border-radius: 10px; }
.seriesBannerInfo strong { font-size: 15px; color: #4b4435; }
.seriesBannerCount { font-size: 12px; color: #686258; }
.seriesBannerEpisode { font-weight: 600; color: #7b6b4e; background: #fff; padding: 4px 10px; border-radius: 12px; font-size: 13px; }
.seriesDescription { background: #f0ebe0; border-color: #d7cbb3; }
.seriesEventsPanel { margin-top: 18px; padding-top: 14px; border-top: 1px solid #e8ddc8; }
.seriesEventsPanel h3 { margin: 0 0 10px; font-size: 15px; color: #4b4435; }
.seriesEventsList { display: flex; flex-direction: column; gap: 6px; }
.seriesEventItem { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #fffaf2; border: 1px solid #e3dacb; border-radius: 8px; text-align: left; cursor: pointer; }
.seriesEventItem-active { border-color: #7b6b4e; background: #efe7d8; }
.seriesEventInfo { flex: 1; }
.seriesEventInfo strong { display: block; font-size: 14px; }
.seriesEventInfo span { display: block; font-size: 12px; color: #6b6459; margin-top: 2px; }
.seriesCard { flex-direction: column; }
.seriesCard .bookInfo { width: 100%; }
.seriesCard .bookActions { flex-direction: row; width: 100%; justify-content: flex-end; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e3dacb; }
.seriesEpisodes { margin: 10px 0; padding: 10px; background: #fff8ee; border-radius: 8px; }
.episodeRow { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f0e6d2; flex-wrap: wrap; }
.episodeRow:last-child { border-bottom: 0; }
.episodeTitle { font-weight: 600; font-size: 13px; flex: 1; min-width: 100px; }
.episodeMeta { font-size: 12px; color: #6b6459; }
.episodeEditBtn { padding: 4px 10px; font-size: 12px; }
.addEpisodeForm { margin-top: 12px; padding: 12px; background: #fff; border: 1px solid #e3dacb; border-radius: 8px; }
.addEpisodeForm h4 { margin: 0 0 10px; font-size: 14px; color: #4b4435; }
.addEpisodeBtn { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; }

.status-badge.pending { background: #fff3cd; color: #856404; }
.status-badge.rejected { background: #f8d7da; color: #721c24; }

.pending-card { background: #fffbf0; border: 1px dashed #ffe082 !important; }
.rejected-card { background: #fff5f5; border: 1px solid #f5c6cb !important; }

.mySignup-card.pending-card { background: #fffbf0; border: 1px dashed #ffe082 !important; }
.mySignup-card.rejected-card { background: #fff5f5; border: 1px solid #f5c6cb !important; }

.signupSectionTitle.pendingSectionTitle { color: #856404; }
.signupSectionTitle.rejectedSectionTitle { color: #721c24; }

.reviewSetting { background: #f8f5ee; border: 1px solid #e1d8ca; border-radius: 8px; padding: 12px; margin-bottom: 4px; }
.reviewLabel { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 500; }
.reviewLabel input { width: auto; margin: 0; cursor: pointer; }
.reviewHint { margin: 8px 0 0; font-size: 13px; color: #6b6459; }

.reviewNotice { margin: 0; padding: 10px 12px; background: #fff3cd; border: 1px solid #ffe082; border-radius: 8px; color: #856404; font-size: 14px; }

.readerMatchNotice { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; background: #e6f4ea; border: 1px solid #b7dfbf; border-radius: 8px; color: #1e7e34; font-size: 13px; }
.readerMatchNotice .readerNote { color: #2d6a3b; font-size: 12px; }
.readerMatchTags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px 0; }
.readerMatchTag { display: inline-block; padding: 2px 8px; background: #d4edda; border-radius: 10px; font-size: 11px; color: #1e7e34; }
.pendingReaderTags { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; }
.pendingTagChip { display: inline-block; padding: 2px 8px; background: #fff3cd; border: 1px solid #ffe082; border-radius: 10px; font-size: 11px; color: #856404; }
.pendingTagMore { display: inline-block; padding: 2px 6px; font-size: 11px; color: #999; }

.migrationNotice { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: #e6f4ea; border: 1px solid #b7dfbf; border-radius: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.migrationNotice strong { color: #1e7e34; font-size: 15px; }
.migrationNotice span { color: #2d6a3b; font-size: 13px; flex: 1; }
.migrationNotice .ghost.small { padding: 5px 10px; font-size: 12px; }

.readerManagement { display: flex; flex-direction: column; gap: 0; }

.pending-indicator { color: #856404; }
.rejected-indicator { color: #721c24; }

.approve-btn { color: #1e7e34; background: #e6f4ea; }
.approve-btn:hover { background: #d4edda; }
.reject-btn { color: #721c24; background: #f8d7da; }
.reject-btn:hover { background: #f5c6cb; }

.rejectForm { width: 100%; }
.rejectForm h4 { margin: 0 0 8px; font-size: 14px; color: #721c24; }
.rejectForm textarea { min-height: 60px; margin-bottom: 8px; }

.rejection-reason { margin: 6px 0 0; padding: 8px 10px; background: #f8d7da; border-radius: 6px; color: #721c24; font-size: 13px; }
.rejection-reason-display { display: block; width: 100%; margin-top: 6px; padding: 8px 10px; background: #f8d7da; border-radius: 6px; color: #721c24; font-size: 13px; }

.importSection { display: grid; gap: 16px; }
.importHint { margin: 0 0 10px; padding: 10px 12px; background: #f8f5ee; border: 1px solid #e1d8ca; border-radius: 8px; color: #6b6459; font-size: 13px; line-height: 1.6; }
.importErrorsPanel { background: #fff5f5; border-color: #f5c6cb; }
.importErrorTitle { margin: 0 0 10px; color: #721c24; font-size: 16px; }
.importErrorList { margin: 0; padding-left: 20px; color: #721c24; font-size: 14px; }
.importErrorList li { margin-bottom: 4px; }
.importStats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }
.importStatItem { background: #f8f5ee; border: 1px solid #e1d8ca; border-radius: 8px; padding: 14px; text-align: center; }
.importStatItem strong { display: block; font-size: 28px; color: #4b4435; }
.importStatItem span { display: block; font-size: 13px; color: #6b6459; margin-top: 4px; }
.importStatItem.success { background: #e6f4ea; border-color: #b7dfbf; }
.importStatItem.success strong { color: #1e7e34; }
.importStatItem.success span { color: #145524; }
.importStatItem.info { background: #e3f0fd; border-color: #b3d7f5; }
.importStatItem.info strong { color: #0056b3; }
.importStatItem.info span { color: #003d80; }
.importStatItem.warn { background: #fff8ee; border-color: #ffcc80; }
.importStatItem.warn strong { color: #b36b00; }
.importStatItem.warn span { color: #995a00; }
.importStatItem.error { background: #fff5f5; border-color: #f5c6cb; }
.importStatItem.error strong { color: #a33; }
.importStatItem.error span { color: #721c24; }
.importSectionTitle { margin: 16px 0 10px; font-size: 15px; color: #4b4435; }
.importPreviewList { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
.importPreviewItem { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #fffaf2; border: 1px solid #e3dacb; border-radius: 6px; flex-wrap: wrap; }
.importPreviewItem.duplicate { background: #fff8ee; border-color: #ffcc80; }
.importPreviewItem.duplicate.csvdup { background: #fff5f5; border-color: #f5c6cb; }
.importPreviewItem.newEvent { background: #e6f4ea; border-color: #b7dfbf; }
.importPreviewItem strong { font-size: 14px; }
.importItemLine { display: inline-block; padding: 2px 8px; background: #efe7d8; color: #7b6b4e; border-radius: 10px; font-size: 12px; font-weight: 600; }
.importItemMeta { font-size: 13px; color: #6b6459; }
.importPreviewTableWrap { overflow-x: auto; margin-bottom: 8px; }
.importPreviewTable { width: 100%; border-collapse: collapse; font-size: 13px; }
.importPreviewTable th, .importPreviewTable td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e3dacb; }
.importPreviewTable th { background: #f8f5ee; color: #4b4435; font-weight: 600; font-size: 12px; }
.importPreviewTable tbody tr:hover { background: #fffaf2; }
.importMoreHint { margin: 8px 0 0; text-align: center; color: #999; font-size: 13px; }
.importConfirmActions { display: flex; gap: 10px; margin-top: 20px; padding-top: 16px; border-top: 1px dashed #e3dacb; }
.importConfirmActions button { flex: 1; }

.previewSummaryBar { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.previewSummaryBar .importStats { flex: 1; min-width: 0; margin-bottom: 0; }
.conflictSummaryTag { flex-shrink: 0; padding: 8px 14px; background: #efe7d8; border-radius: 8px; font-size: 13px; color: #7b6b4e; white-space: nowrap; }
.conflictSummaryTag strong { color: #4b4435; }

.importBadge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; }
.importBadge.new { background: #1e7e34; color: #fff; }
.importBadge.dup { background: #a33; color: #fff; }
.importBadge.skip { background: #b36b00; color: #fff; }
.importBadge.info { background: #0056b3; color: #fff; }

.mappingPanel { background: #fff; }
.mappingHint { margin: 0 0 14px; padding: 10px 12px; background: #e3f0fd; border: 1px solid #b3d7f5; border-radius: 8px; color: #003d80; font-size: 13px; line-height: 1.6; }
.requiredStar { color: #d32f2f; font-weight: 700; margin-left: 2px; }
.requiredField { color: #4b4435; font-weight: 600; }

.sampleDataHint { margin-bottom: 16px; padding: 12px; background: #f8f5ee; border: 1px solid #e1d8ca; border-radius: 8px; }
.sampleDataHint strong { display: block; margin-bottom: 8px; font-size: 13px; color: #4b4435; }
.sampleTableWrap { overflow-x: auto; }
.sampleTable { width: 100%; border-collapse: collapse; font-size: 12px; background: #fff; }
.sampleTable th, .sampleTable td { padding: 6px 10px; border: 1px solid #e1d8ca; text-align: left; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sampleTable th { background: #efe7d8; color: #7b6b4e; font-weight: 600; }
.sampleTable th small { display: block; font-weight: 400; color: #6b6459; margin-top: 2px; }

.mappingGrid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.mappingRow { display: grid; grid-template-columns: 220px 1fr; gap: 12px; align-items: center; padding: 10px 12px; background: #f8f5ee; border-radius: 8px; border: 1px solid #e1d8ca; }
.mappingFieldLabel { display: flex; flex-direction: column; gap: 2px; }
.mappingFieldLabel .fieldHint { font-size: 11px; color: #8a7f6a; line-height: 1.4; }
.mappingFieldLabel span:first-child { font-size: 14px; }
.mappingRequired { border-color: #f5c6cb; background: #fff5f5; }

.conflictStrategySection { margin-bottom: 16px; padding: 14px; background: #fffaf2; border: 1px solid #e3dacb; border-radius: 8px; }
.importSubTitle { margin: 0 0 8px; font-size: 14px; color: #4b4435; display: flex; align-items: center; gap: 6px; }
.conflictHint { margin: 0 0 12px; font-size: 13px; color: #6b6459; }
.conflictOptions { display: grid; gap: 10px; grid-template-columns: repeat(3, 1fr); }
.conflictOption { display: flex; cursor: pointer; margin: 0; }
.conflictOption input { margin-right: 10px; margin-top: 3px; flex-shrink: 0; }
.conflictOptionContent { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.conflictOptionContent strong { font-size: 13px; color: #4b4435; }
.conflictOptionContent span { font-size: 12px; color: #8a7f6a; line-height: 1.5; }
.conflictOption { padding: 10px 12px; background: #fff; border: 2px solid #e1d8ca; border-radius: 8px; transition: all 0.15s; }
.conflictOption:hover { border-color: #c4b99e; background: #f8f5ee; }
.conflictActive { border-color: #7b6b4e !important; background: #efe7d8 !important; }
.conflictActive .conflictOptionContent strong { color: #4b4435; }

.mappingActions { margin-top: 8px; }

.updateTable .changeDetailCell { min-width: 240px; }
.changeDetailCell { display: flex; flex-direction: column; gap: 4px; }
.changeItem { display: inline-block; padding: 2px 8px; background: #fff3e0; color: #b36b00; border-radius: 10px; font-size: 12px; margin-right: 4px; }
.updateStrategyTag { display: inline-block; padding: 3px 10px; background: #e3f0fd; color: #0056b3; border-radius: 10px; font-size: 12px; font-weight: 600; }

.readerImportNote { margin-top: 16px; padding: 12px 14px; background: #e6f4ea; border: 1px solid #b7dfbf; border-radius: 8px; font-size: 13px; color: #145524; line-height: 1.6; }
.readerImportNote strong { color: #1e7e34; }

.printListBtn { display: inline-flex; align-items: center; gap: 6px; }

.shareBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
}

.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(43, 43, 37, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modalContent {
  background: #fff;
  border-radius: 10px;
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modalHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid #e1d8ca;
  background: #f8f5ee;
  border-radius: 10px 10px 0 0;
}

.modalHeader h2 {
  margin: 0;
  font-size: 17px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.modalClose {
  padding: 6px 10px;
  background: transparent;
  border: 0;
  color: #686258;
  cursor: pointer;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
}

.modalClose:hover {
  background: #eee8dc;
  color: #2a2822;
}

.modalBody {
  padding: 20px 22px;
}

.modalFooter {
  padding: 14px 22px;
  border-top: 1px solid #e1d8ca;
  background: #faf7f0;
  border-radius: 0 0 10px 10px;
}

.modalFooter button {
  width: 100%;
}

.linkCard {
  background: #fffaf2;
  border: 1px solid #e3dacb;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 12px;
}

.linkCard-series {
  background: #fff;
}

.linkCard:last-child {
  margin-bottom: 0;
}

.linkCardHead {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.linkCardHead strong {
  font-size: 15px;
  color: #2a2822;
}

.linkCardHead span {
  font-size: 13px;
  color: #6b6459;
}

.linkCardHead .seriesTag {
  display: inline-block;
  font-size: 11px;
  color: #7b6b4e;
  background: #efe7d8;
  padding: 2px 8px;
  border-radius: 8px;
  width: fit-content;
}

.seriesLinkDesc {
  font-size: 13px;
  color: #4a4439;
  margin: 4px 0 0;
  line-height: 1.5;
}

.linkRow {
  display: flex;
  gap: 8px;
}

.linkRow input {
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  padding: 10px 12px;
  background: #fff;
}

.copyBtn, .previewBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 13px;
  flex-shrink: 0;
}

.opsSection { display: grid; gap: 16px; }

.seriesPageLinkSection {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e3dacb;
}

.seriesPageLinkLabel {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #7b6b4e;
  background: #efe7d8;
  padding: 3px 10px;
  border-radius: 10px;
  margin-bottom: 10px;
}

.seriesSectionDivider {
  display: flex;
  align-items: center;
  margin: 16px 0 12px;
  text-align: center;
}

.seriesSectionDivider::before,
.seriesSectionDivider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e3dacb;
}

.seriesSectionDivider span {
  padding: 0 14px;
  font-size: 12px;
  color: #8a7f6a;
  font-weight: 500;
  background: #fff;
}

.log-btn {
  background: #e8dfd0;
  color: #5c4f3a;
  border: 1px solid #d4c8b2;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  position: relative;
}

.log-btn:hover { background: #e0d5c2; }
.log-btn:active { transform: scale(0.98); }
.log-btn.active { background: #d9cfb8; border-color: #b8a88c; }

.log-badge {
  background: #e74c3c;
  color: #fff;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  line-height: 1;
}

.undo-toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  background: #2ecc71;
  color: #fff;
  padding: 10px 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 6px 20px rgba(46, 204, 113, 0.4);
  animation: toastIn 0.3s ease;
}

@keyframes toastIn {
  from { opacity: 0; transform: translate(-50%, -20px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

.sync-conflict-banner {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99998;
  background: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
  padding: 12px 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 6px 20px rgba(255, 193, 7, 0.35);
  animation: toastIn 0.3s ease;
  max-width: 90vw;
  flex-wrap: wrap;
}
.sync-conflict-text {
  flex-shrink: 1;
  min-width: 0;
}
.sync-conflict-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.sync-refresh-btn {
  background: #856404;
  color: #fff;
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 6px;
}
.sync-dismiss-btn {
  background: transparent;
  border: 1px solid #856404;
  color: #856404;
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 6px;
}

.oplog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(42, 40, 34, 0.55);
  z-index: 9998;
  display: flex;
  justify-content: flex-end;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.oplog-panel {
  width: 560px;
  max-width: 100vw;
  background: #fdfbf6;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.12);
  animation: slideIn 0.25s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.oplog-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e6ddcb;
  background: #f8f3e8;
  position: sticky;
  top: 0;
  z-index: 1;
}

.oplog-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.oplog-title-row h2 {
  margin: 0;
  font-size: 18px;
  color: #3d382e;
}

.close-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #8a7f6a;
}

.close-btn:hover { background: #ebe3d2; color: #5c4f3a; }

.oplog-undo-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.oplog-undo-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.oplog-undo-info strong {
  font-size: 14px;
  color: #3d382e;
}

.oplog-hint {
  font-size: 11px;
  color: #9c9078;
}

.oplog-undo-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.oplog-count-input {
  width: 72px;
  padding: 7px 10px;
  border: 1px solid #d4c8b2;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.oplog-count-input:focus { border-color: #b8a88c; }

.undo-n-btn {
  background: linear-gradient(135deg, #e67e22, #d35400);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.1s, box-shadow 0.15s;
  box-shadow: 0 2px 8px rgba(230, 126, 34, 0.3);
}

.undo-n-btn:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(230, 126, 34, 0.4); }
.undo-n-btn:active:not(:disabled) { transform: scale(0.97); }
.undo-n-btn:disabled {
  background: #d4c8b2;
  color: #9c9078;
  cursor: not-allowed;
  box-shadow: none;
}

.oplog-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 24px;
}

.oplog-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #9c9078;
  text-align: center;
  gap: 10px;
}

.oplog-empty p {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #8a7f6a;
}

.oplog-empty-hint {
  font-size: 12px;
  color: #b8a88c;
  max-width: 240px;
  line-height: 1.6;
}

.oplog-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e6ddcb;
  border-radius: 10px;
  margin-bottom: 10px;
  transition: background 0.15s, border-color 0.15s;
}

.oplog-item:hover { border-color: #d4c8b2; background: #fdfaf3; }

.oplog-item.log-undone {
  opacity: 0.55;
  background: #f5f1e6;
  border-style: dashed;
}

.oplog-item-main { flex: 1; min-width: 0; }

.oplog-item-type {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.oplog-type-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  letter-spacing: 0.02em;
}

.type-create-event { background: #eafaf1; color: #27ae60; }
.type-edit-event { background: #eef5ff; color: #2980b9; }
.type-adjust-limit { background: #fff4e6; color: #e67e22; }
.type-approve-signup { background: #e9f7ef; color: #27ae60; }
.type-reject-signup { background: #fdecea; color: #e74c3c; }
.type-check-in { background: #f0e6ff; color: #8e44ad; }
.type-cancel-signup { background: #feece2; color: #d35400; }
.type-csv-import { background: #eef8fa; color: #16a085; }
.type-update-reader-note { background: #fdf2e9; color: #c0392b; }

.oplog-undone-tag {
  font-size: 11px;
  color: #9c9078;
  background: #ebe3d2;
  padding: 2px 8px;
  border-radius: 6px;
}

.oplog-item-desc {
  font-size: 14px;
  font-weight: 500;
  color: #3d382e;
  margin-bottom: 6px;
  line-height: 1.5;
}

.oplog-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 11px;
  color: #9c9078;
}

.oplog-item-actions {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
}

.undo-btn {
  background: #fff;
  color: #e67e22;
  border: 1px solid #f5d7b5;
  border-radius: 7px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.undo-btn:hover {
  background: #fff4e6;
  border-color: #e67e22;
  transform: translateY(-1px);
}

.undo-btn:active { transform: translateY(0); }

.undo-btn:disabled {
  background: #f5f5f5;
  color: #999;
  border-color: #e0e0e0;
  cursor: not-allowed;
  opacity: 0.7;
  transform: none;
}

.undo-btn:disabled:hover {
  background: #f5f5f5;
  border-color: #e0e0e0;
  transform: none;
}

@media (max-width: 900px) { main { padding: 16px; } .hero, .eventHead, .seriesBanner { align-items: start; flex-direction: column; } .metrics { grid-template-columns: repeat(3, 1fr); } .layout, .adminGrid, .bookLibrary { grid-template-columns: 1fr; } .signupRow, .bookCard { flex-direction: column; } .importStats { grid-template-columns: repeat(2, 1fr); } .eventHead-actions { flex-wrap: wrap; } .linkRow { flex-direction: column; } .copyBtn, .previewBtn { width: 100%; justify-content: center; } .oplog-panel { width: 100vw; } }
</style>
