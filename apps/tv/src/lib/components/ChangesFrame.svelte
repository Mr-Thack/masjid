<script lang="ts">
  /**
   * Schedule changes frame (docs/design-language.md §7.5): nearest iqaamah
   * changes from the board payload. Suppressed entirely when empty.
   */
  let {
    changes,
  }: {
    changes: Array<{
      date: string;
      label: string;
      from: string;
      to: string;
    }>;
  } = $props();
</script>

<div class="frame frame--changes">
  <p class="frame-label">Schedule Changes</p>
  <div class="frame-changes-list">
    {#each changes as change}
      <div class="frame-change-row">
        <span class="frame-change-date">{change.date}</span>
        <span class="frame-change-prayer">{change.label}</span>
        <span class="frame-change-times">
          <span class="frame-change-from">{change.from}</span>
          <span class="frame-change-arrow">→</span>
          <span class="frame-change-to">{change.to}</span>
        </span>
      </div>
    {/each}
  </div>
</div>
