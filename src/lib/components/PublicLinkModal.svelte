<script>
  import { createEventDispatcher } from 'svelte';
  import { Share2, X, Copy, CheckCircle2, ExternalLink, Layers, Bookmark } from 'lucide-svelte';
  import {
    buildFullPublicUrl,
    buildFullPublicSeriesUrl,
    copyToClipboard,
    getSeriesPublicEventLinks
  } from '$lib/utils/eventLinkUtils.js';

  const dispatch = createEventDispatcher();

  export let show = false;
  export let type = 'single';
  export let eventId = '';
  export let seriesId = '';
  export let events = [];
  export let series = [];
  export let getSeriesOfEvent = () => null;
  export let getEventIndexInSeries = () => 0;

  let copiedLinkId = '';

  function close() {
    copiedLinkId = '';
    dispatch('close');
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      close();
    }
  }

  async function handleCopyLink(text, id) {
    try {
      await copyToClipboard(text);
      copiedLinkId = id;
      setTimeout(() => { copiedLinkId = ''; }, 2000);
    } catch (e) {
      alert('复制失败，请手动复制');
    }
  }

  function previewPublicPage(url) {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }
</script>

{#if show}
  <div class="modalOverlay" role="dialog" aria-modal="true" aria-label="活动公开报名链接" tabindex="0" on:click={handleOverlayClick} on:keydown={(e) => { if (e.key === 'Escape') close(); }}>
    <div class="modalContent" role="document">
      <div class="modalHeader">
        <h2><Share2 size={18} />活动公开报名链接</h2>
        <button class="modalClose" on:click={close}><X size={18} /></button>
      </div>
      <div class="modalBody">
        {#if type === 'single'}
          {@const targetEvent = events.find((e) => e.id === eventId)}
          {#if targetEvent}
            {@const singleUrl = buildFullPublicUrl(targetEvent.id)}
            {@const targetSeries = getSeriesOfEvent(targetEvent.id)}
            <div class="linkCard">
              <div class="linkCardHead">
                <strong>{targetEvent.book}</strong>
                {#if targetSeries}
                  <span class="seriesTag">📚 {targetSeries.title} · 第{getEventIndexInSeries(targetEvent.id)}期</span>
                {/if}
                <span>{targetEvent.host} · {targetEvent.time.replace('T', ' ')}</span>
                <span class="status-badge {targetEvent.status === '开放报名' ? 'regular' : 'waitlist'}">{targetEvent.status}</span>
              </div>
              <div class="linkRow">
                <input readonly value={singleUrl} />
                <button class="ghost copyBtn" on:click={() => handleCopyLink(singleUrl, 'single')}>
                  {#if copiedLinkId === 'single'}
                    <CheckCircle2 size={16} /> 已复制
                  {:else}
                    <Copy size={16} /> 复制
                  {/if}
                </button>
                <button class="ghost previewBtn" on:click={() => previewPublicPage(singleUrl)}>
                  <ExternalLink size={16} /> 预览
                </button>
              </div>
            </div>
          {/if}
        {:else if type === 'series'}
          {@const targetSeries = series.find((s) => s.id === seriesId)}
          {@const seriesLinks = targetSeries ? getSeriesPublicEventLinks(events, targetSeries.id) : []}
          {#if targetSeries}
            {@const seriesPageUrl = buildFullPublicSeriesUrl(targetSeries.id)}
            <div class="linkCard">
              <div class="linkCardHead">
                <Layers size={16} />
                <strong>{targetSeries.title}</strong>
                <span>共 {seriesLinks.length} 期</span>
                {#if targetSeries.description}
                  <p class="seriesLinkDesc">{targetSeries.description}</p>
                {/if}
              </div>
              <div class="seriesPageLinkSection">
                <div class="seriesPageLinkLabel">
                  <Bookmark size={14} /> 系列总览页（推荐分享）
                </div>
                <div class="linkRow">
                  <input readonly value={seriesPageUrl} />
                  <button class="ghost copyBtn" on:click={() => handleCopyLink(seriesPageUrl, `series-${targetSeries.id}`)}>
                    {#if copiedLinkId === `series-${targetSeries.id}`}
                      <CheckCircle2 size={16} /> 已复制
                    {:else}
                      <Copy size={16} /> 复制
                    {/if}
                  </button>
                  <button class="ghost previewBtn" on:click={() => previewPublicPage(seriesPageUrl)}>
                    <ExternalLink size={16} /> 预览
                  </button>
                </div>
              </div>
            </div>
            <div class="seriesSectionDivider">
              <span>单场报名链接</span>
            </div>
            {#if seriesLinks.length === 0}
              <p class="empty empty-small">该系列下暂无活动</p>
            {:else}
              {#each seriesLinks as linkItem, idx}
                {@const ev = events.find((e) => e.id === linkItem.eventId)}
                <div class="linkCard linkCard-series">
                  <div class="linkCardHead">
                    <span class="episodeBadge small">第{idx + 1}期</span>
                    <strong>{linkItem.book}</strong>
                    <span>{ev?.host} · {linkItem.time.replace('T', ' ')}</span>
                    {#if ev}
                      <span class="status-badge {ev.status === '开放报名' ? 'regular' : 'waitlist'}">{ev.status}</span>
                    {/if}
                  </div>
                  <div class="linkRow">
                    <input readonly value={buildFullPublicUrl(linkItem.eventId)} />
                    <button class="ghost copyBtn" on:click={() => handleCopyLink(buildFullPublicUrl(linkItem.eventId), linkItem.eventId)}>
                      {#if copiedLinkId === linkItem.eventId}
                        <CheckCircle2 size={16} /> 已复制
                      {:else}
                        <Copy size={16} /> 复制
                      {/if}
                    </button>
                    <button class="ghost previewBtn" on:click={() => previewPublicPage(buildFullPublicUrl(linkItem.eventId))}>
                      <ExternalLink size={16} /> 预览
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          {/if}
        {/if}
      </div>
      <div class="modalFooter">
        <button on:click={close}>关闭</button>
      </div>
    </div>
  </div>
{/if}

<style>
.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(43, 43, 37, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modalContent {
  background: #fff;
  border-radius: 10px;
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modalHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid #e1d8ca;
  background: #f8f5ee;
  border-radius: 10px 10px 0 0;
}

.modalHeader h2 {
  margin: 0;
  font-size: 17px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.modalClose {
  padding: 6px 10px;
  background: transparent;
  border: 0;
  color: #686258;
  cursor: pointer;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
}

.modalClose:hover {
  background: #eee8dc;
  color: #2a2822;
}

.modalBody {
  padding: 20px 22px;
}

.modalFooter {
  padding: 14px 22px;
  border-top: 1px solid #e1d8ca;
  background: #faf7f0;
  border-radius: 0 0 10px 10px;
}

.modalFooter button {
  width: 100%;
}

.linkCard {
  background: #fffaf2;
  border: 1px solid #e3dacb;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 12px;
}

.linkCard-series {
  background: #fff;
}

.linkCard:last-child {
  margin-bottom: 0;
}

.linkCardHead {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.linkCardHead strong {
  font-size: 15px;
  color: #2a2822;
}

.linkCardHead span {
  font-size: 13px;
  color: #6b6459;
}

.linkCardHead .seriesTag {
  display: inline-block;
  font-size: 11px;
  color: #7b6b4e;
  background: #efe7d8;
  padding: 2px 8px;
  border-radius: 8px;
  width: fit-content;
}

.seriesLinkDesc {
  font-size: 13px;
  color: #4a4439;
  margin: 4px 0 0;
  line-height: 1.5;
}

.linkRow {
  display: flex;
  gap: 8px;
}

.linkRow input {
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  padding: 10px 12px;
  background: #fff;
}

.copyBtn, .previewBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 13px;
  flex-shrink: 0;
}

.seriesPageLinkSection {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e3dacb;
}

.seriesPageLinkLabel {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #7b6b4e;
  background: #efe7d8;
  padding: 3px 10px;
  border-radius: 10px;
  margin-bottom: 10px;
}

.seriesSectionDivider {
  display: flex;
  align-items: center;
  margin: 16px 0 12px;
  text-align: center;
}

.seriesSectionDivider::before,
.seriesSectionDivider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e3dacb;
}

.seriesSectionDivider span {
  padding: 0 14px;
  font-size: 12px;
  color: #8a7f6a;
  font-weight: 500;
  background: #fff;
}

.episodeBadge {
  display: inline-block;
  font-size: 11px;
  color: #fff;
  background: #7b6b4e;
  padding: 2px 8px;
  border-radius: 8px;
  margin-bottom: 4px;
}

.episodeBadge.small {
  font-size: 10px;
  padding: 1px 6px;
}

.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.status-badge.regular {
  background: #e6f4ea;
  color: #1e7e34;
}

.status-badge.waitlist {
  background: #fff3e0;
  color: #b36b00;
}

.empty {
  text-align: center;
  color: #999;
  padding: 40px 20px;
}

.empty-small {
  padding: 20px 10px;
  font-size: 13px;
}

.ghost {
  background: #eee8dc;
  color: #312d25;
}

button {
  border: 0;
  border-radius: 8px;
  padding: 11px 13px;
  background: #4b4435;
  color: #fff;
  cursor: pointer;
}

input {
  width: 100%;
  border: 1px solid #d7ccba;
  border-radius: 8px;
  padding: 11px 12px;
  background: #fff;
  color: #2a2822;
}

.seriesTag {
  display: inline-block;
  font-size: 11px;
  color: #7b6b4e;
  background: #efe7d8;
  padding: 2px 6px;
  border-radius: 8px;
  margin: 2px 0;
}
</style>
