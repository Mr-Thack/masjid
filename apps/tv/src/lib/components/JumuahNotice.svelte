<script lang="ts">
  interface Session {
    id: string;
    label: string;
    time: string;
    khateeb: string | null;
    speech_time: string | null;
  }

  let {
    sessions,
    label = "Jumu'ah",
    speechLabel = 'Speech',
  }: {
    sessions: Session[];
    label: string;
    speechLabel: string;
  } = $props();
</script>

<div class="tv-jumuah-panel">
  <p class="tv-jumuah-heading">{label} Sessions</p>
  <div class="tv-jumuah-list">
    {#each sessions as session}
      <div class="tv-jumuah-session">
        {#if session.speech_time}
          <span class="tv-jumuah-speech">{speechLabel} @ {session.speech_time}</span>
        {/if}
        <span class="tv-jumuah-time">
          {session.time} 
          {#if session.khateeb}
            <span class="tv-jumuah-khateeb">— {session.khateeb}</span>
          {/if}
        </span>
      </div>
    {/each}
  </div>
</div>
