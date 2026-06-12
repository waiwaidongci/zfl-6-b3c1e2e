<script>
  import { BarChart3, AlertTriangle, Filter, TrendingUp, Users, UserCheck, Clock, ArrowRight, Layers, Calendar, PieChart, ListOrdered, ChevronDown, ChevronUp } from 'lucide-svelte';
  import { getEventStats, getAggregateStats, filterEvents, getAnomalies, getSeriesStats, getTimeTrend, getSignupGroupsSummary, getEventsByStatusBucket, buildOpsDashboardData } from '$lib/utils/opsStats.js';

  let {
    events = [],
    signups = [],
    series = [],
    onNavigateToEvent = (eventId, navigateTarget) => {}
  } = $props();

  let filterDateFrom = $state('');
  let filterDateTo = $state('');
  let filterSeriesId = $state('');
  let filterStatus = $state('');
  let granularity = $state('month');

  let expandedSections = $state({
    overview: true,
    groups: true,
    anomalies: true,
    series: false,
    trend: false,
    detail: true
  });

  function toggleSection(key) {
    expandedSections[key] = !expandedSections[key];
  }

  let dashboard = $derived(
    buildOpsDashboardData(events, signups, series, {
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
      seriesId: filterSeriesId || undefined,
      status: filterStatus || undefined,
      granularity
    })
  );

  let { filteredEvents, eventStats, aggregate, seriesStats, timeTrend, anomalies, groupsSummary, statusBucket } = $derived(dashboard);

  function resetFilters() {
    filterDateFrom = '';
    filterDateTo = '';
    filterSeriesId = '';
    filterStatus = '';
  }

  function handleAnomalyClick(anomaly) {
    onNavigateToEvent(anomaly.eventId, anomaly.navigateTarget);
  }

  function handleEventRowClick(eventId) {
    onNavigateToEvent(eventId, { type: 'regular', eventId });
  }

  function pctClass(rate) {
    if (rate >= 80) return 'rate-good';
    if (rate >= 50) return 'rate-warn';
    return 'rate-bad';
  }

  function severityClass(severity) {
    if (severity === 'high') return 'anomaly-high';
    if (severity === 'medium') return 'anomaly-medium';
    return 'anomaly-low';
  }

  function trendBarWidth(value, max) {
    if (max === 0) return '0%';
    return `${Math.max(4, (value / max) * 100)}%`;
  }

  let maxTrendSignups = $derived(
    timeTrend.length > 0 ? Math.max(...timeTrend.map((t) => t.totalSignups), 1) : 1
  );
</script>

<div class="opsDashboard">
  <div class="opsHeader">
    <h2><BarChart3 size={20} />读书会运营工作台</h2>
    <div class="opsHeaderSub">
      <span>共 <strong>{filteredEvents.length}</strong> 场活动 · <strong>{groupsSummary.total}</strong> 条报名</span>
    </div>
  </div>

  <div class="opsFilters">
    <div class="filterRow">
      <div class="filterGroup">
        <label for="ops-date-from">起始日期</label>
        <input id="ops-date-from" type="date" bind:value={filterDateFrom} />
      </div>
      <div class="filterGroup">
        <label for="ops-date-to">截止日期</label>
        <input id="ops-date-to" type="date" bind:value={filterDateTo} />
      </div>
      <div class="filterGroup">
        <label for="ops-series">系列</label>
        <select id="ops-series" bind:value={filterSeriesId}>
          <option value="">全部</option>
          {#each series as s}
            <option value={s.id}>{s.title}</option>
          {/each}
        </select>
      </div>
      <div class="filterGroup">
        <label for="ops-status">活动状态</label>
        <select id="ops-status" bind:value={filterStatus}>
          <option value="">全部</option>
          <option value="开放报名">开放报名</option>
          <option value="已关闭">已关闭</option>
        </select>
      </div>
      <div class="filterGroup filterAction">
        <button class="ghost" on:click={resetFilters}>重置筛选</button>
      </div>
    </div>
  </div>

  <button class="sectionToggle" on:click={() => toggleSection('overview')}>
    <span><PieChart size={16} /> 核心运营指标</span>
    {#if expandedSections.overview}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}
  </button>

  {#if expandedSections.overview}
    <div class="opsMetrics">
      <article class="metricCard">
        <TrendingUp size={20} />
        <strong class={pctClass(aggregate.avgConversionRate)}>{aggregate.avgConversionRate}%</strong>
        <span>平均报名转化率</span>
        <small>（审核通过/总报名）</small>
      </article>
      <article class="metricCard">
        <Users size={20} />
        <strong class={pctClass(aggregate.avgFullnessRate)}>{aggregate.avgFullnessRate}%</strong>
        <span>平均满员率</span>
        <small>（正式名额/活动上限）</small>
      </article>
      <article class="metricCard">
        <Clock size={20} />
        <strong class={pctClass(aggregate.avgWaitlistPromotionRate)}>{aggregate.avgWaitlistPromotionRate}%</strong>
        <span>候补转正率</span>
        <small>（已转正/曾候补）</small>
      </article>
      <article class="metricCard highlight-pending">
        <AlertTriangle size={20} />
        <strong class={aggregate.totalPendingBacklog > 0 ? 'rate-bad' : ''}>{aggregate.totalPendingBacklog}</strong>
        <span>审核积压</span>
        <small>（待审核总数）</small>
      </article>
      <article class="metricCard">
        <UserCheck size={20} />
        <strong class={pctClass(aggregate.avgCheckinRate)}>{aggregate.avgCheckinRate}%</strong>
        <span>平均签到率</span>
        <small>（已签到/正式报名）</small>
      </article>
      <article class="metricCard">
        <Layers size={20} />
        <strong>{aggregate.fullEvents}</strong>
        <span>满员活动</span>
        <small>（满员率≥100%）</small>
      </article>
    </div>

    <div class="opsSummaryRow">
      <div class="summaryCard">
        <Calendar size={18} />
        <div>
          <span>活动状态分布</span>
          <strong>
            <span class="text-green">{statusBucket.open}</span> 开放 /
            <span class="text-gray"> {statusBucket.closed}</span> 关闭
          </strong>
        </div>
      </div>
      <div class="summaryCard">
        <ListOrdered size={18} />
        <div>
          <span>异常关注</span>
          <strong>
            <span class="text-red">{aggregate.lowCheckinEvents}</span> 低签到 /
            <span class="text-orange"> {aggregate.lowFullnessEvents}</span> 未满员 /
            <span class="text-red"> {aggregate.highRejectionEvents}</span> 高拒绝
          </strong>
        </div>
      </div>
    </div>
  {/if}

  <button class="sectionToggle" on:click={() => toggleSection('groups')}>
    <span><Users size={16} /> 报名分组概览</span>
    {#if expandedSections.groups}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}
  </button>

  {#if expandedSections.groups}
    <div class="opsGroups">
      <div class="groupItem" class:active={groupsSummary.pending > 0}>
        <div class="groupLabel">待审核</div>
        <div class="groupValue">{groupsSummary.pending}</div>
        <div class="groupBar">
          <div class="groupBarFill pending" style:width={groupsSummary.total ? `${(groupsSummary.pending / groupsSummary.total) * 100}%` : '0%'}></div>
        </div>
      </div>
      <div class="groupItem">
        <div class="groupLabel">审核通过</div>
        <div class="groupValue">{groupsSummary.approved}</div>
        <div class="groupBar">
          <div class="groupBarFill approved" style:width={groupsSummary.total ? `${(groupsSummary.approved / groupsSummary.total) * 100}%` : '0%'}></div>
        </div>
      </div>
      <div class="groupItem">
        <div class="groupLabel">已拒绝</div>
        <div class="groupValue">{groupsSummary.rejected}</div>
        <div class="groupBar">
          <div class="groupBarFill rejected" style:width={groupsSummary.total ? `${(groupsSummary.rejected / groupsSummary.total) * 100}%` : '0%'}></div>
        </div>
      </div>
      <div class="groupItem">
        <div class="groupLabel">正式名额</div>
        <div class="groupValue">{groupsSummary.regular}</div>
        <div class="groupBar">
          <div class="groupBarFill regular" style:width={groupsSummary.approved ? `${(groupsSummary.regular / groupsSummary.approved) * 100}%` : '0%'}></div>
        </div>
      </div>
      <div class="groupItem">
        <div class="groupLabel">候补名单</div>
        <div class="groupValue">{groupsSummary.waitlist}</div>
        <div class="groupBar">
          <div class="groupBarFill waitlist" style:width={groupsSummary.approved ? `${(groupsSummary.waitlist / groupsSummary.approved) * 100}%` : '0%'}></div>
        </div>
      </div>
      <div class="groupItem">
        <div class="groupLabel">已签到</div>
        <div class="groupValue">{groupsSummary.checkedIn}</div>
        <div class="groupBar">
          <div class="groupBarFill checkin" style:width={groupsSummary.regular ? `${(groupsSummary.checkedIn / groupsSummary.regular) * 100}%` : '0%'}></div>
        </div>
      </div>
      <div class="groupItem">
        <div class="groupLabel">候补转正</div>
        <div class="groupValue">{groupsSummary.promoted}</div>
        <div class="groupBar">
          <div class="groupBarFill promoted" style:width={Math.max(groupsSummary.waitlist + groupsSummary.promoted, 1) ? `${(groupsSummary.promoted / Math.max(groupsSummary.waitlist + groupsSummary.promoted, 1)) * 100}%` : '0%'}></div>
        </div>
      </div>
    </div>
  {/if}

  {#if anomalies.length > 0}
    <button class="sectionToggle" on:click={() => toggleSection('anomalies')}>
      <span><AlertTriangle size={16} /> 异常指标预警 ({anomalies.length})</span>
      {#if expandedSections.anomalies}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}
    </button>

    {#if expandedSections.anomalies}
      <div class="opsAnomalies">
        <div class="anomalyList">
          {#each anomalies.slice(0, 12) as anomaly}
            <button class="anomalyItem {severityClass(anomaly.severity)}" on:click={() => handleAnomalyClick(anomaly)} title="点击跳转至对应活动">
              <span class="anomalyType">{anomaly.type}</span>
              <strong class="anomalyBook">{anomaly.book}</strong>
              <span class="anomalyDetail">{anomaly.detail}</span>
              <ArrowRight size={14} class="anomalyArrow" />
            </button>
          {/each}
          {#if anomalies.length > 12}
            <p class="anomalyMore">... 还有 {anomalies.length - 12} 条异常，请在活动明细中查看</p>
          {/if}
        </div>
      </div>
    {/if}
  {/if}

  <button class="sectionToggle" on:click={() => toggleSection('series')}>
    <span><Layers size={16} /> 系列统计对比 ({seriesStats.length})</span>
    {#if expandedSections.series}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}
  </button>

  {#if expandedSections.series && seriesStats.length > 0}
    <div class="opsSeries">
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>系列</th>
              <th>场数</th>
              <th>总报名</th>
              <th>平均转化率</th>
              <th>平均满员率</th>
              <th>平均签到率</th>
              <th>候补转正</th>
              <th>满员场</th>
              <th>低签到</th>
            </tr>
          </thead>
          <tbody>
            {#each seriesStats as ss}
              <tr>
                <td><strong>{ss.seriesName}</strong></td>
                <td>{ss.eventCount}</td>
                <td>{ss.totalSignups}</td>
                <td class={pctClass(ss.avgConversionRate)}>{ss.avgConversionRate}%</td>
                <td class={pctClass(ss.avgFullnessRate)}>{ss.avgFullnessRate}%</td>
                <td class={pctClass(ss.avgCheckinRate)}>{ss.avgCheckinRate}%</td>
                <td class={pctClass(ss.avgWaitlistPromotionRate)}>{ss.avgWaitlistPromotionRate || 0}%</td>
                <td>{ss.fullEvents}</td>
                <td>{ss.lowCheckinEvents}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <div class="sectionToggle trendSectionHeader">
    <button class="sectionToggleBtn" on:click={() => toggleSection('trend')}>
      <span><TrendingUp size={16} /> 时间趋势</span>
      {#if expandedSections.trend}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}
    </button>
    <span class="trendGranularity">
      <button class="ghost tiny" class:active={granularity === 'week'} on:click={(e) => { e.stopPropagation(); granularity = 'week'; }}>周</button>
      <button class="ghost tiny" class:active={granularity === 'month'} on:click={(e) => { e.stopPropagation(); granularity = 'month'; }}>月</button>
    </span>
  </div>

  {#if expandedSections.trend && timeTrend.length > 0}
    <div class="opsTrend">
      <div class="trendChart">
        {#each timeTrend as t}
          <div class="trendRow">
            <div class="trendLabel">{t.period}</div>
            <div class="trendBars">
              <div class="trendBarWrap">
                <div class="trendBar trendBar-signups" style:width={trendBarWidth(t.totalSignups, maxTrendSignups)} title="报名数: {t.totalSignups}"></div>
                <span class="trendValue">{t.totalSignups}</span>
              </div>
              <div class="trendMetrics">
                <span class="trendMetric {pctClass(t.avgConversionRate)}">转{t.avgConversionRate}%</span>
                <span class="trendMetric {pctClass(t.avgFullnessRate)}">满{t.avgFullnessRate}%</span>
                <span class="trendMetric {pctClass(t.avgCheckinRate)}">签{t.avgCheckinRate}%</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <button class="sectionToggle" on:click={() => toggleSection('detail')}>
    <span><Filter size={16} /> 活动明细 ({filteredEvents.length})</span>
    {#if expandedSections.detail}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}
  </button>

  {#if expandedSections.detail}
    <div class="opsTable">
      {#if eventStats.length === 0}
        <p class="empty">暂无匹配的活动数据</p>
      {:else}
        <div class="tableWrap">
          <table>
            <thead>
              <tr>
                <th>活动</th>
                <th>系列</th>
                <th>状态</th>
                <th>报名/上限</th>
                <th>转化率</th>
                <th>满员率</th>
                <th>候补</th>
                <th>转正率</th>
                <th>待审</th>
                <th>签到率</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each eventStats as stat}
                <tr>
                  <td class="cellBook">
                    <strong>{stat.book}</strong>
                    <span>{stat.host} · {stat.time.replace('T', ' ')}</span>
                  </td>
                  <td>{stat.seriesName || '-'}</td>
                  <td>
                    <span class="status-badge {stat.status === '开放报名' ? 'regular' : 'waitlist'}">{stat.status}</span>
                  </td>
                  <td>{stat.regularCount}/{stat.limit}</td>
                  <td class={pctClass(stat.signupConversionRate)}>{stat.signupConversionRate}%</td>
                  <td class={pctClass(stat.fullnessRate)}>{stat.fullnessRate}%</td>
                  <td>{stat.waitlistCount || '-'}</td>
                  <td class={pctClass(stat.waitlistPromotionRate)}>{stat.waitlistPromotionRate || (stat.waitlistCount + stat.promotedCount > 0 ? '0%' : '-')}</td>
                  <td>{stat.pendingCount || '-'}</td>
                  <td class={pctClass(stat.checkinRate)}>{stat.regularCount > 0 ? `${stat.checkinRate}%` : '-'}</td>
                  <td>
                    <button class="ghost navBtn" on:click={() => handleEventRowClick(stat.eventId)} title="跳转至活动管理">
                      <ArrowRight size={14} />
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .opsDashboard { display: flex; flex-direction: column; gap: 12px; }
  .opsHeader { display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: 8px; }
  .opsHeader h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 20px; color: #4b4435; }
  .opsHeaderSub { font-size: 13px; color: #6b6459; }
  .opsHeaderSub strong { color: #4b4435; font-size: 15px; }

  .sectionToggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #f8f5ee;
    border: 1px solid #e1d8ca;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #4b4435;
    cursor: pointer;
    text-align: left;
  }
  button.sectionToggle:hover { background: #efe7d8; }
  .sectionToggle > span:first-child { display: inline-flex; align-items: center; gap: 8px; }

  .trendSectionHeader { cursor: default; }
  .sectionToggleBtn {
    display: inline-flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 0;
    background: transparent;
    border: 0;
    border-radius: 0;
    font-size: 14px;
    font-weight: 600;
    color: #4b4435;
    cursor: pointer;
    text-align: left;
    flex: 1;
  }
  .sectionToggleBtn:hover { background: transparent; color: #2a2822; }
  .trendSectionHeader .trendGranularity { display: inline-flex; gap: 4px; margin: 0 8px; }
  .trendGranularity { display: inline-flex; gap: 4px; margin: 0 8px; }
  .ghost.tiny { padding: 2px 8px; font-size: 11px; border-radius: 6px; }
  .ghost.tiny.active { background: #4b4435; color: #fff; }

  .opsFilters { background: #fff; border: 1px solid #ded7c9; border-radius: 8px; padding: 14px; box-shadow: 0 10px 28px rgb(49 43 31 / .07); }
  .filterRow { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
  .filterGroup { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 140px; }
  .filterGroup label { font-size: 12px; color: #6b6459; font-weight: 500; }
  .filterGroup input, .filterGroup select { width: 100%; }
  .filterAction { flex: 0; min-width: auto; }
  .filterAction .ghost { height: 40px; }

  .opsMetrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .metricCard { background: #fff; border: 1px solid #ded7c9; border-radius: 8px; padding: 16px; box-shadow: 0 10px 28px rgb(49 43 31 / .07); display: flex; flex-direction: column; gap: 2px; align-items: center; text-align: center; }
  .metricCard :global(svg) { color: #7b6b4e; margin-bottom: 4px; }
  .metricCard strong { font-size: 28px; color: #4b4435; }
  .metricCard span { font-size: 13px; color: #6b6459; font-weight: 500; }
  .metricCard small { font-size: 11px; color: #999; margin-top: 2px; }
  .metricCard.highlight-pending { border-color: #ffe082; background: #fffbf0; }
  .metricCard.highlight-pending :global(svg) { color: #856404; }

  .opsSummaryRow { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .summaryCard { background: #fff8ee; border: 1px solid #e8ddc8; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
  .summaryCard :global(svg) { color: #7b6b4e; flex-shrink: 0; }
  .summaryCard > div { display: flex; flex-direction: column; gap: 2px; }
  .summaryCard span { font-size: 12px; color: #6b6459; }
  .summaryCard strong { font-size: 14px; color: #4b4435; }
  .text-green { color: #1e7e34; }
  .text-orange { color: #b36b00; }
  .text-red { color: #a33; }
  .text-gray { color: #6b6459; }

  .opsGroups { background: #fff; border: 1px solid #ded7c9; border-radius: 8px; padding: 16px; box-shadow: 0 10px 28px rgb(49 43 31 / .07); display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .groupItem { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; gap: 4px 12px; padding: 10px 12px; border-radius: 6px; background: #faf7f0; border: 1px solid #f0e6d2; }
  .groupItem.active { background: #fffbf0; border-color: #ffe082; }
  .groupLabel { font-size: 12px; color: #6b6459; font-weight: 500; }
  .groupValue { font-size: 22px; font-weight: 700; color: #4b4435; text-align: right; grid-row: span 2; align-self: center; }
  .groupBar { grid-column: 1 / -1; height: 6px; background: #eee8dc; border-radius: 3px; overflow: hidden; }
  .groupBarFill { height: 100%; border-radius: 3px; transition: width .3s; }
  .groupBarFill.pending { background: #ffc107; }
  .groupBarFill.approved { background: #4caf50; }
  .groupBarFill.rejected { background: #f44336; }
  .groupBarFill.regular { background: #2196f3; }
  .groupBarFill.waitlist { background: #ff9800; }
  .groupBarFill.checkin { background: #8bc34a; }
  .groupBarFill.promoted { background: #9c27b0; }

  .opsAnomalies { background: #fff; border: 1px solid #ded7c9; border-radius: 8px; padding: 16px; box-shadow: 0 10px 28px rgb(49 43 31 / .07); }
  .anomalyList { display: flex; flex-direction: column; gap: 6px; }
  .anomalyItem { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 6px; border: 1px solid transparent; text-align: left; cursor: pointer; background: #fffaf2; font-size: 13px; width: 100%; transition: transform .15s; }
  .anomalyItem:hover { background: #fff3e0; transform: translateX(2px); }
  .anomaly-high { border-color: #f5c6cb; background: #fff5f5; }
  .anomaly-high:hover { background: #fce4e4; }
  .anomaly-medium { border-color: #ffe082; background: #fffbf0; }
  .anomaly-medium:hover { background: #fff3e0; }
  .anomaly-low { border-color: #e1d8ca; background: #f8f5ee; }
  .anomaly-low:hover { background: #efe7d8; }
  .anomalyType { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; background: #efe7d8; color: #7b6b4e; white-space: nowrap; }
  .anomaly-high .anomalyType { background: #f8d7da; color: #721c24; }
  .anomaly-medium .anomalyType { background: #fff3cd; color: #856404; }
  .anomalyBook { flex: 1; font-size: 14px; color: #2a2822; }
  .anomalyDetail { color: #6b6459; white-space: nowrap; }
  .anomalyArrow { color: #7b6b4e; flex-shrink: 0; }
  .anomalyMore { text-align: center; color: #999; font-size: 13px; margin: 8px 0 0; }

  .opsSeries, .opsTable { background: #fff; border: 1px solid #ded7c9; border-radius: 8px; padding: 16px; box-shadow: 0 10px 28px rgb(49 43 31 / .07); }

  .opsTrend { background: #fff; border: 1px solid #ded7c9; border-radius: 8px; padding: 16px; box-shadow: 0 10px 28px rgb(49 43 31 / .07); }
  .trendChart { display: flex; flex-direction: column; gap: 8px; }
  .trendRow { display: grid; grid-template-columns: 90px 1fr; gap: 12px; align-items: center; }
  .trendLabel { font-size: 12px; color: #6b6459; font-weight: 500; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .trendBars { display: grid; grid-template-columns: 1fr 180px; gap: 10px; align-items: center; }
  .trendBarWrap { display: flex; align-items: center; gap: 8px; }
  .trendBar { height: 18px; border-radius: 4px; min-width: 4px; transition: width .3s; }
  .trendBar-signups { background: linear-gradient(90deg, #7b6b4e, #b39e7a); }
  .trendValue { font-size: 12px; color: #4b4435; font-weight: 600; min-width: 28px; }
  .trendMetrics { display: flex; gap: 6px; flex-wrap: wrap; }
  .trendMetric { font-size: 11px; padding: 2px 6px; border-radius: 8px; background: #f8f5ee; font-weight: 600; white-space: nowrap; }

  .tableWrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f8f5ee; color: #4b4435; font-weight: 600; font-size: 12px; text-align: left; padding: 8px 10px; border-bottom: 1px solid #e3dacb; white-space: nowrap; }
  td { padding: 8px 10px; border-bottom: 1px solid #f0e6d2; vertical-align: top; }
  tbody tr:hover { background: #fffaf2; }
  .cellBook strong { display: block; font-size: 13px; }
  .cellBook span { display: block; font-size: 11px; color: #6b6459; margin-top: 2px; }

  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; white-space: nowrap; }
  .status-badge.regular { background: #e6f4ea; color: #1e7e34; }
  .status-badge.waitlist { background: #fff3e0; color: #b36b00; }

  .rate-good { color: #1e7e34; font-weight: 600; }
  .rate-warn { color: #856404; font-weight: 600; }
  .rate-bad { color: #a33; font-weight: 600; }

  .navBtn { padding: 4px 8px; display: inline-flex; align-items: center; }

  .empty { text-align: center; color: #999; padding: 40px 20px; }
  .ghost { background: #eee8dc; color: #312d25; }

  @media (max-width: 900px) {
    .opsMetrics { grid-template-columns: repeat(2, 1fr); }
    .opsSummaryRow { grid-template-columns: 1fr; }
    .filterRow { flex-direction: column; }
    .filterGroup { min-width: 100%; }
    .trendBars { grid-template-columns: 1fr; }
    .trendRow { grid-template-columns: 80px 1fr; }
  }
</style>
