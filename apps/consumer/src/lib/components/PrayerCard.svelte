<script lang="ts">
  let {
    name,
    adhaan,
    iqaamah,
    isNext = false,
    isPast = false,
    accentColor = '#10b981',
  }: {
    name: string;
    adhaan: string;
    iqaamah: string;
    isNext?: boolean;
    isPast?: boolean;
    accentColor?: string;
  } = $props();
</script>

<div
  class="glass-card p-4 flex flex-col items-center gap-1.5 relative overflow-hidden"
  class:animate-pulse-border={isNext}
  class:opacity-40={isPast}
  class:opacity-100={!isPast}
  style="border-color: {isNext ? accentColor : ''};"
>
  {#if isNext}
    <div class="absolute top-2 right-2">
      <span class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full text-white" style="background: {accentColor};">
        Next
      </span>
    </div>
  {/if}

  <span
    class="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400"
    style="font-family: var(--font-heading);"
  >
    {name}
  </span>

  <div class="flex flex-col items-center gap-1">
    <span class="text-sm text-gray-500">Adhaan</span>
    <span class="text-xl font-bold tabular-nums text-gray-200">
      {adhaan}
    </span>
  </div>

  <div class="w-8 h-px" style="background: linear-gradient(90deg, transparent, {accentColor}, transparent);"></div>

  <div class="flex flex-col items-center gap-1">
    <span class="text-sm font-semibold" style="color: {accentColor};">Iqaamah</span>
    <span
      class="text-2xl font-extrabold tabular-nums"
      style="color: {isNext ? '#ffffff' : '#f9fafb'};"
    >
      {iqaamah}
    </span>
  </div>
</div>