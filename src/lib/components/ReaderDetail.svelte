<script>
  import { ArrowLeft, Calendar, UserCheck, XCircle, Clock, Award, MessageSquare, Edit3, Check, X, Tag, Plus } from 'lucide-svelte';
  import { isPending, isRejected, isWaitlist, isCheckedIn, getSignupStatusDisplay } from '$lib/utils/signupStatusMachine.js';

  export let reader;
  export let stats;
  export let onBack;
  export let onUpdateNote;
  export let onAddTag;
  export let onRemoveTag;
  export let onEditStateChange = () => {};
  export let resetEditToken = 0;

  let editingNote = false;
  let noteDraft = '';
  let newTagInput = '';
  let lastResetEditToken = resetEditToken;

  $: onEditStateChange(editingNote || !!newTagInput.trim());
  $: if (resetEditToken !== lastResetEditToken) {
    lastResetEditToken = resetEditToken;
    editingNote = false;
    noteDraft = '';
    newTagInput = '';
  }

  function startEditNote() {
    noteDraft = reader.note || '';
    editingNote = true;
  }

  function saveNote() {
    onUpdateNote(noteDraft.trim());
    editingNote = false;
  }

  function cancelEditNote() {
    editingNote = false;
    noteDraft = '';
  }

  function handleAddTag() {
    const tag = newTagInput.trim();
    if (!tag) return;
    onAddTag(tag);
    newTagInput = '';
  }

  function handleTagKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.replace('T', ' ');
  }

  function getStatusBadge(signup) {
    if (isPending(signup.status)) {
      return { class: 'pending', text: '待审核' };
    }
    if (isRejected(signup.status)) {
      return { class: 'rejected', text: '已拒绝' };
    }
    if (isWaitlist(signup.status)) {
      return { class: 'waitlist', text: `候补 #${signup.waitlistPosition}` };
    }
    if (isCheckedIn(signup.status)) {
      return { class: 'checkedIn', text: '已签到' };
    }
    const display = getSignupStatusDisplay(signup);
    return { class: display.cssClass, text: display.label };
  }
</script>

<section class="readerDetail">
  <div class="panel detailHeader">
    <button class="ghost backBtn" on:click={onBack}>
      <ArrowLeft size={16} /> 返回列表
    </button>
  </div>

  <div class="panel readerProfile">
    <div class="profileTop">
      <div class="readerAvatar large">
        {reader.name ? reader.name.charAt(0).toUpperCase() : '?'}
      </div>
      <div class="profileInfo">
        <h2>{reader.name || '未命名读者'}</h2>
        <p class="phone">{reader.phone || '无联系方式'}</p>
        <p class="meta">
          首次报名：{formatTime(reader.createdAt)} ·
          最近更新：{formatTime(reader.updatedAt)}
        </p>
      </div>
    </div>

    <div class="tagsSection">
      <div class="tagsHeader">
        <h3><Tag size={16} /> 标签</h3>
      </div>
      <div class="tagsList">
        {#if reader.tags && reader.tags.length > 0}
          {#each reader.tags as tag}
            <span class="tagChip">
              {tag}
              <button class="tagRemove" on:click={() => onRemoveTag(tag)} title="删除标签">
                <X size={12} />
              </button>
            </span>
          {/each}
        {:else}
          <span class="emptyTags">暂无标签</span>
        {/if}
      </div>
      <div class="tagInputRow">
        <input
          type="text"
          bind:value={newTagInput}
          placeholder="输入新标签，按回车添加"
          on:keydown={handleTagKeydown}
        />
        <button class="ghost addTagBtn" on:click={handleAddTag} disabled={!newTagInput.trim()}>
          <Plus size={14} /> 添加
        </button>
      </div>
    </div>

    <div class="noteSection">
      <div class="noteHeader">
        <h3><MessageSquare size={16} /> 备注</h3>
        {#if !editingNote}
          <button class="ghost small" on:click={startEditNote}>
            <Edit3 size={14} /> 编辑
          </button>
        {/if}
      </div>
      {#if editingNote}
        <div class="noteEdit">
          <textarea bind:value={noteDraft} placeholder="输入读者备注..."></textarea>
          <div class="noteActions">
            <button on:click={saveNote}><Check size={14} /> 保存</button>
            <button class="ghost" on:click={cancelEditNote}><X size={14} /> 取消</button>
          </div>
        </div>
      {:else}
        <p class="noteContent">{reader.note || '暂无备注'}</p>
      {/if}
    </div>
  </div>

  <div class="statsGrid">
    <div class="panel statCard">
      <div class="statIcon"><Calendar size={20} /></div>
      <div class="statContent">
        <strong>{stats.totalEvents}</strong>
        <span>正式活动</span>
      </div>
    </div>
    <div class="panel statCard success">
      <div class="statIcon"><UserCheck size={20} /></div>
      <div class="statContent">
        <strong>{stats.checkedIn}</strong>
        <span>已签到</span>
      </div>
    </div>
    <div class="panel statCard danger">
      <div class="statIcon"><XCircle size={20} /></div>
      <div class="statContent">
        <strong>{stats.missed}</strong>
        <span>爽约</span>
      </div>
    </div>
    <div class="panel statCard">
      <div class="statIcon"><Award size={20} /></div>
      <div class="statContent">
        <strong>{stats.attendanceRate}%</strong>
        <span>出勤率</span>
      </div>
    </div>
    <div class="panel statCard warning">
      <div class="statIcon"><Clock size={20} /></div>
      <div class="statContent">
        <strong>{stats.promoted}</strong>
        <span>候补转正</span>
      </div>
    </div>
    <div class="panel statCard">
      <div class="statIcon"><MessageSquare size={20} /></div>
      <div class="statContent">
        <strong>{stats.totalSignups}</strong>
        <span>总报名</span>
      </div>
    </div>
  </div>

  {#if stats.latestAnswer}
    <div class="panel latestAnswer">
      <h3><MessageSquare size={16} /> 最近一次报名回答</h3>
      <p class="answerContent">{stats.latestAnswer}</p>
    </div>
  {/if}

  {#if stats.promotions.length > 0}
    <div class="panel promotionsSection">
      <h3><Clock size={16} /> 候补转正记录 ({stats.promotions.length})</h3>
      <div class="promotionsList">
        {#each stats.promotions as promo}
          <div class="promotionItem">
            <strong>{promo.eventName}</strong>
            <span>转正时间：{formatTime(promo.promotedAt)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="panel historySection">
    <h3><Calendar size={16} /> 活动记录 ({stats.history.length})</h3>
    {#if stats.history.length === 0}
      <p class="empty">暂无活动记录</p>
    {:else}
      <div class="historyList">
        {#each stats.history as item}
          <div class="historyItem">
            <div class="historyInfo">
              <strong>{item.eventName}</strong>
              <span class="eventMeta">
                {item.eventHost} · {formatTime(item.eventTime)}
              </span>
              {#if item.signup.answer}
                <p class="historyAnswer">"{item.signup.answer}"</p>
              {/if}
              {#if item.signup.rejectionReason}
                <p class="rejectionReason">拒绝原因：{item.signup.rejectionReason}</p>
              {/if}
              {#if item.review && item.review.updatedAt}
                <div class="reviewInfo">
                  <div class="reviewInfoHeader">
                    <span class="reviewLabel">活动复盘</span>
                    <span class="reviewTime">{formatTime(item.review.updatedAt)}</span>
                  </div>
                  {#if item.review.note}
                    <p class="reviewNote">复盘备注：{item.review.note}</p>
                  {/if}
                  <div class="reviewStats">
                    {#if item.review.onSiteCount !== null}
                      <span class="reviewStat">现场：{item.review.onSiteCount}</span>
                    {/if}
                    {#if item.review.walkInCount !== null}
                      <span class="reviewStat">临时到场：{item.review.walkInCount}</span>
                    {/if}
                    {#if (item.review.onSiteCount !== null || item.review.walkInCount !== null) && isCheckedIn(item.signup.status)}
                      <span class="reviewStat checked">您已签到</span>
                    {/if}
                  </div>
                  {#if item.review.absenceReasons && !isCheckedIn(item.signup.status)}
                    <p class="reviewAbsence">缺席原因记录：{item.review.absenceReasons}</p>
                  {/if}
                  {#if item.review.followUpReaders}
                    <p class="reviewFollowUp">下次跟进：{item.review.followUpReaders}</p>
                  {/if}
                  {#if item.review.recommendedBooks}
                    <p class="reviewBooks">推荐书目：{item.review.recommendedBooks}</p>
                  {/if}
                </div>
              {/if}
              <span class="signupTime">报名时间：{formatTime(item.signup.createdAt)}</span>
            </div>
            <span class="status-badge {getStatusBadge(item.signup).class}">
              {getStatusBadge(item.signup).text}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .readerDetail {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .detailHeader {
    padding: 12px 16px;
  }

  .backBtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .readerProfile {
    padding: 20px;
  }

  .profileTop {
    display: flex;
    gap: 20px;
    align-items: center;
    margin-bottom: 20px;
  }

  .readerAvatar.large {
    width: 72px;
    height: 72px;
    font-size: 28px;
  }

  .readerAvatar {
    border-radius: 50%;
    background: linear-gradient(135deg, #7b6b4e, #a8906c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    flex-shrink: 0;
  }

  .profileInfo h2 {
    margin: 0 0 4px;
    font-size: 22px;
    color: #2a2822;
  }

  .profileInfo .phone {
    margin: 0 0 6px;
    font-size: 14px;
    color: #6b6459;
  }

  .profileInfo .meta {
    margin: 0;
    font-size: 12px;
    color: #999;
  }

  .tagsSection {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid #e8ddc8;
  }

  .tagsHeader {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .tagsHeader h3 {
    margin: 0;
    font-size: 15px;
    color: #4b4435;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tagsList {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .tagChip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px 5px 12px;
    background: #efe7d8;
    border: 1px solid #d7ccba;
    border-radius: 16px;
    font-size: 13px;
    color: #4b4435;
  }

  .tagRemove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: #8a7f6a;
    transition: all 0.15s;
  }

  .tagRemove:hover {
    background: #d7ccba;
    color: #2a2822;
  }

  .emptyTags {
    color: #999;
    font-size: 13px;
  }

  .tagInputRow {
    display: flex;
    gap: 8px;
  }

  .tagInputRow input {
    flex: 1;
  }

  .addTagBtn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .noteSection {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid #e8ddc8;
  }

  .noteHeader {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .noteHeader h3 {
    margin: 0;
    font-size: 15px;
    color: #4b4435;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ghost.small {
    padding: 5px 10px;
    font-size: 12px;
  }

  .noteEdit textarea {
    margin-bottom: 10px;
    min-height: 80px;
  }

  .noteActions {
    display: flex;
    gap: 8px;
  }

  .noteActions button {
    flex: 1;
  }

  .noteContent {
    margin: 0;
    padding: 10px 12px;
    background: #f8f5ee;
    border-radius: 6px;
    color: #4a4439;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .statsGrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .statCard {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
  }

  .statIcon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: #efe7d8;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #7b6b4e;
  }

  .statCard.success .statIcon {
    background: #e6f4ea;
    color: #1e7e34;
  }

  .statCard.danger .statIcon {
    background: #fce4e4;
    color: #a33;
  }

  .statCard.warning .statIcon {
    background: #fff3e0;
    color: #b36b00;
  }

  .statContent strong {
    display: block;
    font-size: 22px;
    color: #2a2822;
  }

  .statContent span {
    font-size: 12px;
    color: #6b6459;
  }

  .latestAnswer h3 {
    margin: 0 0 10px;
    font-size: 15px;
    color: #4b4435;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .answerContent {
    margin: 0;
    padding: 12px 14px;
    background: #fff8ee;
    border: 1px solid #e8ddc8;
    border-radius: 6px;
    color: #4a4439;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .promotionsSection h3 {
    margin: 0 0 12px;
    font-size: 15px;
    color: #4b4435;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .promotionsList {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .promotionItem {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: #fff8ee;
    border: 1px solid #ffcc80;
    border-radius: 6px;
  }

  .promotionItem strong {
    font-size: 14px;
    color: #2a2822;
  }

  .promotionItem span {
    font-size: 12px;
    color: #b36b00;
  }

  .historySection h3 {
    margin: 0 0 12px;
    font-size: 15px;
    color: #4b4435;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .historyList {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .historyItem {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 12px;
    padding: 14px;
    background: #fffaf2;
    border: 1px solid #e3dacb;
    border-radius: 8px;
  }

  .historyInfo {
    flex: 1;
    min-width: 0;
  }

  .historyInfo strong {
    display: block;
    font-size: 15px;
    color: #2a2822;
    margin-bottom: 4px;
  }

  .eventMeta {
    display: block;
    font-size: 12px;
    color: #6b6459;
    margin-bottom: 6px;
  }

  .historyAnswer {
    margin: 6px 0;
    padding: 8px 10px;
    background: #fff;
    border-radius: 6px;
    font-size: 13px;
    color: #4a4439;
    line-height: 1.5;
  }

  .rejectionReason {
    margin: 6px 0;
    padding: 8px 10px;
    background: #f8d7da;
    border-radius: 6px;
    font-size: 13px;
    color: #721c24;
  }

  .signupTime {
    display: block;
    font-size: 11px;
    color: #999;
    margin-top: 4px;
  }

  .reviewInfo {
    margin-top: 10px;
    padding: 12px;
    background: #e3f0fd;
    border: 1px solid #b3d7f5;
    border-radius: 6px;
  }

  .reviewInfoHeader {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .reviewLabel {
    font-size: 12px;
    font-weight: 600;
    color: #0056b3;
  }

  .reviewTime {
    font-size: 11px;
    color: #666;
  }

  .reviewNote {
    margin: 6px 0;
    font-size: 13px;
    color: #2a2822;
    line-height: 1.5;
  }

  .reviewStats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 6px 0;
  }

  .reviewStat {
    display: inline-block;
    padding: 3px 8px;
    background: #fff;
    border-radius: 10px;
    font-size: 12px;
    color: #0056b3;
  }

  .reviewStat.checked {
    background: #e6f4ea;
    color: #1e7e34;
  }

  .reviewAbsence {
    margin: 6px 0;
    padding: 6px 10px;
    background: #fff3cd;
    border-radius: 4px;
    font-size: 13px;
    color: #856404;
  }

  .reviewFollowUp {
    margin: 6px 0;
    padding: 6px 10px;
    background: #fff;
    border-radius: 4px;
    font-size: 13px;
    color: #2a2822;
  }

  .reviewBooks {
    margin: 6px 0;
    padding: 6px 10px;
    background: #f8f5ee;
    border-radius: 4px;
    font-size: 13px;
    color: #7b6b4e;
  }

  @media (max-width: 640px) {
    .profileTop {
      flex-direction: column;
      align-items: start;
    }
    .statsGrid {
      grid-template-columns: repeat(2, 1fr);
    }
    .historyItem {
      flex-direction: column;
    }
  }
</style>
