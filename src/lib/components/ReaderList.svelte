<script>
  import { Search, ChevronRight, UserCog, Calendar, Clock, Award, X } from 'lucide-svelte';

  export let readerStats = [];
  export let searchKeyword = '';
  export let sortBy = 'lastActive';
  export let onSearch;
  export let onSort;
  export let onSelectReader;

  const sortOptions = [
    { value: 'lastActive', label: '最近活跃' },
    { value: 'totalEvents', label: '参与活动最多' },
    { value: 'checkedIn', label: '签到最多' },
    { value: 'attendanceRate', label: '出勤率最高' },
    { value: 'missed', label: '爽约最多' }
  ];

  function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.replace('T', ' ');
  }
</script>

<section class="readerListContainer">
  <div class="panel readerHeader">
    <div class="readerHeaderTop">
      <h2><UserCog size={18} />会员读者档案 ({readerStats.length})</h2>
      <div class="readerFilters">
        <div class="searchBox">
          <Search size={16} />
          <input
            type="text"
            placeholder="搜索姓名、电话、备注..."
            value={searchKeyword}
            on:input={(e) => onSearch(e.target.value)}
          />
          {#if searchKeyword}
            <button class="clearSearch" on:click={() => onSearch('')}>
              <X size={14} />
            </button>
          {/if}
        </div>
        <select bind:value={sortBy} on:change={(e) => onSort(e.target.value)}>
          {#each sortOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  {#if readerStats.length === 0}
    <div class="panel emptyReaders">
      <p class="empty">
        {searchKeyword ? '没有找到匹配的读者' : '暂无读者档案，用户报名时会自动创建'}
      </p>
    </div>
  {:else}
    <div class="panel readerList">
      {#each readerStats as item}
        <button type="button" class="readerCard" on:click={() => onSelectReader(item.reader.id)}>
          <div class="readerMainInfo">
            <div class="readerAvatar">
              {item.reader.name ? item.reader.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div class="readerInfo">
              <strong>{item.reader.name || '未命名读者'}</strong>
              <span class="readerPhone">{item.reader.phone || '无电话'}</span>
              {#if item.reader.note}
                <p class="readerNote">{item.reader.note}</p>
              {/if}
            </div>
          </div>
          <div class="readerStatsRow">
            <div class="statItem">
              <Calendar size={14} />
              <span>{item.stats.totalEvents} 次活动</span>
            </div>
            <div class="statItem">
              <Award size={14} />
              <span>{item.stats.attendanceRate}% 出勤</span>
            </div>
            <div class="statItem">
              <Clock size={14} />
              <span class:active={item.stats.missed > 0}>
                {item.stats.missed} 次爽约
              </span>
            </div>
          </div>
          {#if item.stats.history.length > 0}
            <div class="readerLastActive">
              最近活动：{item.stats.history[0].eventName} ·
              {formatTime(item.stats.history[0].eventTime || item.stats.history[0].signup.createdAt)}
            </div>
          {/if}
          <ChevronRight size={18} class="chevron" />
        </button>
      {/each}
    </div>
  {/if}
</section>

<style>
  .readerListContainer {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .readerHeader {
    margin-bottom: 4px;
  }

  .readerHeaderTop {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .readerHeaderTop h2 {
    margin: 0;
  }

  .readerFilters {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .searchBox {
    position: relative;
    display: flex;
    align-items: center;
  }

  .searchBox :global(svg) {
    position: absolute;
    left: 10px;
    color: #999;
    pointer-events: none;
  }

  .searchBox input {
    padding-left: 36px;
    padding-right: 36px;
    width: 280px;
  }

  .clearSearch {
    position: absolute;
    right: 6px;
    background: transparent;
    border: none;
    color: #999;
    cursor: pointer;
    padding: 4px;
  }

  .clearSearch:hover {
    color: #666;
  }

  .readerFilters select {
    width: auto;
    min-width: 140px;
  }

  .emptyReaders {
    text-align: center;
    padding: 40px 20px;
  }

  .readerList {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .readerCard {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "main chevron"
      "stats chevron"
      "last chevron";
    gap: 10px;
    padding: 16px;
    background: #fffaf2;
    border: 1px solid #e3dacb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    text-align: left;
    font: inherit;
    color: inherit;
  }

  .readerCard:hover {
    border-color: #7b6b4e;
    background: #efe7d8;
  }

  .readerMainInfo {
    grid-area: main;
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .readerAvatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #7b6b4e, #a8906c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .readerInfo {
    flex: 1;
    min-width: 0;
  }

  .readerInfo strong {
    display: block;
    font-size: 16px;
    color: #2a2822;
    margin-bottom: 2px;
  }

  .readerPhone {
    display: block;
    font-size: 13px;
    color: #6b6459;
    margin-bottom: 4px;
  }

  .readerNote {
    margin: 0;
    font-size: 13px;
    color: #8a7f6a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 400px;
  }

  .readerStatsRow {
    grid-area: stats;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .statItem {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #6b6459;
  }

  .statItem :global(svg) {
    color: #8a7f6a;
  }

  .statItem span.active {
    color: #a33;
    font-weight: 500;
  }

  .readerLastActive {
    grid-area: last;
    font-size: 12px;
    color: #999;
  }

  :global(.chevron) {
    grid-area: chevron;
    color: #8a7f6a;
    align-self: center;
  }
</style>
