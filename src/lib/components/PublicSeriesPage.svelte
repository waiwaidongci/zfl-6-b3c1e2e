<script>
  import { onMount, tick } from 'svelte';
  import { Layers, UserCheck, Users, Calendar, CheckSquare, Square, XCircle, AlertCircle, Clock, ListPlus } from 'lucide-svelte';
  import {
    readAllStore,
    writeSignups,
    writeMySignupIds,
    getSeriesById,
    isValidSeriesId,
    getSeriesEvents,
    getSeatsLeft,
    getWaitlistCount,
    getRegularSignupCount,
    getSeriesStatsSummary,
    batchSignup,
    batchCancelSeriesSignups,
    getSeriesSignupSummary
  } from '$lib/utils/storeUtils.js';
  import { buildPublicEventUrl } from '$lib/utils/eventLinkUtils.js';
  import { onExternalChange, getCurrentVersions, getChangedKeys, destroyChannel } from '$lib/utils/syncStore.js';
  import { isPending, isRejected, isWaitlist, isRegular, isPromoted, isCheckedIn, getCancelActionLabel } from '$lib/utils/signupStatusMachine.js';
  import { readReaders, writeReaders, findReaderByPhone } from '$lib/utils/readerStore.js';
  import { hasMigratedReaders, markMigrationDone, runFullMigration } from '$lib/utils/readerMigration.js';

  export let seriesId;

  let books = [];
  let events = [];
  let signups = [];
  let mySignupIds = [];
  let series = [];
  let readers = [];
  let hydrated = false;

  let selectedEventIds = new Set();
  let signupForm = { name: '', phone: '', answer: '' };
  let matchedReaderInfo = null;
  let showSignupForm = false;
  let batchResults = null;
  let showCancelConfirm = false;
  let cancelSelectionIds = new Set();

  let _syncVersions = {};
  let _suppressSave = false;
  let _conflictBanner = null;
  let _pendingChangedKeys = [];
  let _unsubscribeSync = null;

  $: currentSeries = hydrated ? getSeriesById(series, seriesId) : null;
  $: isValid = hydrated ? isValidSeriesId(series, seriesId) : false;
  $: seriesEvents = currentSeries ? getSeriesEvents(events, currentSeries.id) : [];
  $: seriesStats = currentSeries ? getSeriesStatsSummary(events, signups, currentSeries.id) : null;
  $: signupSummary = hydrated ? getSeriesSignupSummary(events, signups, mySignupIds, seriesId) : null;
  $: hasAnyMySignup = signupSummary ? signupSummary.totalSignedUp > 0 : false;

  $: openAndAvailableEvents = seriesEvents.filter((ev) => {
    if (ev.status !== '开放报名') return false;
    const alreadySigned = signups.some(
      (s) => s.eventId === ev.id && mySignupIds.includes(s.id)
    );
    return !alreadySigned;
  });

  $: if (hydrated && !_suppressSave) {
    writeSignups(signups);
    writeMySignupIds(mySignupIds);
    writeReaders(readers);
    _syncVersions = getCurrentVersions();
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

  onMount(() => {
    const store = readAllStore();
    books = store.books;
    events = store.events;
    signups = store.signups;
    mySignupIds = store.mySignupIds;
    series = store.series;
    readers = readReaders();

    if (!hasMigratedReaders() && signups.length > 0) {
      const result = runFullMigration(readers, signups);
      readers = result.readers;
      signups = result.signups;
      writeReaders(readers);
      writeSignups(signups);
      markMigrationDone();
    }

    hydrated = true;
    _syncVersions = getCurrentVersions();

    _unsubscribeSync = onExternalChange(() => {
      if (_suppressSave) return;
      const changedKeys = getChangedKeys(_syncVersions);
      if (changedKeys.length === 0) return;

      const isDirty = signupForm.name?.trim() || signupForm.phone?.trim() || signupForm.answer?.trim();

      if (isDirty) {
        _pendingChangedKeys = [...new Set([..._pendingChangedKeys, ...changedKeys])];
        _conflictBanner = true;
      } else {
        applyExternalReload(changedKeys);
      }
    });

    return () => {
      if (_unsubscribeSync) _unsubscribeSync();
      destroyChannel();
    };
  });

  function applyExternalReload(changedKeys) {
    _suppressSave = true;
    const store = readAllStore();
    const newReaders = readReaders();
    for (const key of changedKeys) {
      if (key === 'zfl-6-events') events = store.events;
      else if (key === 'zfl-6-signups') signups = store.signups;
      else if (key === 'zfl-6-my-signup-ids') mySignupIds = store.mySignupIds;
      else if (key === 'zfl-6-series') series = store.series;
      else if (key === 'zfl-6-readers') readers = newReaders;
      else if (key === 'zfl-6-books') books = store.books;
    }
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

  function getMySignupForEvent(eventId) {
    return signups.find(
      (s) => s.eventId === eventId && mySignupIds.includes(s.id)
    ) || null;
  }

  function getMySignupStatus(eventId) {
    const my = getMySignupForEvent(eventId);
    if (!my) return null;
    if (isPending(my.status)) return { text: '待审核', class: 'pending' };
    if (isRejected(my.status)) return { text: '已拒绝', class: 'rejected' };
    if (isWaitlist(my.status)) return { text: `候补 #${my.waitlistPosition}`, class: 'waitlist' };
    const isPromotedSignup = isPromoted(my.status) || my._wasWaitlisted;
    if (isPromotedSignup && isCheckedIn(my.status)) return { text: '候补转正·已到场', class: 'promoted' };
    if (isPromotedSignup) return { text: '候补转正', class: 'promoted' };
    if (isCheckedIn(my.status)) return { text: '已报名·已到场', class: 'regular' };
    return { text: '已报名', class: 'regular' };
  }

  function toggleEventSelection(evId) {
    const newSet = new Set(selectedEventIds);
    if (newSet.has(evId)) {
      newSet.delete(evId);
    } else {
      newSet.add(evId);
    }
    selectedEventIds = newSet;
  }

  function selectAllOpen() {
    const newSet = new Set(selectedEventIds);
    for (const ev of openAndAvailableEvents) {
      newSet.add(ev.id);
    }
    selectedEventIds = newSet;
  }

  function clearSelection() {
    selectedEventIds = new Set();
  }

  function openSignupForm() {
    if (selectedEventIds.size === 0) return;
    showSignupForm = true;
    batchResults = null;
  }

  function closeSignupForm() {
    showSignupForm = false;
  }

  function handleBatchSignup() {
    if (selectedEventIds.size === 0 || !signupForm.name.trim()) return;
    const eventIds = Array.from(selectedEventIds);
    const result = batchSignup(events, signups, eventIds, signupForm, readers);
    if (result.success) {
      signups = result.signups;
      readers = result.readers;
      mySignupIds = [...mySignupIds, ...result.newMySignupIds];
      batchResults = result.results;
      showSignupForm = false;
      selectedEventIds = new Set();
      signupForm = { name: '', phone: '', answer: '' };
      matchedReaderInfo = null;
    }
  }

  function openCancelMode() {
    showCancelConfirm = true;
    cancelSelectionIds = new Set();
    const summary = getSeriesSignupSummary(events, signups, mySignupIds, seriesId);
    const cancellableIds = [];
    for (const item of [...summary.confirmed, ...summary.waitlisted, ...summary.pending]) {
      if (item.signup) cancellableIds.push(item.signup.id);
    }
    cancelSelectionIds = new Set(cancellableIds);
  }

  function toggleCancelSelection(signupId) {
    const newSet = new Set(cancelSelectionIds);
    if (newSet.has(signupId)) {
      newSet.delete(signupId);
    } else {
      newSet.add(signupId);
    }
    cancelSelectionIds = newSet;
  }

  function selectAllCancellable() {
    const summary = getSeriesSignupSummary(events, signups, mySignupIds, seriesId);
    const allIds = [];
    for (const item of [...summary.confirmed, ...summary.waitlisted, ...summary.pending]) {
      if (item.signup) allIds.push(item.signup.id);
    }
    cancelSelectionIds = new Set(allIds);
  }

  function clearCancelSelection() {
    cancelSelectionIds = new Set();
  }

  function handleBatchCancel() {
    if (cancelSelectionIds.size === 0) return;
    if (!confirm(`确定要取消选中的 ${cancelSelectionIds.size} 场报名吗？`)) return;
    const idsToCancel = Array.from(cancelSelectionIds);
    const result = batchCancelSeriesSignups(events, signups, mySignupIds, idsToCancel);
    signups = result.signups;
    mySignupIds = result.mySignupIds;
    showCancelConfirm = false;
    cancelSelectionIds = new Set();
    batchResults = null;
  }

  function cancelSingleSignup(signupId) {
    if (!confirm('确定要取消报名吗？')) return;
    const result = batchCancelSeriesSignups(events, signups, mySignupIds, [signupId]);
    signups = result.signups;
    mySignupIds = result.mySignupIds;
  }

  function getResultLabel(result) {
    if (!result.success) return { text: result.reason || '不可报名', class: 'rejected' };
    const s = result.signup;
    if (!s) return { text: '不可报名', class: 'rejected' };
    if (isPending(s.status)) return { text: '待审核', class: 'pending' };
    if (isWaitlist(s.status)) return { text: `候补 #${s.waitlistPosition}`, class: 'waitlist' };
    return { text: '正式报名', class: 'regular' };
  }
</script>

<div class="publicPage">
  {#if _conflictBanner}
    <div class="sync-conflict-banner">
      <span class="sync-conflict-text">⚠️ 后台数据已更新</span>
      <div class="sync-conflict-actions">
        <button class="sync-refresh-btn" on:click={handleConflictRefresh}>刷新数据</button>
        <button class="sync-dismiss-btn" on:click={handleConflictDismiss}>继续填写</button>
      </div>
    </div>
  {/if}

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

      {#if signupSummary && hasAnyMySignup && !showCancelConfirm}
        <div class="mySignupsSection">
          <div class="mySignupsHeader">
            <h3>📋 我的报名状态</h3>
            <button class="ghost cancel-all-trigger" on:click={openCancelMode}>
              批量取消报名
            </button>
          </div>

          {#if signupSummary.confirmed.length > 0}
            <div class="signupGroup">
              <h4 class="groupLabel confirmed">✅ 正式报名 ({signupSummary.confirmed.length})</h4>
              {#each signupSummary.confirmed as item}
                {@const ev = item.event}
                {@const my = item.signup}
                <div class="mySignupItem confirmed">
                  <div class="mySignupInfo">
                    <strong>{ev.book}</strong>
                    <span>{ev.host} · {formatTime(ev.time)}</span>
                  </div>
                  <div class="mySignupActions">
                    {#if isPromoted(my.status)}
                      <span class="status-badge promoted">候补转正</span>
                    {:else}
                      <span class="status-badge regular">正式报名</span>
                    {/if}
                    <button class="ghost small-cancel-btn" on:click={() => cancelSingleSignup(my.id)}>
                      取消
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if signupSummary.waitlisted.length > 0}
            <div class="signupGroup">
              <h4 class="groupLabel waitlist">⏳ 候补中 ({signupSummary.waitlisted.length})</h4>
              {#each signupSummary.waitlisted as item}
                {@const ev = item.event}
                {@const my = item.signup}
                <div class="mySignupItem waitlisted">
                  <div class="mySignupInfo">
                    <strong>{ev.book}</strong>
                    <span>{ev.host} · {formatTime(ev.time)}</span>
                  </div>
                  <div class="mySignupActions">
                    <span class="status-badge waitlist">候补 #{my.waitlistPosition}</span>
                    <button class="ghost small-cancel-btn" on:click={() => cancelSingleSignup(my.id)}>
                      退出候补
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if signupSummary.pending.length > 0}
            <div class="signupGroup">
              <h4 class="groupLabel pending">📋 待审核 ({signupSummary.pending.length})</h4>
              {#each signupSummary.pending as item}
                {@const ev = item.event}
                {@const my = item.signup}
                <div class="mySignupItem pending">
                  <div class="mySignupInfo">
                    <strong>{ev.book}</strong>
                    <span>{ev.host} · {formatTime(ev.time)}</span>
                  </div>
                  <div class="mySignupActions">
                    <span class="status-badge pending">待审核</span>
                    <button class="ghost small-cancel-btn" on:click={() => cancelSingleSignup(my.id)}>
                      取消申请
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if signupSummary.rejected.length > 0}
            <div class="signupGroup">
              <h4 class="groupLabel rejected">❌ 已拒绝 ({signupSummary.rejected.length})</h4>
              {#each signupSummary.rejected as item}
                {@const ev = item.event}
                {@const my = item.signup}
                <div class="mySignupItem rejected">
                  <div class="mySignupInfo">
                    <strong>{ev.book}</strong>
                    <span>{ev.host} · {formatTime(ev.time)}</span>
                  </div>
                  <div class="mySignupActions">
                    <span class="status-badge rejected">已拒绝</span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if showCancelConfirm}
        <div class="cancelConfirmSection">
          <h3>取消报名选择</h3>
          <p class="cancelHint">选择要取消的场次，取消后候补将自动转正</p>
          <div class="cancelActions">
            <button class="ghost" on:click={selectAllCancellable}>全选</button>
            <button class="ghost" on:click={clearCancelSelection}>取消全选</button>
          </div>
          <div class="cancelList">
            {#each signupSummary.confirmed as item}
              {@const ev = item.event}
              {@const my = item.signup}
              <label class="cancelItem">
                <input type="checkbox" checked={cancelSelectionIds.has(my.id)} on:change={() => toggleCancelSelection(my.id)} />
                <span class="cancelItemInfo">
                  <strong>{ev.book}</strong>
                  <span class="status-badge regular">正式报名</span>
                </span>
              </label>
            {/each}
            {#each signupSummary.waitlisted as item}
              {@const ev = item.event}
              {@const my = item.signup}
              <label class="cancelItem">
                <input type="checkbox" checked={cancelSelectionIds.has(my.id)} on:change={() => toggleCancelSelection(my.id)} />
                <span class="cancelItemInfo">
                  <strong>{ev.book}</strong>
                  <span class="status-badge waitlist">候补 #{my.waitlistPosition}</span>
                </span>
              </label>
            {/each}
            {#each signupSummary.pending as item}
              {@const ev = item.event}
              {@const my = item.signup}
              <label class="cancelItem">
                <input type="checkbox" checked={cancelSelectionIds.has(my.id)} on:change={() => toggleCancelSelection(my.id)} />
                <span class="cancelItemInfo">
                  <strong>{ev.book}</strong>
                  <span class="status-badge pending">待审核</span>
                </span>
              </label>
            {/each}
          </div>
          <div class="cancelFooter">
            <button class="ghost" on:click={() => { showCancelConfirm = false; cancelSelectionIds = new Set(); }}>返回</button>
            <button class="danger-btn" disabled={cancelSelectionIds.size === 0} on:click={handleBatchCancel}>
              确认取消 {cancelSelectionIds.size} 场报名
            </button>
          </div>
        </div>
      {:else if batchResults}
        <div class="batchResultsSection">
          <h3>📝 报名结果</h3>
          {#each batchResults as result}
            {@const ev = seriesEvents.find((e) => e.id === result.eventId)}
            {@const label = getResultLabel(result)}
            <div class="batchResultItem {label.class}">
              <div class="resultInfo">
                <strong>{ev?.book || '未知'}</strong>
                <span>{ev?.host || ''} · {formatTime(ev?.time || '')}</span>
              </div>
              <span class="status-badge {label.class}">{label.text}</span>
            </div>
          {/each}
          <button class="ghost" on:click={() => { batchResults = null; }}>关闭</button>
        </div>
      {:else if showSignupForm}
        <div class="signupFormSection">
          <h3>整季报名 — 已选 {selectedEventIds.size} 场</h3>
          <form on:submit|preventDefault={handleBatchSignup}>
            <input bind:value={signupForm.name} placeholder="姓名 *" required />
            <input bind:value={signupForm.phone} placeholder="联系方式" />
            {#if matchedReaderInfo}
              <div class="readerMatchNotice">
                <span>👤 已识别老读者：{matchedReaderInfo.name}</span>
                {#if matchedReaderInfo.note}
                  <span class="readerNote">历史备注：{matchedReaderInfo.note}</span>
                {/if}
              </div>
            {/if}
            <textarea bind:value={signupForm.answer} placeholder="报名备注（适用于所有选中场次）"></textarea>

            <div class="selectedEventsList">
              <h4>报名场次预览</h4>
              {#each seriesEvents as ev, idx}
                {@const seatsLeft = getSeatsLeft(events, signups, ev.id)}
                {@const isSelected = selectedEventIds.has(ev.id)}
                {#if isSelected}
                  <div class="selectedEventPreview">
                    <span class="episodeBadge small">第{idx + 1}期</span>
                    <strong>{ev.book}</strong>
                    <span class="eventMetaSmall">{ev.host} · {formatTime(ev.time)}</span>
                    {#if ev.reviewRequired}
                      <span class="reviewTag">需审核</span>
                    {:else if seatsLeft <= 0}
                      <span class="waitlistTag">候补</span>
                    {:else}
                      <span class="seatsTag">{seatsLeft}个余位</span>
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>

            <div class="formActions">
              <button type="button" class="ghost" on:click={closeSignupForm}>取消</button>
              <button type="submit" disabled={selectedEventIds.size === 0 || !signupForm.name.trim()}>
                提交 {selectedEventIds.size} 场报名
              </button>
            </div>
          </form>
        </div>
      {:else}
        <div class="seriesSignupPanel">
          {#if openAndAvailableEvents.length > 0}
            <div class="selectionBar">
              <h3><ListPlus size={16} /> 整季报名 — 选择场次</h3>
              <div class="selectionActions">
                <button class="ghost small-btn" on:click={selectAllOpen}>全选开放场次</button>
                <button class="ghost small-btn" on:click={clearSelection}>清除选择</button>
                <span class="selectionCount">已选 {selectedEventIds.size} 场</span>
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
                  {@const canSelect = ev.status === '开放报名' && !hasMy}
                  {@const isSelected = selectedEventIds.has(ev.id)}

                  <div class="seriesEventItem seriesEventItem-large" class:seriesEventItem-selected={isSelected} class:seriesEventItem-mine={hasMy}>
                    {#if canSelect}
                      <div class="eventCheckbox" on:click|stopPropagation={() => toggleEventSelection(ev.id)}>
                        {#if isSelected}
                          <CheckSquare size={20} class="checkbox-checked" />
                        {:else}
                          <Square size={20} class="checkbox-unchecked" />
                        {/if}
                      </div>
                    {:else if hasMy}
                      <div class="eventCheckbox eventCheckbox-mine">
                        <CheckSquare size={20} />
                      </div>
                    {:else}
                      <div class="eventCheckbox eventCheckbox-closed">
                        <XCircle size={20} />
                      </div>
                    {/if}

                    <div class="seriesEventContent" on:click={() => navigateToEvent(ev.id)}>
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
                          {#if ev.reviewRequired}
                            <span class="reviewRequiredTag">📋 需审核</span>
                          {/if}
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
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          {#if openAndAvailableEvents.length > 0}
            <div class="batchSubmitBar" class:batchSubmitBar-active={selectedEventIds.size > 0}>
              <button class="primary-btn" disabled={selectedEventIds.size === 0} on:click={openSignupForm}>
                报名选中场次 ({selectedEventIds.size})
              </button>
              <span class="batchHint">或点击单场进入详情页报名</span>
            </div>
          {/if}
        </div>
      {/if}

      {#if !showCancelConfirm && !showSignupForm}
        <footer class="publicFooter">
          <p>© 独立书店读书会</p>
        </footer>
      {/if}
    </section>
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

  .mySignupsSection {
    margin-bottom: 20px;
    padding: 16px;
    background: #faf8f2;
    border: 1px solid #e3dacb;
    border-radius: 10px;
  }
  .mySignupsHeader {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .mySignupsHeader h3 { margin: 0; font-size: 16px; color: #4b4435; }
  .cancel-all-trigger {
    font-size: 13px;
    padding: 6px 12px;
  }

  .signupGroup {
    margin-bottom: 12px;
  }
  .signupGroup:last-child { margin-bottom: 0; }
  .groupLabel {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    padding: 4px 0;
  }
  .groupLabel.confirmed { color: #1e7e34; }
  .groupLabel.waitlist { color: #b36b00; }
  .groupLabel.pending { color: #856404; }
  .groupLabel.rejected { color: #721c24; }

  .mySignupItem {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #e3dacb;
    border-radius: 8px;
    margin-bottom: 6px;
    gap: 12px;
  }
  .mySignupItem.confirmed { border-left: 3px solid #1e7e34; }
  .mySignupItem.waitlisted { border-left: 3px solid #b36b00; }
  .mySignupItem.pending { border-left: 3px solid #856404; }
  .mySignupItem.rejected { border-left: 3px solid #721c24; }

  .mySignupInfo {
    flex: 1;
    min-width: 0;
  }
  .mySignupInfo strong {
    display: block;
    font-size: 14px;
    color: #2a2822;
  }
  .mySignupInfo span {
    display: block;
    font-size: 12px;
    color: #6b6459;
    margin-top: 2px;
  }

  .mySignupActions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .small-cancel-btn {
    font-size: 12px;
    padding: 4px 10px;
  }

  .cancelConfirmSection {
    padding: 16px;
    background: #fff5f5;
    border: 1px solid #f5c6cb;
    border-radius: 10px;
    margin-bottom: 16px;
  }
  .cancelConfirmSection h3 {
    margin: 0 0 8px;
    font-size: 16px;
    color: #721c24;
  }
  .cancelHint {
    margin: 0 0 12px;
    font-size: 13px;
    color: #6b6459;
  }
  .cancelActions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .cancelList {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }
  .cancelItem {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #e3dacb;
    border-radius: 8px;
    cursor: pointer;
  }
  .cancelItem input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #7b6b4e;
  }
  .cancelItemInfo {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cancelItemInfo strong {
    font-size: 14px;
    color: #2a2822;
  }
  .cancelFooter {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
  .danger-btn {
    border: 0;
    border-radius: 8px;
    padding: 10px 16px;
    background: #c0392b;
    color: #fff;
    cursor: pointer;
    font: inherit;
  }
  .danger-btn:disabled { opacity: .55; cursor: not-allowed; }

  .batchResultsSection {
    padding: 16px;
    background: #f0f7ff;
    border: 1px solid #90caf9;
    border-radius: 10px;
    margin-bottom: 16px;
  }
  .batchResultsSection h3 {
    margin: 0 0 12px;
    font-size: 16px;
    color: #1565c0;
  }
  .batchResultItem {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #e3dacb;
    border-radius: 8px;
    margin-bottom: 6px;
    gap: 12px;
  }
  .batchResultItem.regular { border-left: 3px solid #1e7e34; }
  .batchResultItem.waitlist { border-left: 3px solid #b36b00; }
  .batchResultItem.pending { border-left: 3px solid #856404; }
  .batchResultItem.rejected { border-left: 3px solid #721c24; }
  .resultInfo { flex: 1; }
  .resultInfo strong { display: block; font-size: 14px; color: #2a2822; }
  .resultInfo span { display: block; font-size: 12px; color: #6b6459; margin-top: 2px; }

  .signupFormSection {
    padding: 16px;
    background: #faf8f2;
    border: 1px solid #e3dacb;
    border-radius: 10px;
    margin-bottom: 16px;
  }
  .signupFormSection h3 {
    margin: 0 0 12px;
    font-size: 16px;
    color: #4b4435;
  }
  .signupFormSection form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .signupFormSection input, .signupFormSection textarea {
    width: 100%;
    border: 1px solid #d7ccba;
    border-radius: 8px;
    padding: 11px 12px;
    background: #fff;
    color: #2a2822;
    font: inherit;
  }
  .signupFormSection textarea { min-height: 80px; resize: vertical; }

  .readerMatchNotice {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    background: #e6f4ea;
    border: 1px solid #b7dfbf;
    border-radius: 8px;
    color: #1e7e34;
    font-size: 13px;
  }
  .readerMatchNotice .readerNote {
    color: #2d6a3b;
    font-size: 12px;
  }

  .selectedEventsList {
    background: #fff;
    border: 1px solid #e8ddc8;
    border-radius: 8px;
    padding: 12px;
  }
  .selectedEventsList h4 {
    margin: 0 0 10px;
    font-size: 13px;
    color: #4b4435;
  }
  .selectedEventPreview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: #faf7f0;
    border-radius: 6px;
    margin-bottom: 4px;
    font-size: 13px;
  }
  .selectedEventPreview strong { color: #2a2822; }
  .eventMetaSmall { color: #6b6459; font-size: 11px; }
  .reviewTag {
    font-size: 11px;
    color: #856404;
    background: #fff3cd;
    padding: 2px 6px;
    border-radius: 6px;
  }
  .waitlistTag {
    font-size: 11px;
    color: #b36b00;
    background: #fff3e0;
    padding: 2px 6px;
    border-radius: 6px;
  }
  .seatsTag {
    font-size: 11px;
    color: #1e7e34;
    background: #e6f4ea;
    padding: 2px 6px;
    border-radius: 6px;
  }

  .formActions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
  .formActions button {
    border: 0;
    border-radius: 8px;
    padding: 11px 16px;
    cursor: pointer;
    font: inherit;
  }
  .formActions button:disabled { opacity: .55; cursor: not-allowed; }
  .primary-btn {
    background: #4b4435;
    color: #fff;
  }

  .seriesSignupPanel { margin-top: 8px; }

  .selectionBar {
    margin-bottom: 16px;
    padding: 12px 14px;
    background: #f0ebe0;
    border: 1px solid #d7cbb3;
    border-radius: 8px;
  }
  .selectionBar h3 {
    margin: 0 0 8px;
    font-size: 15px;
    color: #4b4435;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .selectionActions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .small-btn { font-size: 12px; padding: 4px 10px; }
  .selectionCount {
    font-size: 13px;
    color: #7b6b4e;
    font-weight: 600;
  }

  .seriesEventsPanel {
    margin-top: 8px;
  }
  .seriesEventsPanel h3 { margin: 0 0 14px; font-size: 16px; color: #4b4435; }
  .seriesEventsList { display: flex; flex-direction: column; gap: 12px; }

  .seriesEventItem-large {
    display: flex;
    flex-direction: row;
    gap: 12px;
    padding: 16px 18px;
    background: #fffaf2;
    border: 1px solid #e3dacb;
    border-radius: 10px;
    text-align: left;
    color: inherit;
    transition: all 0.2s;
  }
  .seriesEventItem-large.seriesEventItem-selected {
    border-color: #7b6b4e;
    background: #efe7d8;
  }
  .seriesEventItem-large.seriesEventItem-mine {
    border-color: #1565c0;
    background: #f0f7ff;
  }

  .eventCheckbox {
    display: flex;
    align-items: flex-start;
    padding-top: 4px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .eventCheckbox :global(svg) { width: 20px; height: 20px; }
  .eventCheckbox :global(.checkbox-checked) { color: #7b6b4e; }
  .eventCheckbox :global(.checkbox-unchecked) { color: #b0a896; }
  .eventCheckbox-mine :global(svg) { color: #1565c0; }
  .eventCheckbox-closed :global(svg) { color: #ccc; }

  .seriesEventContent {
    flex: 1;
    min-width: 0;
    cursor: pointer;
  }

  .seriesEventHeader {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
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
  .reviewRequiredTag {
    display: inline-block;
    font-size: 11px;
    color: #856404;
    margin-top: 4px;
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
    margin: 8px 0 0;
    padding: 10px 12px;
    background: #fff;
    border: 1px dashed #e3dacb;
    border-radius: 6px;
    font-size: 13px;
    color: #5a5245;
    line-height: 1.6;
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
  .status-badge.promoted { background: #e3f2fd; color: #1565c0; }
  .status-badge.mine { background: #e3f2fd; color: #1565c0; }

  .batchSubmitBar {
    margin-top: 16px;
    padding: 14px 16px;
    background: #faf7f0;
    border: 1px solid #e8ddc8;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: all 0.2s;
  }
  .batchSubmitBar-active {
    background: #efe7d8;
    border-color: #7b6b4e;
  }
  .batchSubmitBar button {
    border: 0;
    border-radius: 8px;
    padding: 10px 18px;
    background: #4b4435;
    color: #fff;
    cursor: pointer;
    font: inherit;
    font-weight: 600;
    font-size: 14px;
  }
  .batchSubmitBar button:disabled { opacity: .55; cursor: not-allowed; }
  .batchHint {
    font-size: 12px;
    color: #999;
  }

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

  .ghost { background: #eee8dc; color: #312d25; border: 1px solid #d7ccba; border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit; }
  .ghost:disabled { opacity: .55; cursor: not-allowed; }

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

  .sync-conflict-banner {
    background: #fff3cd;
    border: 1px solid #ffc107;
    color: #856404;
    padding: 12px 18px;
    border-radius: 8px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 14px;
    font-weight: 500;
    flex-wrap: wrap;
    max-width: 780px;
    margin-left: auto;
    margin-right: auto;
  }
  .sync-conflict-text { flex-shrink: 1; min-width: 0; }
  .sync-conflict-actions { display: flex; gap: 8px; flex-shrink: 0; }
  .sync-refresh-btn {
    background: #856404;
    color: #fff;
    padding: 6px 14px;
    font-size: 13px;
    border-radius: 6px;
    border: 0;
    cursor: pointer;
  }
  .sync-dismiss-btn {
    background: transparent;
    border: 1px solid #856404;
    color: #856404;
    padding: 6px 14px;
    font-size: 13px;
    border-radius: 6px;
    cursor: pointer;
  }

  @media (max-width: 640px) {
    .publicPage { padding: 16px; }
    .seriesEventMain { flex-direction: column; }
    .eventSeatsColumn {
      align-items: start;
      width: 100%;
      padding: 10px;
      background: #fff;
      border-radius: 6px;
      border: 1px solid #e8ddc8;
    }
    .seatsMain { text-align: left; }
    .seatsSubInfo { align-items: start; }
    .seriesOverviewBar { grid-template-columns: 1fr; }
    .seriesHeroBanner { padding: 14px; }
    .eventPanel { padding: 18px; }
    .mySignupItem { flex-direction: column; align-items: flex-start; }
    .mySignupActions { width: 100%; justify-content: flex-end; }
    .selectionActions { gap: 6px; }
    .batchSubmitBar { flex-direction: column; align-items: stretch; }
  }
</style>
