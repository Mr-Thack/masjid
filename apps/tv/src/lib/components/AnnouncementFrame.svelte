<script lang="ts">
  /**
   * Announcement frame (docs/design-language.md §7.5): one announcement at
   * a time. Community-variable content flows through the announcements
   * system — the masjid controls everything shown here (§4).
   */
  let {
    title,
    html,
  }: {
    title: string;
    html: string | null;
  } = $props();
</script>

<div class="frame frame--announcement">
  <p class="frame-label">Announcement</p>
  <p class="frame-announcement-title">{title}</p>
  {#if html}
    <div class="frame-announcement-body">
      {@html html}
    </div>
  {/if}
</div>
