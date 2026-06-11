<script>
  import { onMount } from 'svelte';
  import { BookPlus, CalendarPlus, Download, LibraryBig, ListChecks, UserCheck, Users, X } from 'lucide-svelte';

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

  let books = seedBooks;
  let events = seedEvents;
  let signups = [];
  let selectedId = seedEvents[0].id;
  let mode = '用户端';
  let adminTab = '活动管理';
  let selectedBookId = '';
  let eventForm = { book: '', author: '', description: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名' };
  let bookForm = { title: '', author: '', description: '', question: '' };
  let editingBookId = '';
  let mySignupIds = [];
  let signupForm = { name: '', phone: '', answer: '' };
  let hydrated = false;
  let viewMode = '列表';
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let activeDate = '';

  onMount(() => {
    const storedBooks = localStorage.getItem('zfl-6-books');
    const storedEvents = localStorage.getItem('zfl-6-events');
    const storedSignups = localStorage.getItem('zfl-6-signups');
    const storedMyIds = localStorage.getItem('zfl-6-my-signup-ids');
    if (storedBooks) books = JSON.parse(storedBooks);
    if (storedEvents) events = JSON.parse(storedEvents);
    if (storedSignups) signups = JSON.parse(storedSignups);
    if (storedMyIds) mySignupIds = JSON.parse(storedMyIds);
    selectedId = events[0]?.id || '';
    hydrated = true;
  });

  $: if (hydrated) {
    localStorage.setItem('zfl-6-books', JSON.stringify(books));
    localStorage.setItem('zfl-6-events', JSON.stringify(events));
    localStorage.setItem('zfl-6-signups', JSON.stringify(signups));
    localStorage.setItem('zfl-6-my-signup-ids', JSON.stringify(mySignupIds));
  }
  $: selectedEvent = events.find((event) => event.id === selectedId) || events[0];
  $: selectedSignups = signups.filter((item) => item.eventId === selectedEvent?.id);
  $: mySignups = signups.filter((item) => mySignupIds.includes(item.id));
  $: checkedInCount = signups.filter((item) => item.checkedIn).length;
  $: selectedCheckedInCount = selectedSignups.filter((item) => item.checkedIn).length;
  $: seatsLeft = selectedEvent ? Math.max(0, Number(selectedEvent.limit) - selectedSignups.length) : 0;
  $: csv = ['活动,姓名,手机,回答,报名时间,签到状态,签到时间', ...selectedSignups.map((item) => `"${selectedEvent.book}","${item.name}","${item.phone}","${item.answer}","${item.createdAt}","${item.checkedIn ? '已到场' : '未到场'}","${item.checkedInAt || '-'}"`)].join('\n');

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

  $: todayStr = iso();
  $: calFirstDay = new Date(calYear, calMonth, 1).getDay();
  $: calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  $: eventsByDate = events.reduce((acc, event) => {
    const date = event.time.slice(0, 10);
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {});

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
    const event = { id: crypto.randomUUID(), ...eventForm, limit: Number(eventForm.limit || 0) };
    events = [event, ...events];
    selectedId = event.id;
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

  function signup() {
    if (!selectedEvent || selectedEvent.status !== '开放报名' || seatsLeft <= 0 || !signupForm.name.trim()) return;
    const newSignup = { id: crypto.randomUUID(), eventId: selectedEvent.id, ...signupForm, checkedIn: false, checkedInAt: '', createdAt: new Date().toLocaleString() };
    signups = [newSignup, ...signups];
    mySignupIds = [...mySignupIds, newSignup.id];
    signupForm = { name: '', phone: '', answer: '' };
  }

  function cancelSignup(id) {
    signups = signups.filter((item) => item.id !== id);
  }

  function toggleEventStatus(id) {
    events = events.map((event) => event.id === id ? { ...event, status: event.status === '开放报名' ? '已关闭' : '开放报名' } : event);
  }

  function toggleCheckIn(id) {
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
        {#each events as event}
          <button class:event-active={selectedEvent?.id === event.id} class="eventButton" on:click={() => selectedId = event.id}>
            <strong>{event.book}</strong>
            <span>{event.host} · {event.time.replace('T', ' ')}</span>
          </button>
        {/each}
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
          <div class="eventHead">
            <div>
              <h2>{selectedEvent.book}</h2>
              {#if selectedEvent.author}
                <p class="author">作者：{selectedEvent.author}</p>
              {/if}
              <p>{selectedEvent.host} · {selectedEvent.time.replace('T', ' ')} · {selectedEvent.status}</p>
            </div>
            <strong>{seatsLeft}个余位</strong>
          </div>
          {#if selectedEvent.description}
            <div class="bookDescription">
              <h3>书目简介</h3>
              <p>{selectedEvent.description}</p>
            </div>
          {/if}
          <form on:submit|preventDefault={signup}>
            <input bind:value={signupForm.name} placeholder="姓名" />
            <input bind:value={signupForm.phone} placeholder="联系方式" />
            <textarea bind:value={signupForm.answer} placeholder={selectedEvent.question || '报名备注'}></textarea>
            <button disabled={selectedEvent.status !== '开放报名' || seatsLeft <= 0}>提交报名</button>
          </form>
          {#if mySignups.length > 0}
            <div class="mySignups">
              <h3>我的报名</h3>
              {#each mySignups as item}
                {@const event = events.find((e) => e.id === item.eventId)}
                <article class="mySignup-card">
                  <strong>{event?.book || '未知活动'}</strong>
                  <span>{event?.host} · {event?.time?.replace('T', ' ')}</span>
                  <span>报名时间：{item.createdAt}</span>
                  <div class="mySignup-status">
                    <span class="checkin-badge" class:checked={item.checkedIn} class:unchecked={!item.checkedIn}>
                      {item.checkedIn ? '已到场' : '未到场'}
                    </span>
                    {#if item.checkedIn && item.checkedInAt}
                      <span class="checkin-time">签到时间：{item.checkedInAt}</span>
                    {/if}
                  </div>
                  <button class="ghost cancel-btn" on:click={() => cancelSignup(item.id)}>取消报名</button>
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
          <button class:active={adminTab === '书目库'} on:click={() => adminTab = '书目库'}>书目库</button>
        </div>

        {#if adminTab === '活动管理'}
          <section class="adminGrid">
            <div class="panel">
              <form on:submit|preventDefault={createEvent}>
                <h2><CalendarPlus size={18} />创建活动</h2>

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
                <button>保存活动</button>
              </form>
            </div>

            <section class="panel">
              <div class="eventHead">
                <h2>报名名单</h2>
                <div class="eventHead-actions">
                  <span class="checkin-summary">{selectedCheckedInCount}/{selectedSignups.length} 已签到</span>
                  {#if selectedEvent}<button class="ghost" on:click={() => toggleEventStatus(selectedEvent.id)}>{selectedEvent.status === '开放报名' ? '关闭报名' : '开放报名'}</button>{/if}
                </div>
              </div>
              <div class="signupList">
                {#each selectedSignups as item}
                  <article>
                    <div class="signupRow">
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.phone} · {item.createdAt}</span>
                        <p>{item.answer}</p>
                        {#if item.checkedIn && item.checkedInAt}
                          <span class="checkin-time">签到时间：{item.checkedInAt}</span>
                        {/if}
                      </div>
                      <span class="checkin-badge" class:checked={item.checkedIn} class:unchecked={!item.checkedIn}>
                        {item.checkedIn ? '已到场' : '未到场'}
                      </span>
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
.eventButton { width: 100%; display: block; text-align: left; margin-bottom: 8px; background: #f8f5ee; color: #29261f; border: 1px solid #e1d8ca; }
.eventButton strong, .eventButton span, article strong, article span { display: block; }
.eventButton span, article span, p { color: #6b6459; }
.event-active { border-color: #7b6b4e; background: #efe7d8; }
form { display: flex; flex-direction: column; gap: 10px; }
input, select, textarea { width: 100%; border: 1px solid #d7ccba; border-radius: 8px; padding: 11px 12px; background: #fff; color: #2a2822; }
textarea { min-height: 96px; resize: vertical; }
button { border: 0; border-radius: 8px; padding: 11px 13px; background: #4b4435; color: #fff; cursor: pointer; }
button:disabled { opacity: .55; cursor: not-allowed; }
.ghost { background: #eee8dc; color: #312d25; }
.eventHead { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 16px; }
.eventHead h2, .eventHead p { margin: 0; }
.eventHead strong { white-space: nowrap; font-size: 24px; }
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
@media (max-width: 900px) { main { padding: 16px; } .hero, .eventHead { align-items: start; flex-direction: column; } .metrics, .layout, .adminGrid, .bookLibrary { grid-template-columns: 1fr; } .signupRow, .bookCard { flex-direction: column; } }
</style>
