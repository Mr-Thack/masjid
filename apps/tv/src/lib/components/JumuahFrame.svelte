<script lang="ts">
  /**
   * Jumu'ah times frame (docs/design-language.md §7.5): pinned
   * Thursday–Friday, rotates normally otherwise. Content reuses the
   * existing JumuahNotice session list.
   */
  import JumuahNotice from './JumuahNotice.svelte';

  let {
    sessions,
    label,
    speechLabel,
  }: {
    sessions: Array<{
      id: string;
      label: string;
      time: string;
      khateeb: string | null;
      speech_time: string | null;
    }>;
    label: string;
    speechLabel: string;
  } = $props();
</script>

<div class="frame frame--jumuah">
  <JumuahNotice {sessions} {label} {speechLabel} />
</div>
