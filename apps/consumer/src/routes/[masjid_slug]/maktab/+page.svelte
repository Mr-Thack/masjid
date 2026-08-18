<script lang="ts">
  import { page } from '$app/stores';
  import { formatCents } from '$lib/money';

  let maktab = $derived($page.data.maktab);
  let masjid = $derived($page.data.masjid);
  let info = $derived(maktab?.program_info);
</script>

<svelte:head>
  <title>Maktab — {masjid?.name ?? 'Masjid'}</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-6">
  {#if info?.goal}
    <section class="glass-card rounded-2xl p-6 sm:p-8 space-y-4">
      <h2 class="text-xl font-bold font-heading">Goal</h2>
      <p class="leading-relaxed" style="color: var(--color-text-muted);">{info.goal}</p>
    </section>
  {/if}

  {#if info?.schedule_days || info?.schedule_time}
    <section class="glass-card rounded-2xl p-6 sm:p-8 space-y-4">
      <h2 class="text-xl font-bold font-heading">Schedule</h2>
      <p class="leading-relaxed" style="color: var(--color-text-muted);">
        {info.schedule_days}{#if info.schedule_days && info.schedule_time} — {/if}{info.schedule_time}
      </p>
    </section>
  {/if}

  {#if info?.curriculum?.length}
    <section class="glass-card rounded-2xl p-6 sm:p-8 space-y-4">
      <h2 class="text-xl font-bold font-heading">Curriculum</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b" style="border-color: var(--color-border);">
              <th class="text-left py-2 pr-4 font-semibold">Subject Name</th>
              <th class="text-left py-2 font-semibold">Subject Description</th>
            </tr>
          </thead>
          <tbody>
            {#each info.curriculum as subject}
              <tr class="border-b" style="border-color: var(--color-border);">
                <td class="py-4 pr-4 font-medium align-top">{subject.name}</td>
                <td class="py-4 leading-relaxed align-top" style="color: var(--color-text-muted);">{subject.description}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

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

    {#if maktab?.open && maktab?.term && maktab?.square_config}
      <a
        href="/{$page.params.masjid_slug}/maktab/enroll"
        class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white no-underline transition-transform hover:scale-[1.02]"
        style="background-color: var(--color-primary);"
      >
        Enroll Now
      </a>
    {:else if maktab?.open && maktab?.term}
      <div class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold" style="background-color: var(--color-surface); color: var(--color-text-muted);">
        Enrollment Unavailable
      </div>
      <p class="text-sm" style="color: var(--color-text-dim);">Online enrollment is not available right now. Please contact the masjid to enroll.</p>
    {:else}
      <div class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold" style="background-color: var(--color-surface); color: var(--color-text-muted);">
        Enrollment Closed
      </div>
      {#if maktab?.status_message}
        <p class="text-sm" style="color: var(--color-text-dim);">{maktab.status_message}</p>
      {/if}
    {/if}
  </section>

  {#if info?.faqs?.length}
    <section class="glass-card rounded-2xl p-6 sm:p-8 space-y-4">
      <h2 class="text-xl font-bold font-heading">Frequently Asked Questions</h2>
      <div class="space-y-1">
        {#each info.faqs as faq, i}
          <details class="group rounded-xl p-4 cursor-pointer" style="background-color: var(--color-surface);">
            <summary class="font-medium list-none flex items-center justify-between gap-2">
              {faq.question}
              <svg class="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <p class="mt-3 leading-relaxed text-sm" style="color: var(--color-text-muted);">
              {faq.answer}
            </p>
          </details>
        {/each}
      </div>
    </section>
  {/if}
</div>
