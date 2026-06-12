<script>
  import { page } from '$app/stores';
  import PublicEventPage from '$lib/components/PublicEventPage.svelte';

  $: eventId = $page.params.eventId;
</script>

<svelte:head>
  <title>读书会报名</title>
</svelte:head>

{#if eventId}
  <PublicEventPage {eventId} />
{/if}
