<script lang="ts">
  /**
   * Hadith of the Day (docs/design-language.md §7.11, content rules §4):
   * the consumer rendering of the TV hadith frame — static (the motion
   * budget becomes user scroll on a hand-held surface), same curated
   * collection, same date-seeded pick. Arabic + English + source, always.
   */
  import type { HadithEntry } from '@masjid/ui-utils';
  import Rosette from '@masjid/ui-utils/components/Rosette.svelte';

  let {
    entry,
    label = 'Hadith of the Day',
  }: {
    entry: HadithEntry;
    label?: string;
  } = $props();
</script>

<section class="c-hadith-card glass-card">
  <h2 class="c-hadith-heading">
    <Rosette size={13} />
    <span>{label}</span>
    <Rosette size={13} />
  </h2>
  <p class="c-hadith-arabic" dir="rtl" lang="ar">{entry.arabic}</p>
  <p class="c-hadith-english">{entry.english}</p>
  <p class="c-hadith-source">{entry.source}</p>
</section>
