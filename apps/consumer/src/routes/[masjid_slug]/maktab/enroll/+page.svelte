<script lang="ts">
  import { page } from '$app/stores';
  import { onDestroy, tick } from 'svelte';
  import { formatCents, monthlyPriceCents } from '$lib/money';
  import { submitMaktabEnrollment, verifyAssistanceCode } from '$lib/api';
  import {
    validateEnrollment,
    hasErrors,
    summarizeErrors,
    type EnrollmentErrors,
  } from '$lib/maktab-validation';
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
  let fieldErrors = $state<EnrollmentErrors | null>(null);
  let errorSummaryEl = $state<HTMLDivElement | null>(null);
  let submitAttempted = $state(false);
  let success = $state(false);
  let cardInstance: { destroy: () => void } | null = null;
  let verifyTimer: ReturnType<typeof setTimeout> | null = null;

  let errorLines = $derived(
    fieldErrors && hasErrors(fieldErrors)
      ? summarizeErrors(fieldErrors)
      : submitError
        ? [submitError]
        : [],
  );

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
    if (fieldErrors) {
      fieldErrors = {
        ...fieldErrors,
        childErrors: fieldErrors.childErrors.filter((_, i) => i !== index),
      };
    }
  }

  function borderColor(invalid: boolean | undefined): string {
    return invalid ? 'var(--color-accent)' : 'var(--color-border)';
  }

  function clearFieldError(
    field: 'address_line1' | 'city' | 'postal_code' | 'card_holder_name',
  ) {
    if (!fieldErrors) return;
    fieldErrors = { ...fieldErrors, [field]: undefined };
  }

  function clearParentError(parent: 'father' | 'mother', field: 'name' | 'phone' | 'email') {
    if (!fieldErrors) return;
    const current = fieldErrors.parentErrors[parent];
    const next = current ? { ...current, [field]: undefined } : null;
    const parentStillInvalid = next && Object.values(next).some(Boolean);
    fieldErrors = {
      ...fieldErrors,
      parents: undefined,
      parentErrors: {
        ...fieldErrors.parentErrors,
        [parent]: parentStillInvalid ? next : null,
      },
    };
  }

  function clearChildError(index: number, field: 'name' | 'dob' | 'sex') {
    if (!fieldErrors) return;
    const childErrors = fieldErrors.childErrors.map((c, i) => {
      if (i !== index || !c) return c;
      const next = { ...c, [field]: undefined };
      return Object.values(next).some(Boolean) ? next : null;
    });
    fieldErrors = { ...fieldErrors, childErrors };
  }

  /** Scroll the error summary into view and move keyboard/screen-reader focus to it. */
  async function showErrors() {
    await tick();
    errorSummaryEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    errorSummaryEl?.focus({ preventScroll: true });
  }

  // ── Validate-on-blur ──────────────────────────────────────────────────────
  // Blur validation only ever ADDS an inline error for the field that was just
  // left (typing clears them via the clear* helpers above). The big summary
  // panel stays submit-only — pre-submit feedback is inline, field by field.

  function emptyFieldErrors(): EnrollmentErrors {
    return { parentErrors: { father: null, mother: null }, childErrors: [] };
  }

  function blurField(field: 'address_line1' | 'city' | 'postal_code' | 'card_holder_name') {
    const msg = validateEnrollment(form)[field];
    if (!msg) return;
    fieldErrors = { ...(fieldErrors ?? emptyFieldErrors()), [field]: msg };
  }

  function blurParentField(parent: 'father' | 'mother', field: 'name' | 'phone' | 'email') {
    const fresh = validateEnrollment(form);
    const msg = fresh.parentErrors[parent]?.[field];
    if (!msg) return;
    const base = fieldErrors ?? emptyFieldErrors();
    fieldErrors = {
      ...base,
      parentErrors: {
        ...base.parentErrors,
        [parent]: { ...base.parentErrors[parent], [field]: msg },
      },
    };
  }

  function blurChildField(index: number, field: 'name' | 'dob' | 'sex') {
    const fresh = validateEnrollment(form);
    const msg = fresh.childErrors[index]?.[field];
    if (!msg) return;
    const base = fieldErrors ?? emptyFieldErrors();
    const childErrors = [...base.childErrors];
    while (childErrors.length <= index) childErrors.push(null);
    childErrors[index] = { ...childErrors[index], [field]: msg };
    fieldErrors = { ...base, childErrors };
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    submitError = null;
    fieldErrors = null;

    const errors = validateEnrollment(form);
    if (hasErrors(errors)) {
      submitAttempted = true;
      fieldErrors = errors;
      await showErrors();
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
      submitAttempted = true;
      submitError = e instanceof Error ? e.message : 'Enrollment failed. Please try again.';
      await showErrors();
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Maktab Enrollment — {masjid?.name ?? 'Masjid'}</title>
</svelte:head>

{#snippet req()}
  <span style="color: var(--color-accent);" aria-hidden="true">*</span>
{/snippet}

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
  {:else if !maktab?.square_config}
    <div class="glass-card rounded-2xl p-8 text-center" style="color: var(--color-text-muted);">
      <p class="text-lg">Online enrollment is currently unavailable.</p>
      <p class="mt-2 text-sm" style="color: var(--color-text-dim);">
        Online payments are not configured. Please contact the masjid to enroll.
      </p>
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
      {#if submitAttempted && errorLines.length > 0}
        <div
          bind:this={errorSummaryEl}
          tabindex="-1"
          role="alert"
          class="rounded-xl p-4 sm:p-5 text-sm space-y-2 scroll-mt-28 outline-none"
          style="background-color: rgba(var(--color-accent-rgb, 239, 68, 68), 0.1); border: 1px solid var(--color-accent);"
        >
          <h3 class="font-semibold font-heading text-base" style="color: var(--color-accent);">
            {errorLines.length === 1
              ? 'Please fix the following problem:'
              : `Please fix the following ${errorLines.length} problems:`}
          </h3>
          <ul class="list-disc pl-5 space-y-1" style="color: var(--color-text);">
            {#each errorLines as line}
              <li>{line}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <p class="text-xs" style="color: var(--color-text-dim);">
        <span style="color: var(--color-accent);" aria-hidden="true">*</span> Required field
      </p>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold font-heading border-b pb-2" style="border-color: var(--color-border);">Parent / Guardian Information</h2>

        <p
          class="text-xs {fieldErrors?.parents ? 'font-semibold' : ''}"
          style="color: {fieldErrors?.parents ? 'var(--color-accent)' : 'var(--color-text-dim)'};"
        >
          At least one parent's complete information (name, phone, and email) is required.
        </p>

        <div class="grid sm:grid-cols-2 gap-4">
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Father's Name</span>
            <input
              type="text"
              bind:value={form.father.name}
              oninput={() => clearParentError('father', 'name')}
              onblur={() => blurParentField('father', 'name')}
              aria-invalid={fieldErrors?.parentErrors.father?.name ? 'true' : undefined}
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: {borderColor(fieldErrors?.parentErrors.father?.name != null)}; color: var(--color-text);"
            />
            {#if fieldErrors?.parentErrors.father?.name}
              <p class="text-xs font-medium" style="color: var(--color-accent);">{fieldErrors.parentErrors.father.name}</p>
            {/if}
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Mother's Name</span>
            <input
              type="text"
              bind:value={form.mother.name}
              oninput={() => clearParentError('mother', 'name')}
              onblur={() => blurParentField('mother', 'name')}
              aria-invalid={fieldErrors?.parentErrors.mother?.name ? 'true' : undefined}
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: {borderColor(fieldErrors?.parentErrors.mother?.name != null)}; color: var(--color-text);"
            />
            {#if fieldErrors?.parentErrors.mother?.name}
              <p class="text-xs font-medium" style="color: var(--color-accent);">{fieldErrors.parentErrors.mother.name}</p>
            {/if}
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Father's Phone</span>
            <input
              type="tel"
              bind:value={form.father.phone}
              oninput={() => clearParentError('father', 'phone')}
              onblur={() => blurParentField('father', 'phone')}
              aria-invalid={fieldErrors?.parentErrors.father?.phone ? 'true' : undefined}
              placeholder="+1 123 456 7890"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: {borderColor(fieldErrors?.parentErrors.father?.phone != null)}; color: var(--color-text);"
            />
            {#if fieldErrors?.parentErrors.father?.phone}
              <p class="text-xs font-medium" style="color: var(--color-accent);">{fieldErrors.parentErrors.father.phone}</p>
            {:else}
              <p class="text-xs font-bold mt-1" style="color: var(--color-accent);">* Include country code (+1)</p>
            {/if}
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Mother's Phone</span>
            <input
              type="tel"
              bind:value={form.mother.phone}
              oninput={() => clearParentError('mother', 'phone')}
              onblur={() => blurParentField('mother', 'phone')}
              aria-invalid={fieldErrors?.parentErrors.mother?.phone ? 'true' : undefined}
              placeholder="+1 123 456 7890"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: {borderColor(fieldErrors?.parentErrors.mother?.phone != null)}; color: var(--color-text);"
            />
            {#if fieldErrors?.parentErrors.mother?.phone}
              <p class="text-xs font-medium" style="color: var(--color-accent);">{fieldErrors.parentErrors.mother.phone}</p>
            {:else}
              <p class="text-xs font-bold mt-1" style="color: var(--color-accent);">* Include country code (+1)</p>
            {/if}
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Father's Email</span>
            <input
              type="email"
              bind:value={form.father.email}
              oninput={() => clearParentError('father', 'email')}
              onblur={() => blurParentField('father', 'email')}
              aria-invalid={fieldErrors?.parentErrors.father?.email ? 'true' : undefined}
              placeholder="father@email.com"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: {borderColor(fieldErrors?.parentErrors.father?.email != null)}; color: var(--color-text);"
            />
            {#if fieldErrors?.parentErrors.father?.email}
              <p class="text-xs font-medium" style="color: var(--color-accent);">{fieldErrors.parentErrors.father.email}</p>
            {/if}
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Mother's Email</span>
            <input
              type="email"
              bind:value={form.mother.email}
              oninput={() => clearParentError('mother', 'email')}
              onblur={() => blurParentField('mother', 'email')}
              aria-invalid={fieldErrors?.parentErrors.mother?.email ? 'true' : undefined}
              placeholder="mother@email.com"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: {borderColor(fieldErrors?.parentErrors.mother?.email != null)}; color: var(--color-text);"
            />
            {#if fieldErrors?.parentErrors.mother?.email}
              <p class="text-xs font-medium" style="color: var(--color-accent);">{fieldErrors.parentErrors.mother.email}</p>
            {/if}
          </label>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold font-heading border-b pb-2" style="border-color: var(--color-border);">Home Address</h2>
        <div class="grid sm:grid-cols-2 gap-4">
          <label class="block space-y-1 sm:col-span-2">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">Street Address {@render req()}</span>
            <input
              type="text"
              bind:value={form.address_line1}
              oninput={() => clearFieldError('address_line1')}
              onblur={() => blurField('address_line1')}
              aria-invalid={fieldErrors?.address_line1 ? 'true' : undefined}
              aria-required="true"
              autocomplete="street-address"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: {borderColor(fieldErrors?.address_line1 != null)}; color: var(--color-text);"
            />
            {#if fieldErrors?.address_line1}
              <p class="text-xs font-medium" style="color: var(--color-accent);">{fieldErrors.address_line1}</p>
            {/if}
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">City {@render req()}</span>
            <input
              type="text"
              bind:value={form.city}
              oninput={() => clearFieldError('city')}
              onblur={() => blurField('city')}
              aria-invalid={fieldErrors?.city ? 'true' : undefined}
              aria-required="true"
              autocomplete="address-level2"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: {borderColor(fieldErrors?.city != null)}; color: var(--color-text);"
            />
            {#if fieldErrors?.city}
              <p class="text-xs font-medium" style="color: var(--color-accent);">{fieldErrors.city}</p>
            {/if}
          </label>
          <label class="block space-y-1">
            <span class="text-sm font-medium" style="color: var(--color-text-muted);">ZIP Code {@render req()}</span>
            <input
              type="text"
              bind:value={form.postal_code}
              oninput={() => clearFieldError('postal_code')}
              onblur={() => blurField('postal_code')}
              aria-invalid={fieldErrors?.postal_code ? 'true' : undefined}
              aria-required="true"
              autocomplete="postal-code"
              placeholder="e.g. 60601"
              class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
              style="border-color: {borderColor(fieldErrors?.postal_code != null)}; color: var(--color-text);"
            />
            {#if fieldErrors?.postal_code}
              <p class="text-xs font-medium" style="color: var(--color-accent);">{fieldErrors.postal_code}</p>
            {/if}
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
          {@const childErr = fieldErrors?.childErrors?.[i] ?? null}
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
              <label class="block space-y-1">
                <span class="text-sm font-medium" style="color: var(--color-text-muted);">Full Name {@render req()}</span>
                <input
                  type="text"
                  bind:value={child.name}
                  oninput={() => clearChildError(i, 'name')}
                  onblur={() => blurChildField(i, 'name')}
                  aria-invalid={childErr?.name ? 'true' : undefined}
                  aria-required="true"
                  placeholder="Full name"
                  class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
                  style="border-color: {borderColor(childErr?.name != null)}; color: var(--color-text);"
                />
                {#if childErr?.name}
                  <p class="text-xs font-medium mt-1" style="color: var(--color-accent);">{childErr.name}</p>
                {/if}
              </label>
              <label class="block space-y-1">
                <span class="text-sm font-medium" style="color: var(--color-text-muted);">Date of Birth {@render req()}</span>
                <input
                  type="date"
                  bind:value={child.dob}
                  oninput={() => clearChildError(i, 'dob')}
                  onblur={() => blurChildField(i, 'dob')}
                  aria-invalid={childErr?.dob ? 'true' : undefined}
                  aria-required="true"
                  class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
                  style="border-color: {borderColor(childErr?.dob != null)}; color: var(--color-text);"
                />
                {#if childErr?.dob}
                  <p class="text-xs font-medium mt-1" style="color: var(--color-accent);">{childErr.dob}</p>
                {/if}
              </label>
              <label class="block space-y-1">
                <span class="text-sm font-medium" style="color: var(--color-text-muted);">Gender {@render req()}</span>
                <select
                  bind:value={child.sex}
                  onchange={() => clearChildError(i, 'sex')}
                  onblur={() => blurChildField(i, 'sex')}
                  aria-invalid={childErr?.sex ? 'true' : undefined}
                  aria-required="true"
                  class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50"
                  style="border-color: {borderColor(childErr?.sex != null)}; color: var(--color-text);"
                >
                  <option value="" disabled>Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                {#if childErr?.sex}
                  <p class="text-xs font-medium mt-1" style="color: var(--color-accent);">{childErr.sex}</p>
                {/if}
              </label>
            </div>
          </div>
        {/each}
      </section>

      <section class="space-y-4">
        <h2 class="text-lg font-semibold font-heading border-b pb-2" style="border-color: var(--color-border);">Payment</h2>

        <div class="grid sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <label class="block space-y-1">
              <span class="text-sm font-medium" style="color: var(--color-text-muted);">Card Holder Name {@render req()}</span>
              <input
                type="text"
                bind:value={form.card_holder_name}
                oninput={() => clearFieldError('card_holder_name')}
                onblur={() => blurField('card_holder_name')}
                aria-invalid={fieldErrors?.card_holder_name ? 'true' : undefined}
                aria-required="true"
                autocomplete="cc-name"
                disabled={needsPayment === false}
                class="w-full rounded-lg px-3 py-2 bg-surface border outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                style="border-color: {borderColor(fieldErrors?.card_holder_name != null)}; color: var(--color-text);"
              />
              {#if fieldErrors?.card_holder_name}
                <p class="text-xs font-medium" style="color: var(--color-accent);">{fieldErrors.card_holder_name}</p>
              {/if}
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
    </form>
  {/if}
</div>
