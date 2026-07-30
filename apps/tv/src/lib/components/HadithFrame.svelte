<script lang="ts">
  /**
   * Hadith of the Day frame (docs/design-language.md §7.5):
   * Arabic (Amiri) + English + source, from the curated date-seeded
   * collection. Bilingual lives here, not on the prayer board (§9).
   */
  let {
    arabic,
    english,
    source,
  }: {
    arabic: string;
    english: string;
    source: string;
  } = $props();
</script>

<div class="frame frame--hadith">
  <p class="frame-label">Hadith of the Day</p>
  <p class="frame-hadith-arabic" dir="rtl" lang="ar">{arabic}</p>
  <p class="frame-hadith-english">{english}</p>
  <p class="frame-hadith-source">{source}</p>
</div>
