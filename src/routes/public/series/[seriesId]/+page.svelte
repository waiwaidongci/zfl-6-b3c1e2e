<script>
  import { page } from '$app/stores';
  import PublicSeriesPage from '$lib/components/PublicSeriesPage.svelte';

  $: seriesId = $page.params.seriesId;
</script>

<svelte:head>
  <title>读书会系列活动</title>
</svelte:head>

{#if seriesId}
  <PublicSeriesPage {seriesId} />
{/if}
