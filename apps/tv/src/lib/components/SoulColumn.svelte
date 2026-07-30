<script lang="ts">
  /**
   * Soul column frame host (docs/design-language.md §7.5).
   *
   * Exactly one visible frame at a time; 20s cadence; gentle rightward
   * slide (enter from left, exit right, §7.1); nothing else on the screen
   * animates. With `prefers-reduced-motion` there is no rotation — the
   * single highest-priority non-empty frame renders statically.
   */
  import { fly } from 'svelte/transition';
  import type { Frame } from '$lib/frames';
  import { getActiveFrameIndex, FRAME_TRANSITION_MS } from '$lib/frames';
  import type { HadithEntry } from '@masjid/ui-utils';
  import HadithFrame from './HadithFrame.svelte';
  import JumuahFrame from './JumuahFrame.svelte';
  import AnnouncementFrame from './AnnouncementFrame.svelte';
  import ChangesFrame from './ChangesFrame.svelte';
  import DonateFrame from './DonateFrame.svelte';
  import QrFrame from './QrFrame.svelte';

  interface JumuahSessionView {
    id: string;
    label: string;
    time: string;
    khateeb: string | null;
    speech_time: string | null;
  }

  let {
    frames,
    reducedMotion = false,
    hadith,
    jumuahSessions,
    jumuahLabel,
    speechLabel,
    announcements,
    changes,
    donationUrl,
    appeal,
  }: {
    frames: Frame[];
    reducedMotion?: boolean;
    hadith: HadithEntry;
    jumuahSessions: JumuahSessionView[];
    jumuahLabel: string;
    speechLabel: string;
    announcements: Array<{ title: string; html: string | null }>;
    changes: Array<{ date: string; label: string; from: string; to: string }>;
    donationUrl: string | null;
    appeal: string;
  } = $props();

  // Rotation is driven by wall-clock elapsed time, not by a frame-index
  // interval: the `frames` prop is recomputed upstream (new array identity
  // every second), so an effect watching it would reset its own timer each
  // tick. This effect reads only `reducedMotion`, so it never re-runs.
  let elapsedMs = $state(0);

  $effect(() => {
    if (reducedMotion) {
      elapsedMs = 0;
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => (elapsedMs = Date.now() - start), 1000);
    return () => clearInterval(interval);
  });

  let activeIndex = $derived(getActiveFrameIndex(frames.length, elapsedMs));
  let active = $derived(activeIndex >= 0 ? frames[activeIndex]! : null);
</script>

{#if active}
  <div class="soul-frames" data-testid="soul-frames">
    {#key `${active.kind}:${active.index ?? 0}`}
      <div
        class="soul-frame"
        data-frame-kind={active.kind}
        data-frame-index={active.index ?? 0}
        in:fly={{ x: reducedMotion ? 0 : -48, duration: reducedMotion ? 0 : FRAME_TRANSITION_MS }}
        out:fly={{ x: reducedMotion ? 0 : 48, duration: reducedMotion ? 0 : FRAME_TRANSITION_MS }}
      >
        {#if active.kind === 'jumuah'}
          <JumuahFrame sessions={jumuahSessions} label={jumuahLabel} {speechLabel} />
        {:else if active.kind === 'hadith'}
          <HadithFrame arabic={hadith.arabic} english={hadith.english} source={hadith.source} />
        {:else if active.kind === 'announcements'}
          {@const announcement = announcements[active.index ?? 0]}
          {#if announcement}
            <AnnouncementFrame title={announcement.title} html={announcement.html} />
          {/if}
        {:else if active.kind === 'changes'}
          <ChangesFrame {changes} />
        {:else if active.kind === 'donate' && donationUrl}
          <DonateFrame url={donationUrl} {appeal} />
        {:else if active.kind === 'donate-qr' && donationUrl}
          <QrFrame url={donationUrl} />
        {/if}
      </div>
    {/key}
  </div>
{/if}
