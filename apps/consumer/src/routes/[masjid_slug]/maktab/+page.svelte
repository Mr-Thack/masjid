<script lang="ts">
  import { page } from '$app/stores';
  import { formatCents } from '$lib/money';

  let maktab = $derived($page.data.maktab);
  let masjid = $derived($page.data.masjid);
</script>

<svelte:head>
  <title>Maktab — {masjid?.name ?? 'Masjid'}</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-6">
  <section class="glass-card rounded-2xl p-6 sm:p-8 text-center space-y-4">
    <h1 class="text-2xl sm:text-3xl font-bold font-heading">Maktab Enrollment</h1>

    {#if maktab?.term}
      <p class="text-lg" style="color: var(--color-text-muted);">
        {maktab.term.name} · {maktab.term.length_months} month{maktab.term.length_months === 1 ? '' : 's'}
      </p>

      <div class="grid grid-cols-3 gap-3 text-sm">
        <div class="glass rounded-xl p-3">
          <div class="font-bold text-lg">{formatCents(maktab.term.prices['1'])}</div>
          <div style="color: var(--color-text-dim);">1 child</div>
        </div>
        <div class="glass rounded-xl p-3">
          <div class="font-bold text-lg">{formatCents(maktab.term.prices['2'])}</div>
          <div style="color: var(--color-text-dim);">2 children</div>
        </div>
        <div class="glass rounded-xl p-3">
          <div class="font-bold text-lg">{formatCents(maktab.term.prices['3plus'])}</div>
          <div style="color: var(--color-text-dim);">3+ children</div>
        </div>
      </div>
    {:else}
      <p style="color: var(--color-text-muted);">No active Maktab term is configured.</p>
    {/if}

    {#if maktab?.open && maktab?.term}
      <a
        href="/{$page.params.masjid_slug}/maktab/enroll"
        class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white no-underline transition-transform hover:scale-[1.02]"
        style="background-color: var(--color-primary);"
      >
        Enroll Now
      </a>
    {:else}
      <div class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold" style="background-color: var(--color-surface); color: var(--color-text-muted);">
        Enrollment Closed
      </div>
      {#if maktab?.status_message}
        <p class="text-sm" style="color: var(--color-text-dim);">{maktab.status_message}</p>
      {/if}
    {/if}
  </section>
</div>
