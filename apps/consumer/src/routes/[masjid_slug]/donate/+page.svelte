<script lang="ts">
  import { page } from '$app/stores';
  import QRCode from 'qrcode';
  import { parseStyleOptions, resolveStyleOptions } from '@masjid/ui-utils';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);
  let opts = $derived(resolveStyleOptions(parseStyleOptions(data.theme?.style_options as string | Record<string, unknown> | null | undefined)));

  function parseDonationLinks(raw: string | null | undefined): { label: string; url: string }[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((l: { label?: string; url?: string }) => l && l.url) : [];
    } catch {
      return [];
    }
  }

  let links = $derived(parseDonationLinks(masjid?.donation_links));
  let hasLinks = $derived(links.length > 0);
  let showDonateQr = $derived(masjid?.show_donate_qr ?? false);

  let shareOpen = $state(false);
  let qrSvg = $state('');
  let copied = $state(false);

  function tokenColor(name: string, fallback: string): string {
    if (typeof getComputedStyle === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function generateQr() {
    const url = window.location.href;
    QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      width: 200,
      color: {
        dark: tokenColor('--color-accent', '#10b981'),
        light: tokenColor('--color-bg', '#0f172a'),
      },
    })
      .then((svg) => { qrSvg = svg; })
      .catch(() => { qrSvg = ''; });
  }

  function toggleShare() {
    shareOpen = !shareOpen;
    if (shareOpen && !qrSvg) generateQr();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // clipboard not available, ignore
    }
  }
</script>

<svelte:head>
  <title>Donate — {masjid?.name ?? 'Masjid'}</title>
</svelte:head>

<div class="space-y-6">
  <div class="glass-card p-6 space-y-4">
    <h2 class="text-lg font-semibold font-heading" style="color: var(--color-text);">Why Give?</h2>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {#each opts.donateReasons as reason}
        <div class="text-center p-4">
          <div class="text-2xl mb-2">{reason.icon}</div>
          <p class="text-sm font-medium" style="color: var(--color-text-muted);">{reason.title}</p>
          <p class="text-xs mt-1" style="color: var(--color-text-dim);">{reason.desc}</p>
        </div>
      {/each}
    </div>
  </div>

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
          {#each links as link}
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

  {#if showDonateQr}
    <div class="glass-card p-6 text-center space-y-4">
      {#if !shareOpen}
        <button
          class="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white no-underline transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95 bg-accent shadow-lg"
          style="text-shadow: 0 1px 2px rgba(0,0,0,0.2);"
          onclick={toggleShare}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" class="h-4.5 w-4.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </button>
      {:else}
        <div class="space-y-4">
          <button
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
            style="color: var(--color-text-muted);"
            onclick={toggleShare}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </button>

          {#if qrSvg}
            <div class="flex justify-center">
              <div class="p-4 rounded-xl inline-block" style="background: rgba(255,255,255,0.05);">
                {@html qrSvg}
              </div>
            </div>
          {/if}

          <p class="text-sm" style="color: var(--color-text-muted);">Scan the QR code to open this page on another device</p>

          <button
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 hover:scale-105 active:scale-95"
            style="background: rgba(255,255,255,0.08); color: var(--color-text);"
            onclick={copyLink}
          >
            {#if copied}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Copy Link
            {/if}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>