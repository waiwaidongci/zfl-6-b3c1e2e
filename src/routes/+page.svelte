<script>
  import { onMount } from 'svelte';
  import { CalendarPlus, Download, LibraryBig, ListChecks, Users } from 'lucide-svelte';

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
  let signupForm = { name: '', phone: '', answer: '' };

  onMount(() => {
    const storedEvents = localStorage.getItem('zfl-6-events');
    const storedSignups = localStorage.getItem('zfl-6-signups');
    if (storedEvents) events = JSON.parse(storedEvents);
    if (storedSignups) signups = JSON.parse(storedSignups);
    selectedId = events[0]?.id || '';
  });

  $: localStorageAvailable = typeof localStorage !== 'undefined';
  $: if (localStorageAvailable) {
    localStorage.setItem('zfl-6-events', JSON.stringify(events));
    localStorage.setItem('zfl-6-signups', JSON.stringify(signups));
  }
  $: selectedEvent = events.find((event) => event.id === selectedId) || events[0];
  $: selectedSignups = signups.filter((item) => item.eventId === selectedEvent?.id);
  $: seatsLeft = selectedEvent ? Math.max(0, Number(selectedEvent.limit) - selectedSignups.length) : 0;
  $: csv = ['活动,姓名,手机,回答,报名时间', ...selectedSignups.map((item) => `"${selectedEvent.book}","${item.name}","${item.phone}","${item.answer}","${item.createdAt}"`)].join('\n');

  function createEvent() {
    if (!eventForm.book.trim() || !eventForm.host.trim()) return;
    const event = { id: crypto.randomUUID(), ...eventForm, limit: Number(eventForm.limit || 0) };
    events = [event, ...events];
    selectedId = event.id;
    eventForm = { book: '', host: '', time: `${iso(7)}T19:30`, limit: 10, question: '', status: '开放报名' };
  }

  function signup() {
    if (!selectedEvent || selectedEvent.status !== '开放报名' || seatsLeft <= 0 || !signupForm.name.trim()) return;
    signups = [{ id: crypto.randomUUID(), eventId: selectedEvent.id, ...signupForm, createdAt: new Date().toLocaleString() }, ...signups];
    signupForm = { name: '', phone: '', answer: '' };
  }

  function cancelSignup(id) {
    signups = signups.filter((item) => item.id !== id);
  }

  function toggleEventStatus(id) {
    events = events.map((event) => event.id === id ? { ...event, status: event.status === '开放报名' ? '已关闭' : '开放报名' } : event);
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
            {#if selectedEvent}<button class="ghost" on:click={() => toggleEventStatus(selectedEvent.id)}>{selectedEvent.status === '开放报名' ? '关闭报名' : '开放报名'}</button>{/if}
          </div>
          <div class="signupList">
            {#each selectedSignups as item}
              <article>
                <strong>{item.name}</strong>
                <span>{item.phone} · {item.createdAt}</span>
                <p>{item.answer}</p>
                <button class="ghost" on:click={() => cancelSignup(item.id)}>取消报名</button>
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
.metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
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
@media (max-width: 900px) { main { padding: 16px; } .hero, .eventHead { align-items: start; flex-direction: column; } .metrics, .layout, .adminGrid { grid-template-columns: 1fr; } }
</style>
