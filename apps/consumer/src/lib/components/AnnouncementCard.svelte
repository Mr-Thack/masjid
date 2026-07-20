<script lang="ts">
  import { Announcement } from '@masjid/schemas';

  let {
    announcement,
    accentColor = '#10b981',
  }: {
    announcement: Announcement;
    accentColor?: string;
  } = $props();

  let expanded = $state(false);
</script>

<div
  class="glass-card p-4 cursor-pointer transition-all duration-300"
  class:ring-1={expanded}
  style="border-color: {announcement.is_pinned ? accentColor : ''};"
  onclick={() => (expanded = !expanded)}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      expanded = !expanded;
    }
  }}
  role="button"
  tabindex="0"
>
  <div class="flex items-start justify-between gap-3">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1">
        {#if announcement.is_pinned}
          <span
            class="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-white flex-shrink-0"
            style="background: {accentColor};"
          >
            Pinned
          </span>
        {/if}
        <h3
          class="text-base font-semibold text-gray-100 truncate"
          style="font-family: var(--font-heading);"
        >
          {announcement.title}
        </h3>
      </div>
      {#if announcement.published_at}
        <p class="text-xs text-gray-500">
          {new Date(announcement.published_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>
      {/if}
    </div>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 text-gray-500 flex-shrink-0 transition-transform duration-300 mt-1"
      class:rotate-180={expanded}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </div>

  {#if announcement.compiled_html}
    <div
      class="mt-3 pt-3 border-t border-white/5 text-sm text-gray-300 leading-relaxed"
      class:hidden={!expanded}
    >
      {@html announcement.compiled_html}
    </div>
  {/if}
</div>