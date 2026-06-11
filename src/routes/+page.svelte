<script>
  import { onMount } from 'svelte';
  import { BookPlus, CalendarPlus, Download, LibraryBig, ListChecks, UserCheck, Users, X, Layers, Plus, Trash2, ChevronRight } from 'lucide-svelte';

  const iso = (offset = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  const seedBooks = [
    { id: crypto.randomUUID(), title: '秋园', author: '杨本芬', description: '《秋园》是作家杨本芬的处女作，讲述了一位普通女性在时代洪流中艰难生存的故事。', question: '你最想讨论哪一章？' },
    { id: crypto.randomUUID(), title: '索拉里斯星', author: '斯坦尼斯瓦夫·莱姆', description: '《索拉里斯星》是波兰科幻作家莱姆的代表作，探讨了人类与外星文明沟通的困境。', question: '是否读完全文？' }
  ];

  const seedEvents = [
    { id: crypto.randomUUID(), book: '秋园', author: '杨本芬', description: '《秋园》是作家杨本芬的处女作，讲述了一位普通女性在时代洪流中艰难生存的故事。', host: '店员阿檀', time: `${iso(3)}T19:30`, limit: 8, question: '你最想讨论哪一章？', status: '开放报名' },
    { id: crypto.randomUUID(), book: '索拉里斯星', author: '斯坦尼斯瓦夫·莱姆', description: '《索拉里斯星》是波兰科幻作家莱姆的代表作，探讨了人类与外星文明沟通的困境。', host: '老周', time: `${iso(10)}T20:00`, limit: 12, question: '是否读完全文？', status: '开放报名' }
  ];

  const seedSeries = [];

  let books = seedBooks;
  let events = seedEvents;
  let series = seedSeries;
  let signups = [];
  let selectedId = seedEvents[0].id;
  let mode = '用户端';
  let adminTab = '活动管理';
  let listViewTab = '全部活动';
  let selectedSeriesId = '';
  let selectedBookId = '';
  let eventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名' };
  let bookForm = { title: '', author: '', description: '', question: '' };
  let editingBookId = '';
  let editingEventId = '';
  let editingEventPrevLimit = 0;
  let editingEventSeriesId = undefined;
  let editingEventSeriesIndex = undefined;
  let mySignupIds = [];
  let signupForm = { name: '', phone: '', answer: '' };
  let hydrated = false;
  let viewMode = '列表';
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let activeDate = '';

  let seriesForm = { title: '', description: '' };
  let editingSeriesId = '';
  let addingEventToSeriesId = '';
  let seriesEventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名' };
  let selectedSeriesBookId = '';

  onMount(() => {
    const storedBooks = localStorage.getItem('zfl-6-books');
    const storedEvents = localStorage.getItem('zfl-6-events');
    const storedSignups = localStorage.getItem('zfl-6-signups');
    const storedMyIds = localStorage.getItem('zfl-6-my-signup-ids');
    const storedSeries = localStorage.getItem('zfl-6-series');
    if (storedBooks) books = JSON.parse(storedBooks);
    if (storedEvents) events = JSON.parse(storedEvents);
    if (storedSignups) {
      const parsed = JSON.parse(storedSignups);
      signups = parsed.map((item) => {
        if (!item.status) {
          return { ...item, status: '正式', waitlistPosition: undefined };
        }
        return item;
      });
    }
    if (storedMyIds) mySignupIds = JSON.parse(storedMyIds);
    if (storedSeries) series = JSON.parse(storedSeries);
    selectedId = events[0]?.id || '';
    hydrated = true;
  });

  $: if (hydrated) {
    localStorage.setItem('zfl-6-books', JSON.stringify(books));
    localStorage.setItem('zfl-6-events', JSON.stringify(events));
    localStorage.setItem('zfl-6-signups', JSON.stringify(signups));
    localStorage.setItem('zfl-6-my-signup-ids', JSON.stringify(mySignupIds));
    localStorage.setItem('zfl-6-series', JSON.stringify(series));
  }

  $: standaloneEvents = events.filter((e) => !e.seriesId);
  $: selectedEvent = events.find((event) => event.id === selectedId) || events[0];
  $: selectedSignups = signups.filter((item) => item.eventId === selectedEvent?.id);
  $: selectedRegularSignups = selectedSignups.filter((item) => item.status === '正式');
  $: selectedWaitlistSignups = selectedSignups.filter((item) => item.status === '候补').sort((a, b) => a.waitlistPosition - b.waitlistPosition);
  $: mySignups = signups.filter((item) => mySignupIds.includes(item.id));
  $: checkedInCount = signups.filter((item) => item.checkedIn).length;
  $: selectedCheckedInCount = selectedRegularSignups.filter((item) => item.checkedIn).length;
  $: seatsLeft = selectedEvent ? Math.max(0, Number(selectedEvent.limit) - selectedRegularSignups.length) : 0;
  $: waitlistCount = selectedWaitlistSignups.length;
  $: csv = ['活动,姓名,手机,回答,报名类型,报名时间,签到状态,签到时间,候补顺序', ...selectedSignups.sort((a, b) => {
    if (a.status !== b.status) return a.status === '正式' ? -1 : 1;
    if (a.status === '候补') return a.waitlistPosition - b.waitlistPosition;
    return 0;
  }).map((item) => `"${selectedEvent.book}","${item.name}","${item.phone}","${item.answer}","${item.status}","${item.createdAt}","${item.checkedIn ? '已到场' : '未到场'}","${item.checkedInAt || '-'}","${item.status === '候补' ? item.waitlistPosition : '-'}"`)].join('\n');

  $: seriesWithEvents = series.map((s) => {
    const sEvents = events.filter((e) => e.seriesId === s.id).sort((a, b) => a.time.localeCompare(b.time));
    return { ...s, events: sEvents };
  });

  let lastEventLimits = {};
  $: eventLimits = events.map((e) => `${e.id}:${e.limit}`).join('|');
  $: if (hydrated && eventLimits) {
    events.forEach((event) => {
      const currentLimit = Number(event.limit);
      if (lastEventLimits[event.id] !== undefined && currentLimit > lastEventLimits[event.id]) {
        promoteFromWaitlist(event.id);
      }
      lastEventLimits[event.id] = currentLimit;
    });
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

  $: todayStr = iso();
  $: calFirstDay = new Date(calYear, calMonth, 1).getDay();
  $: calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  $: eventsByDate = events.reduce((acc, event) => {
    const date = event.time.slice(0, 10);
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {});

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
    seriesEventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名' };
  }

  function cancelAddEventToSeries() {
    addingEventToSeriesId = '';
    selectedSeriesBookId = '';
    seriesEventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名' };
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
    if (editingEventId) {
      const newLimit = Number(eventForm.limit || 0);
      const eventId = editingEventId;
      const prevLimit = editingEventPrevLimit;
      const updatedEvents = events.map((e) => e.id === eventId ? { ...eventForm, id: eventId, limit: newLimit, seriesId: editingEventSeriesId, seriesIndex: editingEventSeriesIndex } : e);
      events = updatedEvents;
      editingEventId = '';
      editingEventPrevLimit = 0;
      editingEventSeriesId = undefined;
      editingEventSeriesIndex = undefined;
      if (newLimit > prevLimit) {
        promoteFromWaitlist(eventId, updatedEvents);
      }
    } else {
      const event = { id: crypto.randomUUID(), ...eventForm, limit: Number(eventForm.limit || 0) };
      events = [event, ...events];
      selectedId = event.id;
    }
    clearBookSelection();
    eventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名' };
  }

  function editEvent(event) {
    editingEventId = event.id;
    editingEventPrevLimit = Number(event.limit);
    editingEventSeriesId = event.seriesId;
    editingEventSeriesIndex = event.seriesIndex;
    selectedBookId = '';
    eventForm = { book: event.book, author: event.author, description: event.description, host: event.host, time: event.time, limit: event.limit, question: event.question, status: event.status };
  }

  function cancelEditEvent() {
    editingEventId = '';
    editingEventPrevLimit = 0;
    editingEventSeriesId = undefined;
    editingEventSeriesIndex = undefined;
    clearBookSelection();
    eventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名' };
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

  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(day) { return `${calYear}-${pad(calMonth + 1)}-${pad(day)}`; }
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
    const key = dateKey(day);
    const dayEvents = eventsByDate[key];
    if (!dayEvents || dayEvents.length === 0) return;
    if (dayEvents.length === 1) {
      selectedId = dayEvents[0].id;
      activeDate = '';
    } else {
      activeDate = activeDate === key ? '' : key;
    }
  }

  function promoteFromWaitlist(eventId, eventSource = events) {
    const event = eventSource.find((e) => e.id === eventId);
    if (!event) return;

    const eventSignups = signups.filter((item) => item.eventId === eventId);
    const regularCount = eventSignups.filter((item) => item.status === '正式').length;
    const limit = Number(event.limit);

    if (regularCount < limit) {
      const waitlist = eventSignups
        .filter((item) => item.status === '候补')
        .sort((a, b) => a.waitlistPosition - b.waitlistPosition);

      const spotsToFill = limit - regularCount;
      const toPromote = waitlist.slice(0, spotsToFill);

      if (toPromote.length > 0) {
        signups = signups.map((item) => {
          const promotee = toPromote.find((p) => p.id === item.id);
          if (promotee) {
            return { ...item, status: '正式', waitlistPosition: undefined };
          }
          if (item.eventId === eventId && item.status === '候补') {
            const newPosition = waitlist.findIndex((w) => w.id === item.id) - toPromote.length + 1;
            if (newPosition > 0) {
              return { ...item, waitlistPosition: newPosition };
            }
          }
          return item;
        });
      }
    }
  }

  function signup() {
    if (!selectedEvent || selectedEvent.status !== '开放报名' || !signupForm.name.trim()) return;

    const eventSignups = signups.filter((item) => item.eventId === selectedEvent.id);
    const regularCount = eventSignups.filter((item) => item.status === '正式').length;
    const waitlistCount = eventSignups.filter((item) => item.status === '候补').length;

    let status = '正式';
    let waitlistPosition = undefined;

    if (regularCount >= Number(selectedEvent.limit)) {
      status = '候补';
      waitlistPosition = waitlistCount + 1;
    }

    const newSignup = {
      id: crypto.randomUUID(),
      eventId: selectedEvent.id,
      ...signupForm,
      status,
      waitlistPosition,
      checkedIn: false,
      checkedInAt: '',
      createdAt: new Date().toLocaleString()
    };
    signups = [newSignup, ...signups];
    mySignupIds = [...mySignupIds, newSignup.id];
    signupForm = { name: '', phone: '', answer: '' };
  }

  function cancelSignup(id) {
    const signup = signups.find((item) => item.id === id);
    signups = signups.filter((item) => item.id !== id);
    mySignupIds = mySignupIds.filter((mid) => mid !== id);
    if (signup && signup.status === '正式') {
      promoteFromWaitlist(signup.eventId);
    } else if (signup && signup.status === '候补') {
      const eventSignups = signups.filter((item) => item.eventId === signup.eventId && item.status === '候补');
      signups = signups.map((item) => {
        if (item.eventId === signup.eventId && item.status === '候补' && item.waitlistPosition > signup.waitlistPosition) {
          return { ...item, waitlistPosition: item.waitlistPosition - 1 };
        }
        return item;
      });
    }
  }

  function toggleEventStatus(id) {
    events = events.map((event) => event.id === id ? { ...event, status: event.status === '开放报名' ? '已关闭' : '开放报名' } : event);
  }

  function toggleCheckIn(id) {
    const signup = signups.find((item) => item.id === id);
    if (signup && signup.status !== '正式') return;
    signups = signups.map((item) => item.id === id ? { ...item, checkedIn: !item.checkedIn, checkedInAt: !item.checkedIn ? new Date().toLocaleString() : '' } : item);
  }
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
    </div>
  </header>

  <section class="metrics">
    <article><LibraryBig size={22} /><strong>{events.length}</strong><span>活动</span></article>
    <article><Layers size={22} /><strong>{series.length}</strong><span>系列</span></article>
    <article><Users size={22} /><strong>{signups.length}</strong><span>报名</span></article>
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
            <textarea bind:value={signupForm.answer} placeholder={selectedEvent.question || '报名备注'}></textarea>
            {#if seatsLeft <= 0 && selectedEvent.status === '开放报名'}
              <p class="waitlistNotice">⚠️ 活动已报满，提交后将加入候补名单</p>
            {/if}
            <button disabled={selectedEvent.status !== '开放报名'}>{seatsLeft <= 0 ? '加入候补' : '提交报名'}</button>
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
                <article class="mySignup-card" class:waitlist-card={item.status === '候补'}>
                  <strong>{event?.book || '未知活动'}</strong>
                  <span>{event?.host} · {event?.time?.replace('T', ' ')}</span>
                  <span>报名时间：{item.createdAt}</span>
                  <div class="mySignup-status">
                    <span class="status-badge" class:regular={item.status === '正式'} class:waitlist={item.status === '候补'}>
                      {item.status === '正式' ? '正式报名' : `候补 #${item.waitlistPosition}`}
                    </span>
                    {#if item.status === '正式'}
                      <span class="checkin-badge" class:checked={item.checkedIn} class:unchecked={!item.checkedIn}>
                        {item.checkedIn ? '已到场' : '未到场'}
                      </span>
                    {/if}
                    {#if item.checkedIn && item.checkedInAt}
                      <span class="checkin-time">签到时间：{item.checkedInAt}</span>
                    {/if}
                  </div>
                  <button class="ghost cancel-btn" on:click={() => cancelSignup(item.id)}>{item.status === '正式' ? '取消报名' : '退出候补'}</button>
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
                <div class="formActions">
                  <button>{editingEventId ? '保存修改' : '保存活动'}</button>
                  {#if editingEventId}
                    <button type="button" class="ghost" on:click={cancelEditEvent}>取消</button>
                  {/if}
                </div>
              </form>
            </div>

            <section class="panel">
              <div class="eventHead">
                <h2>报名名单</h2>
                <div class="eventHead-actions">
                  <span class="checkin-summary">正式 {selectedRegularSignups.length}/{selectedEvent?.limit || 0} · 候补 {waitlistCount} · 签到 {selectedCheckedInCount}/{selectedRegularSignups.length}</span>
                  {#if selectedEvent}<button class="ghost" on:click={() => toggleEventStatus(selectedEvent.id)}>{selectedEvent.status === '开放报名' ? '关闭报名' : '开放报名'}</button>{/if}
                </div>
              </div>

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

              {#if selectedSignups.length === 0}
                <p class="empty">暂无报名</p>
              {/if}
              <label class="csv"><Download size={16} />CSV文本<textarea readonly value={csv}></textarea></label>
            </section>
          </section>
        {:else}
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
        {/if}
      </div>
    {/if}
  </section>
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
@media (max-width: 900px) { main { padding: 16px; } .hero, .eventHead, .seriesBanner { align-items: start; flex-direction: column; } .metrics { grid-template-columns: repeat(3, 1fr); } .layout, .adminGrid, .bookLibrary { grid-template-columns: 1fr; } .signupRow, .bookCard { flex-direction: column; } }
</style>
