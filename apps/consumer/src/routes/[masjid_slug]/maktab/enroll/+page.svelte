<script lang="ts">
  import { page } from '$app/stores';
  import { onDestroy } from 'svelte';
  import { formatCents, monthlyPriceCents } from '$lib/money';
  import { submitMaktabEnrollment, verifyAssistanceCode } from '$lib/api';
  import ErrorState from '$lib/components/ErrorState.svelte';

  let slug = $derived($page.params.masjid_slug);
  let masjid = $derived($page.data.masjid);
  let maktab = $derived($page.data.maktab);
  let embed = $derived($page.url.searchParams.has('embed'));

  let form = $state({
    father: { name: '', phone: '', email: '' },
    mother: { name: '', phone: '', email: '' },
    address_line1: '',
    city: '',
    postal_code: '',
    country: 'US',
    children: [{ name: '', dob: '', sex: '' as 'male' | 'female' | '' }],
    card_holder_name: '',
  });

  let cardReady = $state(false);
  let cardError = $state<string | null>(null);
  let cardLoading = $state(false);
  let needsPayment = $state<boolean | null>(null);
  let verifying = $state(false);
  let submitting = $state(false);
  let submitError = $state<string | null>(null);
  let success = $state(false);
  let cardInstance: { destroy: () => void } | null = null;
  let verifyTimer: ReturnType<typeof setTimeout> | null = null;

  let amountCents = $derived(
    maktab?.term ? monthlyPriceCents(maktab.term, form.children.length) : 0,
  );

  let childrenCount = $derived(form.children.length);
  let tier = $derived(
    childrenCount === 1 ? '1' : childrenCount === 2 ? '2' : '3plus',
  );

  function loadSquareCard() {
    if (cardLoading || cardReady) return;
    if (!maktab?.square_config?.app_id || !maktab.square_config.location_id) return;

    cardLoading = true;
    const script = document.createElement('script');
    script.src = 'https://sandbox.web.squarecdn.com/v1/square.js';
    if (maktab.square_config.environment === 'production') {
      script.src = 'https://web.squarecdn.com/v1/square.js';
    }
    script.async = true;
    script.onload = async () => {
      try {
        const SquareSdk = (window as any).Square;
        const payments = SquareSdk.payments(
          maktab.square_config!.app_id,
          maktab.square_config!.location_id,
        );
        const card = await payments.card();
        await card.attach('#card-container');
        cardInstance = card;
        cardReady = true;
        cardError = null;
      } catch (e) {
        cardError = e instanceof Error ? e.message : 'Unable to load payment form';
      }
    };
    script.onerror = () => {
      cardError = 'Payment script failed to load';
    };
    document.body.appendChild(script);
  }

  async function verifyCode() {
    const name = form.card_holder_name.trim();
    if (!name) {
      needsPayment = null;
      return;
    }
    verifying = true;
    try {
      const result = await verifyAssistanceCode(slug, name);
      needsPayment = result.needs_payment;
    } catch {
      needsPayment = true;
    } finally {
      verifying = false;
    }
  }

  $effect(() => {
    form.card_holder_name;
    if (verifyTimer) clearTimeout(verifyTimer);
    verifyTimer = setTimeout(verifyCode, 500);
  });

  onDestroy(() => {
    if (verifyTimer) clearTimeout(verifyTimer);
    if (cardInstance) {
      cardInstance.destroy();
      cardInstance = null;
    }
  });

  $effect(() => {
    loadSquareCard();
  });

  function addChild() {
    form.children = [...form.children, { name: '', dob: '', sex: '' }];
  }

  function removeChild(index: number) {
    form.children = form.children.filter((_, i) => i !== index);
  }

  function validate(): string | null {
    if (!form.father.name && !form.mother.name) {
      return 'Please enter at least one parent\'s name.';
    }
    if (form.children.length === 0) return 'Please add at least one child.';
    for (const child of form.children) {
      if (!child.name || !child.dob || !child.sex) return 'Please complete each child\'s information.';
    }
    if (!form.address_line1 || !form.city || !form.postal_code) return 'Please enter the full address.';
    if (!form.card_holder_name) return 'Please enter the card holder name.';
    return null;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    submitError = null;

    const err = validate();
    if (err) {
      submitError = err;
      return;
    }

    submitting = true;
    try {
      let sourceId: string | undefined;

      if (cardInstance) {
        const tokenResult = await (cardInstance as any).tokenize();
        if (tokenResult.status !== 'OK' || !tokenResult.token) {
          throw new Error(tokenResult.errors?.[0]?.message || 'Card tokenization failed');
        }
        sourceId = tokenResult.token;
      }

      const payload: Record<string, unknown> = {
        father: form.father.name ? form.father : undefined,
        mother: form.mother.name ? form.mother : undefined,
        address_line1: form.address_line1,
        city: form.city,
        postal_code: form.postal_code,
        country: form.country,
        children: form.children.map((c) => ({ name: c.name, dob: c.dob, sex: c.sex })),
        card_holder_name: form.card_holder_name,
      };

      if (sourceId) {
        payload.source_id = sourceId;
      }

      await submitMaktabEnrollment(slug, payload);
      success = true;
    } catch (e) {
      submitError = e instanceof Error ? e.message : 'Enrollment failed. Please try again.';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Maktab Enrollment — {masjid?.name ?? 'Masjid'}</title>
</svelte:head>

<div class="max-w-3xl mx-auto pb-12">
  {#if !embed}
    <a
      href="/{slug}/maktab"
      class="text-sm font-medium inline-flex items-center gap-1 mb-4 no-underline"
      style="color: var(--color-accent);"
    >
      ← Back to Maktab
    </a>
  {/if}

  <h1 class="text-2xl sm:text-3xl font-bold font-heading mb-2">Maktab Enrollment</h1>

  {#if $page.data.maktabError}
    <ErrorState message={$page.data.maktabError} />
  {:else if !maktab?.open || !maktab?.term}
    <div class="glass-card rounded-2xl p-8 text-center" style="color: var(--color-text-muted);">
      <p class="text-lg">Enrollment is currently closed.</p>
      {#if maktab?.status_message}
        <p class="mt-2 text-sm" style="color: var(--color-text-dim);">{maktab.status_message}</p>
      {/if}
    </div>
  {:else if success}
    <div class="glass-card rounded-2xl p-8 text-center space-y-4">
      <div class="text-5xl">🎉</div>
      <h2 class="text-2xl font-bold font-heading">Enrollment Submitted</h2>
      <p style="color: var(--color-text-muted);">
        Thank you! Your enrollment has been received and a confirmation will be sent by email.
      </p>
      {#if !embed}
        <a
          href="/{slug}"
          class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white no-underline"
          style="background-color: var(--color-primary);"
        >
          Return Home
        </a>
      {/if}
    </div>
  {:else}
    <form
      onsubmit={handleSubmit}
      class="glass-card rounded-2xl p-6 sm:p-8 space-y-8"
      autocomplete="on"
    >
      <section class="space-y-4">
        <h2 class="text-lg font-semibold font-heading border-b pb-2" style="border-color: var(--color-border);">Parent / Guardian Information</h2>

        <div class="grid sm:grid-cols-2 gap-4">
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Father's Name</span>
            <input
              type="text"
              bind:value={form.father.name}
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: var(--color-border); color: var(--color-text);"
            />
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Mother's Name</span>
            <input
              type="text"
              bind:value={form.mother.name}
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: var(--color-border); color: var(--color-text);"
            />
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Father's Phone</span>
            <input
              type="tel"
              bind:value={form.father.phone}
              placeholder="+1 123 456 7890"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: var(--color-border); color: var(--color-text);"
            />
            <p class="text-xs font-bold mt-1" style="color: var(--color-accent);">* Include country code (+1)</p>
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Mother's Phone</span>
            <input
              type="tel"
              bind:value={form.mother.phone}
              placeholder="+1 123 456 7890"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: var(--color-border); color: var(--color-text);"
            />
            <p class="text-xs font-bold mt-1" style="color: var(--color-accent);">* Include country code (+1)</p>
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Father's Email</span>
            <input
              type="email"
              bind:value={form.father.email}
              placeholder="father@email.com"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: var(--color-border); color: var(--color-text);"
            />
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Mother's Email</span>
            <input
              type="email"
              bind:value={form.mother.email}
              placeholder="mother@email.com"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: var(--color-border); color: var(--color-text);"
            />
          </label>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold font-heading border-b pb-2" style="border-color: var(--color-border);">Home Address</h2>
        <div class="grid sm:grid-cols-2 gap-4">
          <label class="block space-y-1 sm:col-span-2">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Street Address</span>
            <input
              type="text"
              bind:value={form.address_line1}
              autocomplete="street-address"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: var(--color-border); color: var(--color-text);"
            />
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">City</span>
            <input
              type="text"
              bind:value={form.city}
              autocomplete="address-level2"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: var(--color-border); color: var(--color-text);"
            />
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">ZIP Code</span>
            <input
              type="text"
              bind:value={form.postal_code}
              autocomplete="postal-code"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: var(--color-border); color: var(--color-text);"
            />
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Country</span>
            <input
              type="text"
              bind:value={form.country}
              autocomplete="country-name"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: var(--color-border); color: var(--color-text);"
            />
          </label>
        </div>
      </section>

      <section class="space-y-4">
        <div class="flex items-center justify-between border-b pb-2" style="border-color: var(--color-border);">
          <h2 class="text-lg font-semibold font-heading">Children</h2>
          <button
            type="button"
            onclick={addChild}
            class="text-sm font-semibold px-3 py-1.5 rounded-lg text-white"
            style="background-color: var(--color-primary);"
          >
            + Add Child
          </button>
        </div>

        {#each form.children as child, i (i)}
          <div class="glass rounded-xl p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium" style="color: var(--color-text-muted);">Child {i + 1}</span>
              {#if form.children.length > 1}
                <button
                  type="button"
                  onclick={() => removeChild(i)}
                  class="text-sm"
                  style="color: var(--color-accent);"
                >Remove</button>
              {/if}
            </div>
            <div class="grid sm:grid-cols-3 gap-3">
              <input
                type="text"
                bind:value={child.name}
                placeholder="Full name"
                class="rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
                style="border-color: var(--color-border); color: var(--color-text);"
              />
              <input
                type="date"
                bind:value={child.dob}
                class="rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
                style="border-color: var(--color-border); color: var(--color-text);"
              />
              <select
                bind:value={child.sex}
                class="rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
                style="border-color: var(--color-border); color: var(--color-text);"
              >
                <option value="" disabled>Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
        {/each}
      </section>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold font-heading border-b pb-2" style="border-color: var(--color-border);">Payment</h2>

        <div class="grid sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <label class="block space-y-1">
              <span class="text-sm font-medium" style="color: var(--color-text-muted);">Card Holder Name</span>
              <input
                type="text"
                bind:value={form.card_holder_name}
                autocomplete="cc-name"
                disabled={needsPayment === false}
                class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                style="border-color: var(--color-border); color: var(--color-text);"
              />
            </label>
          </div>

          {#if needsPayment === false}
            <div class="sm:col-span-2 rounded-lg p-4 text-sm flex items-center gap-2" style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary);">
              <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              <span>Enrollment will be submitted without payment.</span>
            </div>
          {:else}
            <div class="sm:col-span-2">
              <span class="text-sm font-medium" style="color: var(--color-text-muted);">Card Details</span>
              <div class="mt-1 relative">
                <div
                  id="card-container"
                  class="min-h-[120px] rounded-lg p-3 border"
                  style="border-color: var(--color-border); background-color: var(--color-surface);"
                ></div>
                {#if !cardReady && !cardError}
                  <div class="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none" style="background-color: var(--color-surface);">
                    <span class="text-sm" style="color: var(--color-text-dim);">Loading secure card form…</span>
                  </div>
                {/if}
              </div>
              {#if cardError}
                <p class="text-sm mt-2" style="color: var(--color-accent);">{cardError}</p>
              {/if}
            </div>
          {/if}
        </div>

        <div class="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {#if needsPayment === false}
              <p class="text-sm" style="color: var(--color-text-muted);">
                {maktab.term.billing_months} month program · {childrenCount} child{childrenCount === 1 ? '' : 'ren'}
              </p>
              <p class="text-base font-medium font-heading" style="color: var(--color-text-muted);">Financial Aid</p>
            {:else}
              <p class="text-sm" style="color: var(--color-text-muted);">
                {maktab.term.billing_months} month subscription · {childrenCount} child{childrenCount === 1 ? '' : 'ren'} ({tier} student{tier === '1' ? '' : 's'})
              </p>
              <p class="text-2xl font-bold font-heading">{formatCents(amountCents)}<span class="text-sm font-normal" style="color: var(--color-text-muted);">/month</span></p>
            {/if}
          </div>
          <button
            type="submit"
            disabled={submitting}
            class="px-8 py-3 rounded-xl font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style="background-color: var(--color-primary);"
          >
            {submitting ? 'Processing…' : needsPayment === false ? 'Submit Enrollment' : 'Complete Enrollment'}
          </button>
        </div>

        {#if needsPayment !== false}
          <div class="mt-6 rounded-xl p-5 text-sm space-y-3" style="background-color: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text-muted);">
            <h3 class="font-semibold font-heading" style="color: var(--color-text);">When you continue to payment, you agree to the following:</h3>
            <ol class="list-decimal pl-5 space-y-1">
              <li>You are signing up for the <strong style="color: var(--color-text);">full {maktab.term.length_months}-month program</strong>, billed over {maktab.term.billing_months} monthly payments.</li>
              <li><strong style="color: var(--color-text);">There are no refunds</strong>, even if your child stops coming.</li>
              <li><strong style="color: var(--color-text);">You will still be charged each month</strong>, even if your child does not attend.</li>
              <li><strong style="color: var(--color-text);">You cannot cancel or leave</strong> the program once you are signed up.</li>
              <li>Your card will be <strong style="color: var(--color-text);">charged automatically every month</strong>.</li>
            </ol>
            <p>
              By clicking the <em style="color: var(--color-text);">"Complete Enrollment"</em> button above, you agree to these terms.
            </p>
          </div>
        {/if}
      </section>

      {#if submitError}
        <div class="rounded-xl p-4 text-sm" style="background-color: rgba(var(--color-accent-rgb, 239,68,68), 0.1); color: var(--color-accent);">
          {submitError}
        </div>
      {/if}
    </form>
  {/if}
</div>
