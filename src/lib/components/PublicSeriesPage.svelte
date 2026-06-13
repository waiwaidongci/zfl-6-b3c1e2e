<script>
  import { onMount, tick } from 'svelte';
  import { Layers, UserCheck, Users, Calendar } from 'lucide-svelte';
  import {
    readAllStore,
    getSeriesById,
    isValidSeriesId,
    getSeriesEvents,
    getSeatsLeft,
    getWaitlistCount,
    getRegularSignupCount,
    getSeriesStatsSummary
  } from '$lib/utils/storeUtils.js';
  import { buildPublicEventUrl } from '$lib/utils/eventLinkUtils.js';
  import { onExternalChange, getCurrentVersions, getChangedKeys, destroyChannel } from '$lib/utils/syncStore.js';

  export let seriesId;

  let books = [];
  let events = [];
  let signups = [];
  let mySignupIds = [];
  let series = [];
  let hydrated = false;

  let _syncVersions = {};
  let _unsubscribeSync = null;

  $: currentSeries = hydrated ? getSeriesById(series, seriesId) : null;
  $: isValid = hydrated ? isValidSeriesId(series, seriesId) : false;
  $: seriesEvents = currentSeries ? getSeriesEvents(events, currentSeries.id) : [];
  $: seriesStats = currentSeries ? getSeriesStatsSummary(events, signups, currentSeries.id) : null;

  onMount(() => {
    const store = readAllStore();
    books = store.books;
    events = store.events;
    signups = store.signups;
    mySignupIds = store.mySignupIds;
    series = store.series;
    hydrated = true;
    _syncVersions = getCurrentVersions();

    _unsubscribeSync = onExternalChange(() => {
      const changedKeys = getChangedKeys(_syncVersions);
      if (changedKeys.length === 0) return;
      const store = readAllStore();
      events = store.events;
      signups = store.signups;
      mySignupIds = store.mySignupIds;
      series = store.series;
      books = store.books;
      _syncVersions = getCurrentVersions();
    });

    return () => {
      if (_unsubscribeSync) _unsubscribeSync();
      destroyChannel();
    };
  });

  function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.replace('T', ' ');
  }

  function navigateToEvent(evId) {
    if (typeof window !== 'undefined') {
      window.location.href = buildPublicEventUrl(evId);
    }
  }

  function getEventStatusBadge(ev) {
    if (ev.status === '开放报名') return { class: 'regular', text: '开放报名' };
    return { class: 'waitlist', text: '已关闭' };
  }

  function hasMySignupForEvent(eventId) {
    return signups.some(
      (s) => s.eventId === eventId && mySignupIds.includes(s.id)
    );
  }

  function getMySignupStatus(eventId) {
    const my = signups.find(
      (s) => s.eventId === eventId && mySignupIds.includes(s.id)
    );
    if (!my) return null;
    if (my.reviewStatus === '待审核') return { text: '待审核', class: 'pending' };
    if (my.reviewStatus === '已拒绝') return { text: '已拒绝', class: 'rejected' };
    if (my.status === '候补') return { text: `候补 #${my.waitlistPosition}`, class: 'waitlist' };
    return { text: '已报名', class: 'regular' };
  }
</script>

<div class="publicPage">
  {#if !hydrated}
    <div class="notFound">
      <h2>加载中...</h2>
    </div>
  {:else if !isValid || !currentSeries}
    <div class="notFound">
      <h2>系列不存在</h2>
      <p>该系列链接无效或系列已被删除。</p>
    </div>
  {:else}
    <header class="publicHero">
      <div>
        <span>独立书店</span>
        <h1>读书会系列</h1>
      </div>
    </header>

    <div class="seriesBanner seriesHeroBanner">
      <div class="seriesBannerInfo">
        <Layers size={20} />
        <span class="seriesBannerLabel">系列活动</span>
        <strong class="seriesTitle">{currentSeries.title}</strong>
      </div>
      {#if seriesStats}
        <div class="seriesStatsPill">
          <span><Calendar size={12} /> {seriesStats.eventCount} 期</span>
          <span><Users size={12} /> {seriesStats.openCount} 场开放</span>
        </div>
      {/if}
    </div>

    <section class="eventPanel">
      {#if currentSeries.description}
        <div class="bookDescription seriesDescription">
          <h3>📖 系列主题</h3>
          <p>{currentSeries.description}</p>
        </div>
      {/if}

      {#if seriesStats && seriesStats.eventCount > 0}
        <div class="seriesOverviewBar">
          <div class="overviewItem">
            <UserCheck size={16} />
            <div>
              <strong>{seriesStats.totalRegular}</strong>
              <span>已报名</span>
            </div>
          </div>
          <div class="overviewItem">
            <Users size={16} />
            <div>
              <strong>{seriesStats.totalWaitlist}</strong>
              <span>候补人数</span>
            </div>
          </div>
          <div class="overviewItem">
            <Calendar size={16} />
            <div>
              <strong>{seriesStats.totalSeats}</strong>
              <span>总名额</span>
            </div>
          </div>
        </div>
      {/if}

      <div class="seriesEventsPanel">
        <h3>📚 全部场次 ({seriesEvents.length})</h3>
        {#if seriesEvents.length === 0}
          <p class="empty empty-small">该系列下暂无活动场次</p>
        {:else}
          <div class="seriesEventsList">
            {#each seriesEvents as ev, idx}
              {@const seatsLeft = getSeatsLeft(events, signups, ev.id)}
              {@const waitlistCount = getWaitlistCount(signups, ev.id)}
              {@const regularCount = getRegularSignupCount(signups, ev.id)}
              {@const statusBadge = getEventStatusBadge(ev)}
              {@const myStatus = getMySignupStatus(ev.id)}
              {@const hasMy = hasMySignupForEvent(ev.id)}
              <button
                class="seriesEventItem seriesEventItem-large"
                on:click={() => navigateToEvent(ev.id)}
              >
                <div class="seriesEventHeader">
                  <span class="episodeBadge">第{idx + 1}期</span>
                  <span class="status-badge {statusBadge.class}">{statusBadge.text}</span>
                  {#if hasMy && myStatus}
                    <span class="status-badge mine {myStatus.class}">我：{myStatus.text}</span>
                  {/if}
                </div>
                <div class="seriesEventMain">
                  <div class="seriesEventInfo">
                    <strong class="eventBookTitle">{ev.book}</strong>
                    {#if ev.author}
                      <span class="eventAuthor">作者：{ev.author}</span>
                    {/if}
                    <span class="eventMeta">{ev.host} · {formatTime(ev.time)}</span>
                  </div>
                  <div class="eventSeatsColumn">
                    <div class="seatsMain">
                      <strong>{seatsLeft}个余位</strong>
                      <span class="seatsLimit">上限 {ev.limit} 人</span>
                    </div>
                    <div class="seatsSubInfo">
                      {#if regularCount > 0}
                        <span class="regularCount"><UserCheck size={12} /> {regularCount}人已报</span>
                      {/if}
                      {#if waitlistCount > 0}
                        <span class="waitlistCount">{waitlistCount}人候补</span>
                      {/if}
                    </div>
                  </div>
                </div>
                {#if ev.description}
                  <p class="eventDescPreview">{ev.description.length > 80 ? ev.description.slice(0, 80) + '...' : ev.description}</p>
                {/if}
                <div class="enterSignupHint">
                  <span>进入报名页 →</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
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
    max-width: 780px;
    margin: 0 auto;
    box-shadow: 0 10px 28px rgb(49 43 31 / .07);
  }

  .seriesHeroBanner {
    margin-bottom: 16px;
    max-width: 780px;
    margin-left: auto;
    margin-right: auto;
    padding: 16px 18px;
  }
  .seriesHeroBanner .seriesTitle { font-size: 18px; }
  .seriesStatsPill {
    display: inline-flex;
    gap: 10px;
    background: #fff;
    padding: 4px 12px;
    border-radius: 12px;
  }
  .seriesStatsPill span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #6b6459;
    font-weight: 500;
  }

  .bookDescription {
    background: #fff8ee;
    border: 1px solid #e8ddc8;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 16px;
  }
  .bookDescription h3 { margin: 0 0 8px; font-size: 15px; color: #4b4435; }
  .bookDescription p { margin: 0; line-height: 1.7; color: #4a4439; }
  .seriesDescription { background: #f0ebe0; border-color: #d7cbb3; }

  .seriesOverviewBar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }
  .overviewItem {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: #faf7f0;
    border: 1px solid #e8ddc8;
    border-radius: 8px;
  }
  .overviewItem :global(svg) { color: #7b6b4e; flex-shrink: 0; }
  .overviewItem strong {
    display: block;
    font-size: 22px;
    color: #2a2822;
    line-height: 1;
  }
  .overviewItem span {
    font-size: 12px;
    color: #6b6459;
  }

  .seriesEventsPanel {
    margin-top: 8px;
  }
  .seriesEventsPanel h3 { margin: 0 0 14px; font-size: 16px; color: #4b4435; }
  .seriesEventsList { display: flex; flex-direction: column; gap: 12px; }

  .seriesEventItem-large {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 18px;
    background: #fffaf2;
    border: 1px solid #e3dacb;
    border-radius: 10px;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: inherit;
    transition: all 0.2s;
  }
  .seriesEventItem-large:hover {
    background: #fff3e0;
    border-color: #c4b99a;
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgb(49 43 31 / .08);
  }

  .seriesEventHeader {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .seriesEventMain {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
  }
  .seriesEventInfo { flex: 1; min-width: 0; }
  .eventBookTitle {
    display: block;
    font-size: 17px;
    color: #2a2822;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .eventAuthor {
    display: block;
    font-size: 13px;
    color: #6b6459;
    margin-bottom: 2px;
  }
  .eventMeta {
    display: block;
    font-size: 13px;
    color: #6b6459;
  }

  .eventSeatsColumn {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-shrink: 0;
  }
  .seatsMain { text-align: right; }
  .seatsMain strong {
    display: block;
    font-size: 22px;
    white-space: nowrap;
    color: #2a2822;
    line-height: 1;
  }
  .seatsLimit {
    display: block;
    font-size: 11px;
    color: #999;
    margin-top: 2px;
  }
  .seatsSubInfo {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
  }
  .waitlistCount {
    font-size: 12px;
    color: #b36b00;
    background: #fff3e0;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .regularCount {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #1e7e34;
    background: #e6f4ea;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .eventDescPreview {
    margin: 0;
    padding: 10px 12px;
    background: #fff;
    border: 1px dashed #e3dacb;
    border-radius: 6px;
    font-size: 13px;
    color: #5a5245;
    line-height: 1.6;
  }

  .enterSignupHint {
    text-align: right;
    padding-top: 4px;
    border-top: 1px dashed #e3dacb;
  }
  .enterSignupHint span {
    display: inline-flex;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
    color: #7b6b4e;
  }

  .episodeBadge {
    display: inline-block;
    font-size: 11px;
    color: #fff;
    background: #7b6b4e;
    padding: 3px 10px;
    border-radius: 8px;
    font-weight: 600;
  }
  .episodeBadge.small { font-size: 10px; padding: 1px 6px; }

  .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }
  .status-badge.regular { background: #e6f4ea; color: #1e7e34; }
  .status-badge.waitlist { background: #fff3e0; color: #b36b00; }
  .status-badge.pending { background: #fff3cd; color: #856404; }
  .status-badge.rejected { background: #f8d7da; color: #721c24; }
  .status-badge.mine { background: #e3f2fd; color: #1565c0; }

  .seriesBanner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    background: linear-gradient(135deg, #efe7d8, #fff8ee);
    border: 1px solid #d7cbb3;
    border-radius: 8px;
    flex-wrap: wrap;
    gap: 10px;
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
    font-weight: 500;
  }
  .seriesBannerInfo strong { color: #4b4435; }
  .seriesBannerCount { font-size: 12px; color: #686258; }

  .publicFooter {
    text-align: center;
    padding: 30px 20px 10px;
    color: #999;
    font-size: 13px;
    max-width: 780px;
    margin: 0 auto;
  }

  .empty { text-align: center; color: #999; padding: 20px 10px; font-size: 14px; }
  .empty-small { padding: 20px 10px; font-size: 13px; }

  @media (max-width: 640px) {
    .publicPage { padding: 16px; }
    .seriesEventMain { flex-direction: column; }
    .eventSeatsColumn {
      align-items: flex-start;
      width: 100%;
      padding: 10px;
      background: #fff;
      border-radius: 6px;
      border: 1px solid #e8ddc8;
    }
    .seatsMain { text-align: left; }
    .seatsSubInfo { align-items: flex-start; }
    .seriesOverviewBar { grid-template-columns: 1fr; }
    .seriesHeroBanner { padding: 14px; }
    .eventPanel { padding: 18px; }
  }
</style>
