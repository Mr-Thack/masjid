<script lang="ts">
  /**
   * Engraved line-art rendering of the masjid photo
   * (docs/consumer-homepage-overhaul.md Workstream G).
   *
   * When `engravedSvg` is set (pre-computed by the admin), the raw SVG is
   * rendered directly — no client-side tracing, no canvas, no CORS concerns.
   * When it's empty, the component falls back to a CSS-filter etched treatment
   * on the `<img>`.
   *
   * Usage (in Workstream B's +page.svelte):
   *   {#if opts.emblem === 'engraved' && opts.photoUrl}
   *     <EngravedEmblem photoUrl={opts.photoUrl} engravedSvg={opts.engravedSvg} />
   *   {:else}
   *     <img src={opts.photoUrl} ... />
   *   {/if}
   */
  let {
    photoUrl,
    engravedSvg = '',
  }: {
    photoUrl: string;
    engravedSvg?: string;
  } = $props();
</script>

{#if engravedSvg}
  <div class="engraved-emblem">
    {@html engravedSvg}
  </div>
{:else}
  <div class="engraved-emblem">
    <img
      src={photoUrl}
      alt=""
      class="engraved-fallback"
      onerror={(e) => {
        const el = e.target as HTMLImageElement;
        el.style.display = 'none';
      }}
    />
  </div>
{/if}

<style>
  .engraved-emblem {
    width: 100%;
    overflow: hidden;
  }
  .engraved-emblem :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }
  .engraved-fallback {
    display: block;
    width: 100%;
    height: auto;
    filter: grayscale(100%) contrast(150%) brightness(90%);
  }
</style>