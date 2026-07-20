<script lang="ts">
  import { formatTime, type TimeFormat } from '$lib/time';

  let {
    name,
    adhaan,
    iqaamah,
    adhaanLabel = 'Adhaan',
    iqaamahLabel = 'Iqaamah',
    sunrise,
    sunriseLabel = 'Sunrise',
    rightAfterAdhaan = false,
    timeFormat = '24h',
    isNext = false,
    isCurrent = false,
    isPast = false,
  }: {
    name: string;
    adhaan: string;
    iqaamah: string;
    adhaanLabel?: string;
    iqaamahLabel?: string;
    sunrise?: string;
    sunriseLabel?: string;
    rightAfterAdhaan?: boolean;
    timeFormat?: TimeFormat;
    isNext?: boolean;
    isCurrent?: boolean;
    isPast?: boolean;
  } = $props();

  let formattedAdhaan = $derived(formatTime(adhaan, timeFormat));
  let formattedIqaamah = $derived(formatTime(iqaamah, timeFormat));
  let formattedSunrise = $derived(sunrise ? formatTime(sunrise, timeFormat) : null);
</script>

<div
  class="glass-card p-4 flex flex-col items-center gap-1.5 relative overflow-hidden"
  class:ring-1={isCurrent || isNext}
  class:animate-pulse-border={isNext}
  class:opacity-40={isPast}
  class:opacity-100={!isPast}
  style="border-color: {isCurrent ? 'var(--color-primary)' : isNext ? 'var(--color-accent)' : ''};"
>
  {#if isCurrent}
    <div class="absolute top-2 right-2">
      <span class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full text-white bg-primary">
        Current
      </span>
    </div>
  {:else if isNext}
    <div class="absolute top-2 right-2">
      <span class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full text-white bg-accent">
        Next
      </span>
    </div>
  {/if}

  <span class="text-xs font-semibold uppercase tracking-[0.15em] font-heading" style="color: var(--color-text-muted);">
    {name}
  </span>

  {#if rightAfterAdhaan}
    <div class="flex flex-col items-center gap-1">
      <span class="text-sm" style="color: var(--color-text-dim);">{adhaanLabel} + {iqaamahLabel}</span>
      <span class="text-2xl font-extrabold tabular-nums" style="color: var(--color-text);">
        {formattedAdhaan}
      </span>
    </div>
  {:else}
    <div class="flex flex-col items-center gap-1">
      <span class="text-sm" style="color: var(--color-text-dim);">{adhaanLabel}</span>
      <span class="text-xl font-bold tabular-nums" style="color: var(--color-text);">
        {formattedAdhaan}
      </span>
    </div>

    <div class="w-8 h-px" style="background: linear-gradient(90deg, transparent, var(--color-accent), transparent);"></div>

    <div class="flex flex-col items-center gap-1">
      <span class="text-sm font-semibold text-accent">{iqaamahLabel}</span>
      <span class="text-2xl font-extrabold tabular-nums" style="color: var(--color-text);">
        {formattedIqaamah}
      </span>
    </div>
  {/if}

  {#if formattedSunrise}
    <div class="mt-1 flex items-center gap-1.5 text-[10px]" style="color: var(--color-text-dim);">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>
      <span>{sunriseLabel}: {formattedSunrise}</span>
    </div>
  {/if}
</div>