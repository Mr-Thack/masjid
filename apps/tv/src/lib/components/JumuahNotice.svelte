<script lang="ts">
  interface Session {
    id: string;
    label: string;
    time: string;
    khateeb: string | null;
    language: string;
  }

  let {
    sessions,
    label = "Jumu'ah",
  }: {
    sessions: Session[];
    label: string;
  } = $props();
</script>

<div class="jumuah-line">
  <span class="jumuah-asterisk">*</span>
  <span class="jumuah-heading">{label}:</span>
  {#each sessions as session, i}
    <span class="jumuah-session">
      {session.time}
      {#if session.khateeb}
        <span class="jumuah-khateeb">({session.khateeb})</span>
      {/if}
      {#if session.language}
        <span class="jumuah-lang">[{session.language}]</span>
      {/if}
      {#if i < sessions.length - 1}
        <span class="jumuah-sep">·</span>
      {/if}
    </span>
  {/each}
</div>