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

<div class="jumuah-notice">
  <div class="jumuah-icon">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 text-gray-950"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      width="20"
      height="20"
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
    <p class="jumuah-label">Jumu'ah</p>
    <div class="jumuah-times">
      {#each sessions as session}
        <span class="jumuah-time">{session.time}</span>
      {/each}
    </div>
  </div>
</div>