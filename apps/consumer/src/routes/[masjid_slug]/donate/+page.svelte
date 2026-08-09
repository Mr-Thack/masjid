<script lang="ts">
  import { page } from '$app/stores';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);

  let donationLinks = $derived.by(() => {
    const raw = masjid?.donation_links;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((l: { label?: string; url?: string }) => l.url);
      } catch { /* invalid JSON */ }
    }
    return [];
  });

  let hasLinks = $derived(donationLinks.length > 0);
</script>

<svelte:head>
  <title>Donate — {masjid?.name ?? 'Masjid'}</title>
</svelte:head>

<div class="space-y-6">
  <div class="relative overflow-hidden rounded-2xl">
    <div class="geometric-pattern absolute inset-0 rounded-2xl"></div>

    <div class="relative z-10 glass-card p-8 sm:p-12 text-center space-y-6">
      <div class="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style="background: rgba(255,255,255,0.05);">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" class="h-10 w-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </div>

      <div>
        <h1 class="text-2xl sm:text-3xl font-bold mb-2 font-heading">
          Support {masjid?.name ?? 'Our Masjid'}
        </h1>
        <p class="text-sm max-w-md mx-auto leading-relaxed" style="color: var(--color-text-muted);">
          Your generous contributions help maintain our masjid, support community programs,
          and serve those in need. Every donation, no matter the amount, makes a difference.
        </p>
      </div>

      {#if hasLinks}
        <div class="flex flex-col items-center gap-3">
          {#each donationLinks as link}
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white no-underline transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95 bg-accent shadow-lg w-full max-w-xs justify-center"
              style="text-shadow: 0 1px 2px rgba(0,0,0,0.2);"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {link.label || 'Donate'}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" class="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          {/each}
        </div>
      {:else}
        <div class="glass-card inline-flex items-center gap-3 px-6 py-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="h-5 w-5" style="color: var(--color-text-dim);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm" style="color: var(--color-text-muted);">Donation information coming soon</p>
        </div>
      {/if}
    </div>
  </div>

  <div class="glass-card p-6 space-y-4">
    <h2 class="text-lg font-semibold font-heading" style="color: var(--color-text);">Why Give?</h2>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="text-center p-4">
        <div class="text-2xl mb-2">🕌</div>
        <p class="text-sm font-medium" style="color: var(--color-text-muted);">Maintain the House of Allah</p>
        <p class="text-xs mt-1" style="color: var(--color-text-dim);">Keep our masjid clean, safe, and welcoming</p>
      </div>
      <div class="text-center p-4">
        <div class="text-2xl mb-2">📚</div>
        <p class="text-sm font-medium" style="color: var(--color-text-muted);">Support Education</p>
        <p class="text-xs mt-1" style="color: var(--color-text-dim);">Fund classes, lectures, and youth programs</p>
      </div>
      <div class="text-center p-4">
        <div class="text-2xl mb-2">🤝</div>
        <p class="text-sm font-medium" style="color: var(--color-text-muted);">Serve the Community</p>
        <p class="text-xs mt-1" style="color: var(--color-text-dim);">Help those in need through outreach programs</p>
      </div>
    </div>
  </div>
</div>