<script lang="ts">
  let {
    url,
    accentColor = '#10b981',
  }: {
    url: string | null;
    accentColor?: string;
  } = $props();
</script>

{#if url}
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white no-underline transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95"
    style="background: {accentColor}; text-shadow: 0 1px 2px rgba(0,0,0,0.2);"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
    Support This Masjid
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  </a>
{/if}