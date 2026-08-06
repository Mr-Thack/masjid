<script lang="ts">
  import type { PageData } from './$types';
  import { page } from '$app/stores';

  let { data }: { data: PageData } = $props();

  let masjid = $derived($page.data.masjid);

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
</script>

<svelte:head>
  <title>{data.post.title} — {masjid?.name ?? 'Masjid'}</title>
</svelte:head>

<div class="max-w-3xl mx-auto space-y-6">
  <a
    href="/{masjid?.slug ?? ''}/news"
    class="inline-flex items-center gap-1.5 text-sm font-medium no-underline transition-colors"
    style="color: var(--color-text-muted);"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
    Back to News
  </a>

  <article>
    <h1 class="text-2xl sm:text-3xl font-bold mb-2 font-heading" style="color: var(--color-text);">
      {data.post.title}
    </h1>
    <p class="text-sm mb-6" style="color: var(--color-text-dim);">
      {formatDate(data.post.created_at)}
    </p>
    {#if data.post.compiled_html}
      <div class="text-base leading-relaxed space-y-4" style="color: var(--color-text);">
        {@html data.post.compiled_html}
      </div>
    {:else}
      <p style="color: var(--color-text-muted);">This post has no content.</p>
    {/if}
  </article>
</div>