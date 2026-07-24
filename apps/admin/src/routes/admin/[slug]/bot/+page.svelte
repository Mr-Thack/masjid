<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import BotChat from '$lib/components/BotChat.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let masjidId = $derived(auth.admin?.masjid_id ?? '');
</script>

<div class="h-[calc(100dvh-4rem)] flex flex-col">
  <div class="px-6 py-4 border-b border-border bg-surface/50 shrink-0">
    <h1 class="text-xl font-heading font-bold">AI Assistant</h1>
    <p class="text-text-muted text-xs mt-0.5">Configure your masjid via chat</p>
  </div>

  <div class="flex-1 overflow-hidden">
    <BotChat masjidId={masjidId} />
  </div>
</div>
