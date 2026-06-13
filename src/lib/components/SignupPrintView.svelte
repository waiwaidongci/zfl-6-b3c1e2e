<script>
  import { getGroupedSignups, getRegularCheckedInCount } from '$lib/utils/signupUtils.js';
  import { isCheckedIn as isCheckedInStatus, isWaitlist as isWaitlistStatus } from '$lib/utils/signupStatusMachine.js';
  import { ArrowLeft, Printer } from 'lucide-svelte';

  export let event;
  export let signups;
  export let onBack;

  $: grouped = getGroupedSignups(signups);
  $: checkedInCount = getRegularCheckedInCount(signups);
  $: totalRegular = grouped.regular.length;

  function handlePrint() {
    window.print();
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.replace('T', ' ');
  }
</script>

<div class="printView">
  <div class="printToolbar no-print">
    <button class="backBtn" on:click={onBack}>
      <ArrowLeft size={18} />
      返回管理页
    </button>
    <button class="printBtn" on:click={handlePrint}>
      <Printer size={18} />
      打印名单
    </button>
  </div>

  <div class="printContent">
    <header class="printHeader">
      <h1>到场名单</h1>
      <div class="eventInfo">
        <h2>{event.book}</h2>
        {#if event.author}
          <p class="author">作者：{event.author}</p>
        {/if}
        <p>主讲人：{event.host}</p>
        <p>时间：{formatTime(event.time)}</p>
        <p class="summary">
          正式报名：{totalRegular} 人 ·
          已签到：{checkedInCount} 人 ·
          候补：{grouped.waitlist.length} 人
          {#if event.reviewRequired}
            · 待审核：{grouped.pending.length} 人
          {/if}
        </p>
      </div>
    </header>

    {#if grouped.regular.length > 0}
      <section class="signupGroup">
        <h3>正式报名 ({grouped.regular.length})</h3>
        <table class="signupTable">
          <thead>
            <tr>
              <th style="width: 8%;">序号</th>
              <th style="width: 18%;">姓名</th>
              <th style="width: 22%;">联系方式</th>
              <th style="width: 35%;">回答</th>
              <th style="width: 17%;">签到状态</th>
            </tr>
          </thead>
          <tbody>
            {#each grouped.regular as item, idx}
              <tr class:checked={isCheckedInStatus(item.status)}>
                <td>{idx + 1}</td>
                <td class="name">{item.name}</td>
                <td>{item.phone}</td>
                <td class="answer">{item.answer || '-'}</td>
                <td class="checkinStatus">
                  {#if isCheckedInStatus(item.status)}
                    <span class="statusBadge checked">已到场</span>
                    {#if item.checkedInAt}
                      <span class="checkinTime">{item.checkedInAt}</span>
                    {/if}
                  {:else}
                    <span class="statusBadge unchecked">未到场</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    {#if grouped.waitlist.length > 0}
      <section class="signupGroup">
        <h3>候补名单 ({grouped.waitlist.length})</h3>
        <table class="signupTable">
          <thead>
            <tr>
              <th style="width: 8%;">序号</th>
              <th style="width: 18%;">姓名</th>
              <th style="width: 22%;">联系方式</th>
              <th style="width: 35%;">回答</th>
              <th style="width: 17%;">签到状态</th>
            </tr>
          </thead>
          <tbody>
            {#each grouped.waitlist as item, idx}
              <tr class:checked={isCheckedInStatus(item.status)}>
                <td>{idx + 1}</td>
                <td class="name">{item.name}</td>
                <td>{item.phone}</td>
                <td class="answer">{item.answer || '-'}</td>
                <td class="checkinStatus">
                  <div class="waitlistPositionTag">候补 #{item.waitlistPosition}</div>
                  {#if isCheckedInStatus(item.status)}
                    <span class="statusBadge checked">已到场</span>
                    {#if item.checkedInAt}
                      <span class="checkinTime">{item.checkedInAt}</span>
                    {/if}
                  {:else}
                    <span class="statusBadge unchecked">未到场</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    {#if event.reviewRequired && grouped.pending.length > 0}
      <section class="signupGroup">
        <h3>待审核 ({grouped.pending.length})</h3>
        <table class="signupTable">
          <thead>
            <tr>
              <th style="width: 8%;">序号</th>
              <th style="width: 18%;">姓名</th>
              <th style="width: 22%;">联系方式</th>
              <th style="width: 35%;">回答</th>
              <th style="width: 17%;">签到状态</th>
            </tr>
          </thead>
          <tbody>
            {#each grouped.pending as item, idx}
              <tr class:checked={isCheckedInStatus(item.status)}>
                <td>{idx + 1}</td>
                <td class="name">{item.name}</td>
                <td>{item.phone}</td>
                <td class="answer">{item.answer || '-'}</td>
                <td class="checkinStatus">
                  <div class="pendingTime">报名：{item.createdAt}</div>
                  {#if isCheckedInStatus(item.status)}
                    <span class="statusBadge checked">已到场</span>
                    {#if item.checkedInAt}
                      <span class="checkinTime">{item.checkedInAt}</span>
                    {/if}
                  {:else}
                    <span class="statusBadge unchecked">未到场</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    {#if signups.length === 0}
      <p class="emptyPrint">暂无报名记录</p>
    {/if}

    <footer class="printFooter">
      <p>打印时间：{new Date().toLocaleString()}</p>
    </footer>
  </div>
</div>

<style>
  .printView {
    background: #fff;
    border-radius: 8px;
    border: 1px solid #ded7c9;
    overflow: hidden;
  }

  .printToolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    background: #f8f5ee;
    border-bottom: 1px solid #e1d8ca;
  }

  .backBtn, .printBtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 6px;
    border: 0;
    cursor: pointer;
    font-size: 14px;
  }

  .backBtn {
    background: #eee8dc;
    color: #312d25;
  }

  .printBtn {
    background: #4b4435;
    color: #fff;
  }

  .printContent {
    padding: 30px;
  }

  .printHeader {
    text-align: center;
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 2px solid #4b4435;
  }

  .printHeader h1 {
    margin: 0 0 12px;
    font-size: 28px;
    color: #2b2b25;
  }

  .eventInfo h2 {
    margin: 0 0 6px;
    font-size: 20px;
    color: #4b4435;
  }

  .eventInfo p {
    margin: 4px 0;
    color: #686258;
    font-size: 14px;
  }

  .author {
    font-size: 13px;
  }

  .summary {
    margin-top: 10px !important;
    font-weight: 600;
    color: #4b4435 !important;
  }

  .signupGroup {
    margin-bottom: 24px;
  }

  .signupGroup h3 {
    margin: 0 0 10px;
    font-size: 16px;
    color: #4b4435;
    padding: 8px 12px;
    background: #f8f5ee;
    border-left: 4px solid #7b6b4e;
    border-radius: 0 4px 4px 0;
  }

  .signupTable {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .signupTable th,
  .signupTable td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid #e3dacb;
    vertical-align: top;
  }

  .signupTable th {
    background: #f8f5ee;
    font-weight: 600;
    color: #4b4435;
    border-bottom: 2px solid #d7ccba;
  }

  .signupTable tr.checked {
    background: #f6faf7;
  }

  .name {
    font-weight: 600;
    color: #2a2822;
  }

  .answer {
    color: #6b6459;
    font-size: 13px;
    line-height: 1.5;
  }

  .checkinStatus {
    text-align: center;
  }

  .statusBadge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
  }

  .statusBadge.checked {
    background: #e6f4ea;
    color: #1e7e34;
  }

  .statusBadge.unchecked {
    background: #fce4e4;
    color: #a33;
  }

  .checkinTime {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    color: #999;
  }

  .pendingTime {
    font-size: 12px;
    color: #999;
    margin-bottom: 6px;
    line-height: 1.4;
  }

  .waitlistPositionTag {
    display: inline-block;
    padding: 2px 8px;
    margin-bottom: 6px;
    background: #fff3e0;
    color: #b36b00;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
  }

  .emptyPrint {
    text-align: center;
    color: #999;
    padding: 60px 20px;
  }

  .printFooter {
    margin-top: 30px;
    padding-top: 16px;
    border-top: 1px dashed #d7ccba;
    text-align: right;
    color: #999;
    font-size: 12px;
  }

  @media print {
    .no-print {
      display: none !important;
    }

    .printView {
      border: 0;
      border-radius: 0;
    }

    .printContent {
      padding: 0;
    }

    .signupTable {
      page-break-inside: auto;
    }

    .signupTable tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }

    .signupGroup {
      page-break-inside: avoid;
    }
  }
</style>
