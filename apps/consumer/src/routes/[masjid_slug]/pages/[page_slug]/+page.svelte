<script lang="ts">
  import type { PageData } from './$types';
  import { page } from '$app/stores';

  let { data }: { data: PageData } = $props();

  let masjidName = $derived($page.data.masjid?.name ?? 'Masjid');
  let pageData = $derived(data.page);
</script>

<svelte:head>
  <title>{pageData?.title ?? 'Page'} — {masjidName}</title>
</svelte:head>

<div class="max-w-3xl mx-auto space-y-6">
  <article>
    <h1 class="text-2xl sm:text-3xl font-bold mb-2 font-heading" style="color: var(--color-text);">
      {pageData?.title ?? 'Page'}
    </h1>

    {#if pageData?.compiled_html}
      <div class="c-markdown" style="color: var(--color-text);">
        {@html pageData.compiled_html}
      </div>
    {:else}
      <p style="color: var(--color-text-muted);">This page has no content yet.</p>
    {/if}

    {#if pageData?.last_updated}
      <p class="text-sm mt-8 pt-4" style="color: var(--color-text-dim); border-top: 1px solid var(--color-border);">
        Last updated: {new Date(pageData.last_updated).toLocaleDateString()}
      </p>
    {/if}
  </article>
</div>