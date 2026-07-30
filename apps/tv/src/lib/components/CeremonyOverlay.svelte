<script lang="ts">
  /**
   * Ceremony overlay (docs/design-language.md §7.6): full-screen behavioral
   * states triggered by prayer-time events, driven by server-synchronized
   * time. Rendered only when the ceremony state machine leaves 'normal'.
   */
  import { fade } from 'svelte/transition';
  import type { CeremonyStateKind, PrayerKey } from '$lib/ceremony';
  import { FRAME_TRANSITION_MS } from '$lib/frames';

  let {
    state,
    prayer,
    prayerLabel,
    countdownEndsAtSeconds,
    now,
    adhaanLabel,
    iqaamahLabel,
  }: {
    state: CeremonyStateKind;
    prayer: PrayerKey | null;
    prayerLabel: string;
    countdownEndsAtSeconds: number | null;
    now: Date;
    adhaanLabel: string;
    iqaamahLabel: string;
  } = $props();

  let nowSeconds = $derived(
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds(),
  );

  let countdownRemaining = $derived.by(() => {
    if (countdownEndsAtSeconds == null) return null;
    let remaining = countdownEndsAtSeconds - nowSeconds;
    if (remaining < 0) remaining += 86_400;
    return Math.max(0, remaining);
  });

  let countdownText = $derived.by(() => {
    if (countdownRemaining == null) return '';
    const minutes = Math.floor(countdownRemaining / 60);
    const seconds = countdownRemaining % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });
</script>

{#if state === 'adhaan'}
  <div class="ceremony-overlay ceremony-overlay--lit" transition:fade={{ duration: FRAME_TRANSITION_MS }} data-ceremony="adhaan">
    <p class="ceremony-prayer-name">{prayerLabel}</p>
    <p class="ceremony-state-line">{adhaanLabel} now</p>
  </div>
{:else if state === 'iqaamah-countdown'}
  <div class="ceremony-overlay ceremony-overlay--lit" transition:fade={{ duration: FRAME_TRANSITION_MS }} data-ceremony="iqaamah-countdown">
    <p class="ceremony-prayer-name">{prayerLabel}</p>
    <p class="ceremony-state-line">{iqaamahLabel} in</p>
    <p class="ceremony-countdown">{countdownText}</p>
  </div>
{:else if state === 'prayer-in-progress'}
  <div class="ceremony-overlay ceremony-overlay--dim" transition:fade={{ duration: FRAME_TRANSITION_MS }} data-ceremony="prayer-in-progress">
    <p class="ceremony-prayer-name ceremony-prayer-name--small">{prayerLabel}</p>
    <p class="ceremony-state-line">Prayer in progress</p>
  </div>
{:else if state === 'quiet'}
  <div class="ceremony-overlay ceremony-overlay--dark" transition:fade={{ duration: FRAME_TRANSITION_MS }} data-ceremony="quiet">
    <p class="ceremony-quiet-name">{prayerLabel}</p>
    <p class="ceremony-dhikr" dir="rtl" lang="ar">سُبْحَانَ اللهِ وَبِحَمْدِهِ</p>
  </div>
{/if}
<!-- §7.6.5: 'night-calm' intentionally renders no overlay — the page keeps
     the board readable and applies a light veil instead. -->
