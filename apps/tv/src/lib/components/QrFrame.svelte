<script lang="ts">
  /**
   * Donate QR frame (docs/design-language.md §7.5): scan-to-give slide,
   * separate from the text appeal (DonateFrame). Rendered as an inline SVG
   * (no canvas dependency, works on old smart-TV browsers).
   */
  import QRCode from 'qrcode';

  let { url }: { url: string } = $props();

  let qrSvg = $state('');

  // QR colors come from the active theme tokens (agent checklist §11:
  // colors only via CSS custom properties). applyTheme sets them on
  // <html>; fallbacks mirror the Mishkaat preset defaults.
  function tokenColor(name: string, fallback: string): string {
    if (typeof getComputedStyle === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  $effect(() => {
    let cancelled = false;
    QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      width: 180,
      color: {
        dark: tokenColor('--color-bg', '#17100a'),
        light: tokenColor('--color-text', '#f3e9d2'),
      },
    })
      .then((svg) => {
        if (!cancelled) qrSvg = svg;
      })
      .catch(() => {
        if (!cancelled) qrSvg = '';
      });
    return () => {
      cancelled = true;
    };
  });
</script>

<div class="frame frame--donate-qr">
  <p class="frame-label">Scan to Give</p>
  {#if qrSvg}
    <div class="frame-donate-qr" data-testid="donate-qr">
      {@html qrSvg}
    </div>
  {/if}
</div>
