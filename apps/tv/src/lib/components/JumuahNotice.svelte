<script lang="ts">
  interface Session {
    id: string;
    label: string;
    time: string;
    khateeb: string | null;
    language: string;
    location: string | null;
    is_active: boolean;
  }

  let { sessions }: { sessions: Session[] } = $props();
</script>

<div class="flex items-center gap-4 bg-gray-800/80 rounded-xl border border-gray-700 px-5 py-3">
  <div
    class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
    style="background: var(--color-accent, #10b981);"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 text-gray-950"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  </div>
  <div>
    <p class="text-sm font-semibold text-gray-300 uppercase tracking-wider">Jumu'ah</p>
    <div class="flex gap-3 mt-1">
      {#each sessions as session}
        <span class="text-lg font-bold text-gray-100">{session.time}</span>
      {/each}
    </div>
  </div>
</div>