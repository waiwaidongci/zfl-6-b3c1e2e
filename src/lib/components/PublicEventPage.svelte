<script>
  import { onMount } from 'svelte';
  import { Layers, UserCheck } from 'lucide-svelte';
  import {
    readAllStore,
    writeSignups,
    writeMySignupIds,
    getEventById,
    getSeriesOfEvent,
    getSeriesEvents,
    getEventIndexInSeries,
    getSeatsLeft,
    getWaitlistCount,
    getRegularSignupCount,
    createSignup,
    cancelSignup
  } from '$lib/utils/storeUtils.js';

  export let eventId;

  let books = [];
  let events = [];
  let signups = [];
  let mySignupIds = [];
  let series = [];
  let hydrated = false;

  let signupForm = { name: '', phone: '', answer: '' };
  let signupSuccess = false;
  let lastSignupStatus = '';
  let lastSignupWaitlistPosition = 0;

  $: event = getEventById(events, eventId);
  $: eventSeries = event ? getSeriesOfEvent(events, series, eventId) : null;
  $: seriesEvents = eventSeries ? getSeriesEvents(events, eventSeries.id) : [];
  $: mySignups = signups.filter((item) => mySignupIds.includes(item.id) && item.eventId === eventId);
  $: seatsLeft = event ? getSeatsLeft(events, signups, eventId) : 0;
  $: waitlistCount = event ? getWaitlistCount(signups, eventId) : 0;
  $: regularCount = event ? getRegularSignupCount(signups, eventId) : 0;
  $: hasMySignup = mySignups.length > 0;
  $: myLatestSignup = mySignups.length > 0 ? mySignups[0] : null;

  $: if (hydrated) {
    writeSignups(signups);
    writeMySignupIds(mySignupIds);
  }

  onMount(() => {
    const store = readAllStore();
    books = store.books;
    events = store.events;
    signups = store.signups;
    mySignupIds = store.mySignupIds;
    series = store.series;
    hydrated = true;
  });

  function handleSignup() {
    if (!event || event.status !== '开放报名' || !signupForm.name.trim()) return;

    const result = createSignup(events, signups, eventId, signupForm);
    if (result.success) {
      signups = result.signups;
      mySignupIds = [...mySignupIds, result.signup.id];
      signupSuccess = true;
      lastSignupStatus = result.signup.status;
      lastSignupWaitlistPosition = result.signup.waitlistPosition || 0;
      signupForm = { name: '', phone: '', answer: '' };
    }
  }

  function handleCancelSignup(id) {
    const signup = signups.find((item) => item.id === id);
    if (!signup) return;
    if (!confirm('确定要取消报名吗？')) return;
    signups = cancelSignup(events, signups, id);
    mySignupIds = mySignupIds.filter((mid) => mid !== id);
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.replace('T', ' ');
  }

  function navigateToEvent(evId) {
    if (typeof window !== 'undefined') {
      window.location.href = `/public/${encodeURIComponent(evId)}`;
    }
  }
</script>

<div class="publicPage">
  {#if !event}
    <div class="notFound">
      <h2>活动不存在</h2>
      <p>该活动链接无效或活动已被删除。</p>
    </div>
  {:else}
    <header class="publicHero">
      <div>
        <span>独立书店</span>
        <h1>读书会报名</h1>
      </div>
    </header>

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
        <span class="seriesBannerEpisode">第 {getEventIndexInSeries(events, eventId)} 期</span>
      </div>
    {/if}

    <section class="eventPanel">
      <div class="eventHead">
        <div>
          <h2>{event.book}</h2>
          {#if event.author}
            <p class="author">作者：{event.author}</p>
          {/if}
          <p>{event.host} · {formatTime(event.time)} · {event.status}</p>
        </div>
        <div class="seatsInfo">
          <strong>{seatsLeft}个余位</strong>
          {#if waitlistCount > 0}
            <span class="waitlistCount">{waitlistCount}人候补</span>
          {/if}
          {#if regularCount > 0}
            <span class="regularCount"><UserCheck size={12} /> {regularCount}人已报名</span>
          {/if}
        </div>
      </div>

      {#if event.description}
        <div class="bookDescription">
          <h3>书目简介</h3>
          <p>{event.description}</p>
        </div>
      {/if}

      {#if eventSeries && eventSeries.description}
        <div class="bookDescription seriesDescription">
          <h3>系列主题</h3>
          <p>{eventSeries.description}</p>
        </div>
      {/if}

      {#if signupSuccess}
        <div class="successNotice">
          {#if lastSignupStatus === '待审核'}
            ✅ 报名已提交，等待管理员审核通过
          {:else if lastSignupStatus === '候补'}
            ✅ 已加入候补名单，顺序为第 {lastSignupWaitlistPosition} 位
          {:else}
            ✅ 报名成功！
          {/if}
        </div>
      {/if}

      {#if hasMySignup && myLatestSignup}
        <div class="mySignupSection">
          <h3>我的报名状态</h3>
          <article class="mySignup-card" class:waitlist-card={myLatestSignup.status === '候补'} class:pending-card={myLatestSignup.reviewStatus === '待审核'} class:rejected-card={myLatestSignup.reviewStatus === '已拒绝'}>
            <strong>{event.book}</strong>
            <span>{event.host} · {formatTime(event.time)}</span>
            <span>报名时间：{myLatestSignup.createdAt}</span>
            <div class="mySignup-status">
              {#if myLatestSignup.reviewStatus === '待审核'}
                <span class="status-badge pending">待审核</span>
              {:else if myLatestSignup.reviewStatus === '已拒绝'}
                <span class="status-badge rejected">已拒绝</span>
              {:else if myLatestSignup.status === '正式'}
                <span class="status-badge regular">正式报名</span>
              {:else if myLatestSignup.status === '候补'}
                <span class="status-badge waitlist">候补 #{myLatestSignup.waitlistPosition}</span>
              {/if}
              {#if myLatestSignup.reviewStatus === '已通过' && myLatestSignup.status === '正式'}
                <span class="checkin-badge" class:checked={myLatestSignup.checkedIn} class:unchecked={!myLatestSignup.checkedIn}>
                  {myLatestSignup.checkedIn ? '已到场' : '未到场'}
                </span>
              {/if}
              {#if myLatestSignup.checkedIn && myLatestSignup.checkedInAt}
                <span class="checkin-time">签到时间：{myLatestSignup.checkedInAt}</span>
              {/if}
              {#if myLatestSignup.reviewStatus === '已拒绝' && myLatestSignup.rejectionReason}
                <span class="rejection-reason-display">拒绝原因：{myLatestSignup.rejectionReason}</span>
              {/if}
            </div>
            <button class="ghost cancel-btn" on:click={() => handleCancelSignup(myLatestSignup.id)}>
              {myLatestSignup.reviewStatus === '待审核' ? '取消申请' : (myLatestSignup.reviewStatus === '已拒绝' ? '删除记录' : (myLatestSignup.status === '正式' ? '取消报名' : '退出候补'))}
            </button>
          </article>
        </div>
      {:else}
        <form on:submit|preventDefault={handleSignup}>
          <input bind:value={signupForm.name} placeholder="姓名 *" required />
          <input bind:value={signupForm.phone} placeholder="联系方式" />
          <textarea bind:value={signupForm.answer} placeholder={event.question || '报名备注'}></textarea>
          {#if event.reviewRequired}
            <p class="reviewNotice">📋 本活动需要审核，提交后请等待管理员审核通过</p>
          {:else if seatsLeft <= 0 && event.status === '开放报名'}
            <p class="waitlistNotice">⚠️ 活动已报满，提交后将加入候补名单</p>
          {/if}
          {#if event.status === '已关闭'}
            <p class="waitlistNotice">🔒 报名已关闭，无法提交新申请</p>
          {/if}
          <button disabled={event.status !== '开放报名'}>
            {event.status !== '开放报名' ? '报名已关闭' : (event.reviewRequired ? '提交审核' : (seatsLeft <= 0 ? '加入候补' : '提交报名'))}
          </button>
        </form>
      {/if}

      {#if eventSeries && seriesEvents.length > 1}
        <div class="seriesEventsPanel">
          <h3>📚 本系列全部场次</h3>
          <div class="seriesEventsList">
            {#each seriesEvents as ev, idx}
              <button
                class="seriesEventItem"
                class:seriesEventItem-active={ev.id === eventId}
                on:click={() => navigateToEvent(ev.id)}
              >
                <span class="episodeBadge small">第{idx + 1}期</span>
                <div class="seriesEventInfo">
                  <strong>{ev.book}</strong>
                  <span>{ev.host} · {formatTime(ev.time)}</span>
                </div>
                <span class="status-badge {ev.status === '开放报名' ? 'regular' : 'waitlist'}">{ev.status}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <footer class="publicFooter">
      <p>© 独立书店读书会</p>
    </footer>
  {/if}
</div>

<style>
  * { box-sizing: border-box; }
  .publicPage {
    min-height: 100vh;
    background: #f3f0e8;
    padding: 28px;
  }
  .publicHero {
    padding: 30px;
    border-radius: 8px;
    color: #fff;
    background: linear-gradient(135deg, #2b2b25, #7b6b4e);
    margin-bottom: 16px;
  }
  .publicHero span { opacity: .78; }
  .publicHero h1 { margin: 8px 0 0; font-size: clamp(28px, 5vw, 42px); }

  .notFound {
    text-align: center;
    padding: 80px 20px;
    color: #686258;
  }
  .notFound h2 { color: #4b4435; margin: 0 0 8px; }

  .eventPanel {
    background: #fff;
    border: 1px solid #ded7c9;
    border-radius: 8px;
    padding: 24px;
    max-width: 720px;
    margin: 0 auto;
    box-shadow: 0 10px 28px rgb(49 43 31 / .07);
  }

  .eventHead {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: start;
    margin-bottom: 16px;
  }
  .eventHead h2 { margin: 0; font-size: 24px; color: #2a2822; }
  .eventHead p { margin: 4px 0; color: #6b6459; }
  .author { font-size: 14px; color: #6b6459; }

  .seatsInfo {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }
  .seatsInfo strong {
    font-size: 24px;
    white-space: nowrap;
    color: #2a2822;
  }
  .waitlistCount {
    font-size: 13px;
    color: #b36b00;
    background: #fff3e0;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .regularCount {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #1e7e34;
    background: #e6f4ea;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .bookDescription {
    background: #fff8ee;
    border: 1px solid #e8ddc8;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 16px;
  }
  .bookDescription h3 { margin: 0 0 8px; font-size: 15px; color: #4b4435; }
  .bookDescription p { margin: 0; line-height: 1.6; color: #4a4439; }
  .seriesDescription { background: #f0ebe0; border-color: #d7cbb3; }

  .successNotice {
    margin: 0 0 16px;
    padding: 12px 14px;
    background: #e6f4ea;
    border: 1px solid #b7dfbf;
    border-radius: 8px;
    color: #1e7e34;
    font-weight: 500;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  input, textarea {
    width: 100%;
    border: 1px solid #d7ccba;
    border-radius: 8px;
    padding: 11px 12px;
    background: #fff;
    color: #2a2822;
    font: inherit;
  }
  textarea { min-height: 96px; resize: vertical; }
  button {
    border: 0;
    border-radius: 8px;
    padding: 11px 13px;
    background: #4b4435;
    color: #fff;
    cursor: pointer;
    font: inherit;
  }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .ghost { background: #eee8dc; color: #312d25; }

  .waitlistNotice {
    margin: 0;
    padding: 10px 12px;
    background: #fff3e0;
    border: 1px solid #ffcc80;
    border-radius: 8px;
    color: #b36b00;
    font-size: 14px;
  }
  .reviewNotice {
    margin: 0;
    padding: 10px 12px;
    background: #fff3cd;
    border: 1px solid #ffe082;
    border-radius: 8px;
    color: #856404;
    font-size: 14px;
  }

  .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
  .status-badge.regular { background: #e6f4ea; color: #1e7e34; }
  .status-badge.waitlist { background: #fff3e0; color: #b36b00; }
  .status-badge.pending { background: #fff3cd; color: #856404; }
  .status-badge.rejected { background: #f8d7da; color: #721c24; }

  .seriesBanner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    background: linear-gradient(135deg, #efe7d8, #fff8ee);
    border: 1px solid #d7cbb3;
    border-radius: 8px;
    margin-bottom: 14px;
    max-width: 720px;
    margin-left: auto;
    margin-right: auto;
  }
  .seriesBannerInfo {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .seriesBannerLabel {
    font-size: 12px;
    color: #7b6b4e;
    background: #fff;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .seriesBannerInfo strong { font-size: 15px; color: #4b4435; }
  .seriesBannerCount { font-size: 12px; color: #686258; }
  .seriesBannerEpisode {
    font-weight: 600;
    color: #7b6b4e;
    background: #fff;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 13px;
  }

  .seriesEventsPanel {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid #e8ddc8;
  }
  .seriesEventsPanel h3 { margin: 0 0 12px; font-size: 15px; color: #4b4435; }
  .seriesEventsList { display: flex; flex-direction: column; gap: 8px; }
  .seriesEventItem {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: #fffaf2;
    border: 1px solid #e3dacb;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  .seriesEventItem-active { border-color: #7b6b4e; background: #efe7d8; }
  .seriesEventInfo { flex: 1; }
  .seriesEventInfo strong { display: block; font-size: 14px; color: #2a2822; }
  .seriesEventInfo span { display: block; font-size: 12px; color: #6b6459; margin-top: 2px; }

  .episodeBadge {
    display: inline-block;
    font-size: 11px;
    color: #fff;
    background: #7b6b4e;
    padding: 2px 8px;
    border-radius: 8px;
    margin-bottom: 4px;
  }
  .episodeBadge.small { font-size: 10px; padding: 1px 6px; margin-bottom: 0; }

  .mySignupSection { margin-top: 18px; }
  .mySignupSection h3 { margin: 0 0 12px; font-size: 16px; color: #4b4435; }
  .mySignup-card {
    border: 1px solid #e3dacb;
    border-radius: 8px;
    padding: 14px;
    background: #fffaf2;
  }
  .mySignup-card strong { display: block; font-size: 15px; color: #2a2822; }
  .mySignup-card span { display: block; color: #6b6459; font-size: 13px; margin-top: 2px; }
  .mySignup-status {
    margin-top: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .checkin-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
  .checkin-badge.checked { background: #e6f4ea; color: #1e7e34; }
  .checkin-badge.unchecked { background: #fce4e4; color: #a33; }
  .checkin-time { font-size: 12px; color: #999; }
  .rejection-reason-display {
    display: block;
    width: 100%;
    margin-top: 8px;
    padding: 8px 10px;
    background: #f8d7da;
    border-radius: 6px;
    color: #721c24;
    font-size: 13px;
  }
  .mySignup-card.waitlist-card { background: #fff8ee; border: 1px dashed #ffcc80 !important; }
  .mySignup-card.pending-card { background: #fffbf0; border: 1px dashed #ffe082 !important; }
  .mySignup-card.rejected-card { background: #fff5f5; border: 1px solid #f5c6cb !important; }
  .mySignup-card .cancel-btn { margin-top: 12px; width: 100%; }

  .publicFooter {
    text-align: center;
    padding: 30px 20px 10px;
    color: #999;
    font-size: 13px;
    max-width: 720px;
    margin: 0 auto;
  }

  @media (max-width: 640px) {
    .publicPage { padding: 16px; }
    .eventHead, .seriesBanner { flex-direction: column; align-items: start; }
    .seatsInfo { align-items: start; }
  }
</style>
