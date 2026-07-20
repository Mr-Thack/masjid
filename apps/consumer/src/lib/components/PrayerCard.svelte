<script lang="ts">
  let {
    name,
    adhaan,
    iqaamah,
    isNext = false,
    isPast = false,
  }: {
    name: string;
    adhaan: string;
    iqaamah: string;
    isNext?: boolean;
    isPast?: boolean;
  } = $props();
</script>

<div
  class="glass-card p-4 flex flex-col items-center gap-1.5 relative overflow-hidden"
  class:animate-pulse-border={isNext}
  class:opacity-40={isPast}
  class:opacity-100={!isPast}
  style="border-color: {isNext ? 'var(--color-accent)' : ''};"
>
  {#if isNext}
    <div class="absolute top-2 right-2">
      <span class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full text-white bg-accent">
        Next
      </span>
    </div>
  {/if}

  <span class="text-xs font-semibold uppercase tracking-[0.15em] font-heading" style="color: var(--color-text-muted);">
    {name}
  </span>

  <div class="flex flex-col items-center gap-1">
    <span class="text-sm" style="color: var(--color-text-dim);">Adhaan</span>
    <span class="text-xl font-bold tabular-nums" style="color: #e5e7eb;">
      {adhaan}
    </span>
  </div>

  <div class="w-8 h-px" style="background: linear-gradient(90deg, transparent, var(--color-accent), transparent);"></div>

  <div class="flex flex-col items-center gap-1">
    <span class="text-sm font-semibold text-accent">Iqaamah</span>
    <span
      class="text-2xl font-extrabold tabular-nums"
      style="color: {isNext ? '#ffffff' : 'var(--color-text)'};"
    >
      {iqaamah}
    </span>
  </div>
</div>