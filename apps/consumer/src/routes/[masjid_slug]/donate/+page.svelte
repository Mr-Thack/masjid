<script lang="ts">
  import { page } from '$app/stores';
  import DonateButton from '$lib/components/DonateButton.svelte';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);
  let theme = $derived(data.theme);
</script>

<div class="space-y-6">
  <div class="relative overflow-hidden rounded-2xl">
    <div class="geometric-pattern absolute inset-0 rounded-2xl"></div>

    <div class="relative z-10 glass-card p-8 sm:p-12 text-center space-y-6">
      <div class="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style="background: rgba(255,255,255,0.05);">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-10 w-10"
          style="color: var(--color-accent);"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </div>

      <div>
        <h1
          class="text-2xl sm:text-3xl font-bold mb-2"
          style="font-family: var(--font-heading);"
        >
          Support {masjid?.name ?? 'Our Masjid'}
        </h1>
        <p class="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
          Your generous contributions help maintain our masjid, support community programs,
          and serve those in need. Every donation, no matter the amount, makes a difference.
        </p>
      </div>

      {#if masjid?.external_donation_url}
        <div>
          <DonateButton
            url={masjid.external_donation_url}
            accentColor={theme?.accent_color ?? '#10b981'}
          />
        </div>
      {:else}
        <div class="glass-card inline-flex items-center gap-3 px-6 py-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm text-gray-400">Donation information coming soon</p>
        </div>
      {/if}
    </div>
  </div>

  <div class="glass-card p-6 space-y-4">
    <h2
      class="text-lg font-semibold text-gray-200"
      style="font-family: var(--font-heading);"
    >
      Why Give?
    </h2>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="text-center p-4">
        <div class="text-2xl mb-2">🕌</div>
        <p class="text-sm font-medium text-gray-300">Maintain the House of Allah</p>
        <p class="text-xs text-gray-500 mt-1">Keep our masjid clean, safe, and welcoming</p>
      </div>
      <div class="text-center p-4">
        <div class="text-2xl mb-2">📚</div>
        <p class="text-sm font-medium text-gray-300">Support Education</p>
        <p class="text-xs text-gray-500 mt-1">Fund classes, lectures, and youth programs</p>
      </div>
      <div class="text-center p-4">
        <div class="text-2xl mb-2">🤝</div>
        <p class="text-sm font-medium text-gray-300">Serve the Community</p>
        <p class="text-xs text-gray-500 mt-1">Help those in need through outreach programs</p>
      </div>
    </div>
  </div>
</div>