<script lang="ts">
  interface Session {
    id: string;
    label: string;
    time: string;
    khateeb: string | null;
  }

  let {
    sessions,
    label = "Jumu'ah",
  }: {
    sessions: Session[];
    label: string;
  } = $props();
</script>

<div class="tv-jumuah-panel">
  <p class="tv-jumuah-heading">{label}</p>
  <div class="tv-jumuah-list">
    {#each sessions as session}
      <div class="tv-jumuah-session">
        <span class="tv-jumuah-time">{session.time}</span>
        <div class="tv-jumuah-details">
          {#if session.label}
            <span class="tv-jumuah-label">{session.label}</span>
          {/if}
          {#if session.khateeb}
            <span class="tv-jumuah-khateeb">{session.khateeb}</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
