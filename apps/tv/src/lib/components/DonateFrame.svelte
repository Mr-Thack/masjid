<script lang="ts">
  /**
   * Donate appeal frame (docs/design-language.md §7.5): the text ask.
   * The QR code is a separate slide (QrFrame) — together they were
   * visually too much for one frame.
   *
   * The appeal wording is admin-customizable via the `donateAppeal`
   * style option; the resolved default arrives as a prop.
   */
  let { url, appeal }: { url: string; appeal: string } = $props();

  let displayUrl = $derived(url.replace(/^https?:\/\//, ''));
</script>

<div class="frame frame--donate">
  <p class="frame-label">Support Your Masjid</p>
  <p class="frame-donate-tagline">{appeal}</p>
  <p class="frame-donate-url">{displayUrl}</p>
</div>
