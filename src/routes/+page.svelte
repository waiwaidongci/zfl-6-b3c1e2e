<script>
  import { onMount } from 'svelte';
  import { CalendarPlus, Download, LibraryBig, ListChecks, UserCheck, Users } from 'lucide-svelte';

  const iso = (offset = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  const seedEvents = [
    { id: crypto.randomUUID(), book: '秋园', host: '店员阿檀', time: `${iso(3)}T19:30`, limit: 8, question: '你最想讨论哪一章？', status: '开放报名' },
    { id: crypto.randomUUID(), book: '索拉里斯星', host: '老周', time: `${iso(10)}T20:00`, limit: 12, question: '是否读完全文？', status: '开放报名' }
  ];

  let events = seedEvents;
  let signups = [];
  let selectedId = seedEvents[0].id;
  let mode = '用户端';
  let eventForm = { book: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名' };
  let mySignupIds = [];
  let signupForm = { name: '', phone: '', answer: '' };
  let hydrated = false;

  onMount(() => {
    const storedEvents = localStorage.getItem('zfl-6-events');
    const storedSignups = localStorage.getItem('zfl-6-signups');
    const storedMyIds = localStorage.getItem('zfl-6-my-signup-ids');
    if (storedEvents) events = JSON.parse(storedEvents);
    if (storedSignups) signups = JSON.parse(storedSignups);
    if (storedMyIds) mySignupIds = JSON.parse(storedMyIds);
    selectedId = events[0]?.id || '';
    hydrated = true;
  });

  $: if (hydrated) {
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

  function createEvent() {
    if (!eventForm.book.trim() || !eventForm.host.trim()) return;
    const event = { id: crypto.randomUUID(), ...eventForm, limit: Number(eventForm.limit || 0) };
    events = [event, ...events];
    selectedId = event.id;
    eventForm = { book: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名' };
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
      <h2>活动列表</h2>
      {#each events as event}
        <button class:event-active={selectedEvent?.id === event.id} class="eventButton" on:click={() => selectedId = event.id}>
          <strong>{event.book}</strong>
          <span>{event.host} · {event.time.replace('T', ' ')}</span>
        </button>
      {/each}
    </aside>

    {#if mode === '用户端'}
      <section class="panel">
        {#if selectedEvent}
          <div class="eventHead">
            <div>
              <h2>{selectedEvent.book}</h2>
              <p>{selectedEvent.host} · {selectedEvent.time.replace('T', ' ')} · {selectedEvent.status}</p>
            </div>
            <strong>{seatsLeft}个余位</strong>
          </div>
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
      <section class="adminGrid">
        <form class="panel" on:submit|preventDefault={createEvent}>
          <h2><CalendarPlus size={18} />创建活动</h2>
          <input bind:value={eventForm.book} placeholder="书名" />
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
@media (max-width: 900px) { main { padding: 16px; } .hero, .eventHead { align-items: start; flex-direction: column; } .metrics, .layout, .adminGrid { grid-template-columns: 1fr; } .signupRow { flex-direction: column; } }
</style>
