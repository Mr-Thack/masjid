<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Loader, Check, X, ExternalLink, FlaskConical, Plug } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';
  import ErrorCard from '$lib/components/ErrorCard.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  type Provider = 'square' | 'brevo';

  const PROVIDERS: { id: Provider; label: string; desc: string }[] = [
    { id: 'square', label: 'Square', desc: 'Payment processing for Maktab enrollment' },
    { id: 'brevo', label: 'Brevo (Email)', desc: 'Transactional emails for enrollment confirmations' },
  ];

  let loading = $state(true);
  let saving = $state(false);
  let testing = $state(false);
  let loadError = $state<string | null>(null);
  let selectedProvider = $state<Provider>('square');

  let square = $state({
    access_token: '',
    app_id: '',
    location_id: '',
    configured: false,
  });

  let brevo = $state({
    api_key: '',
    sender_email: '',
    sender_name: '',
    forward_to_email: '',
    logging_email: '',
    bot_name: '',
    configured: false,
  });

  let testResult = $state<{ ok: boolean; message: string; environment?: 'production' | 'sandbox'; hints?: string[] } | null>(null);

  $effect(() => { loadIntegrations(); });

  async function loadIntegrations() {
    loading = true;
    loadError = null;
    try {
      const result = await api.getIntegrations(auth.admin!.masjid_id);
      square = result.square;
      brevo = result.brevo;
    } catch (e: unknown) {
      loadError = e instanceof Error ? e.message : 'Failed to load integrations';
    } finally {
      loading = false;
    }
  }

  async function saveCurrent() {
    saving = true;
    try {
      if (selectedProvider === 'square') {
        const result = await api.updateIntegrations(auth.admin!.masjid_id, { square });
        square = result.square;
        toast.success('Square settings saved');
      } else {
        const result = await api.updateIntegrations(auth.admin!.masjid_id, { brevo });
        brevo = result.brevo;
        toast.success('Email settings saved');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      saving = false;
    }
  }

  async function testCurrent() {
    testing = true;
    testResult = null;
    try {
      let config: Record<string, unknown>;
      if (selectedProvider === 'square') {
        config = {
          access_token: square.access_token,
          app_id: square.app_id,
          location_id: square.location_id,
        };
      } else {
        config = {
          api_key: brevo.api_key,
          sender_email: brevo.sender_email,
          sender_name: brevo.sender_name,
        };
      }
      const result = await api.testIntegration(auth.admin!.masjid_id, selectedProvider, config);
      testResult = result;
      if (result.ok) toast.success('Connection test passed');
      else toast.error('Connection test failed');
    } catch (e: unknown) {
      testResult = { ok: false, message: e instanceof Error ? e.message : 'Test failed' };
      toast.error('Connection test failed');
    } finally {
      testing = false;
    }
  }

  function configuredFor(p: Provider): boolean {
    return p === 'square' ? square.configured : brevo.configured;
  }
</script>

<svelte:head>
  <title>Integrations — {data.masjidSlug}</title>
</svelte:head>

<div class="max-w-2xl space-y-6">
  <h1 class="text-xl font-heading font-semibold text-text">Integrations</h1>
  <p class="text-sm text-text-muted">
    Connect payment and email providers to enable Maktab enrollment.
    Credentials are stored securely and never exposed to visitors.
  </p>

  {#if loading}
    <SkeletonForm rows={4} />
  {:else if loadError}
    <ErrorCard message={loadError} retry={() => loadIntegrations()} />
  {:else}
    <!-- Provider selector -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-text">Provider</label>
      <select
        class="w-full px-3 py-2 border border-border rounded-lg bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        bind:value={selectedProvider}
        onchange={() => testResult = null}
      >
        {#each PROVIDERS as p}
          <option value={p.id}>
            {p.label} {configuredFor(p.id) ? '\u2713' : ''}
          </option>
        {/each}
      </select>
      <p class="text-xs text-text-dim">
        {PROVIDERS.find(p => p.id === selectedProvider)?.desc}
      </p>
    </div>

    {#if selectedProvider === 'square'}
      <!-- Square -->
      <section class="space-y-4 p-5 border border-border rounded-xl bg-surface">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-heading font-semibold text-text">Square Payments</h2>
          {#if square.configured}
            <span class="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
              <Check size={12} /> Configured
            </span>
          {:else}
            <span class="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
              <X size={12} /> Missing
            </span>
          {/if}
        </div>

        <p class="text-xs text-text-muted">
          <a href="https://developer.squareup.com" target="_blank" class="text-accent hover:underline inline-flex items-center gap-0.5">
            Square Developer Dashboard <ExternalLink size={10} />
          </a>
        </p>

        <label class="block space-y-1">
          <span class="text-sm text-text">Access Token</span>
          <input
            type="password"
            class="w-full px-3 py-2 border border-border rounded-lg bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="EAAAE... (sandbox) or production token"
            bind:value={square.access_token}
          />
          <span class="text-xs text-text-dim">
            Never exposed to visitors. Starts with <code>EAAAE</code> for sandbox,
            <code>EAAAl_</code> for production.
          </span>
        </label>

        <label class="block space-y-1">
          <span class="text-sm text-text">Application ID</span>
          <input
            class="w-full px-3 py-2 border border-border rounded-lg bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="sandbox-sq0idb-..."
            bind:value={square.app_id}
          />
        </label>

        <label class="block space-y-1">
          <span class="text-sm text-text">Location ID</span>
          <input
            class="w-full px-3 py-2 border border-border rounded-lg bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="L..."
            bind:value={square.location_id}
          />
        </label>

        <div class="flex items-center gap-3">
          <button
            class="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            disabled={saving || testing}
            onclick={saveCurrent}
          >
            {#if saving}<Loader size={14} class="animate-spin" />{/if}
            Save
          </button>

          <button
            class="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-bg disabled:opacity-50 transition-colors"
            disabled={saving || testing || !square.access_token || !square.location_id}
            onclick={testCurrent}
          >
            {#if testing}<Loader size={14} class="animate-spin" />{:else}<FlaskConical size={14} />{/if}
            Test Connection
          </button>
        </div>

        {#if testResult}
          <div class="p-3 rounded-lg text-sm {testResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}">
            <p>{testResult.ok ? '\u2713' : '\u2717'} {testResult.message}</p>
            {#if testResult.environment}
              <p class="mt-1 text-xs opacity-80">Tested against the {testResult.environment} Square API.</p>
            {/if}
            {#if testResult.hints && testResult.hints.length > 0}
              <ul class="mt-2 space-y-1 text-xs list-disc list-inside">
                {#each testResult.hints as hint}
                  <li>{hint}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </section>
    {:else}
      <!-- Brevo -->
      <section class="space-y-4 p-5 border border-border rounded-xl bg-surface">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-heading font-semibold text-text">Email (Brevo)</h2>
          {#if brevo.configured}
            <span class="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
              <Check size={12} /> Configured
            </span>
          {:else}
            <span class="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
              <X size={12} /> Missing
            </span>
          {/if}
        </div>

        <p class="text-xs text-text-muted">
          <a href="https://app.brevo.com/settings/keys/api" target="_blank" class="text-accent hover:underline inline-flex items-center gap-0.5">
            Brevo API Keys <ExternalLink size={10} />
          </a>
        </p>

        <label class="block space-y-1">
          <span class="text-sm text-text">API Key</span>
          <input
            type="password"
            class="w-full px-3 py-2 border border-border rounded-lg bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="xkeysib-..."
            bind:value={brevo.api_key}
          />
        </label>

        <label class="block space-y-1">
          <span class="text-sm text-text">Sender Email</span>
          <input
            type="email"
            class="w-full px-3 py-2 border border-border rounded-lg bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="automated@yourmasjid.com"
            bind:value={brevo.sender_email}
          />
          <span class="text-xs text-text-dim">Must be a verified sender in your Brevo account.</span>
        </label>

        <label class="block space-y-1">
          <span class="text-sm text-text">Sender Name</span>
          <input
            class="w-full px-3 py-2 border border-border rounded-lg bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="Masjid Maktab"
            bind:value={brevo.sender_name}
          />
        </label>

        <details class="mt-3">
          <summary class="text-sm text-text-muted cursor-pointer hover:text-text">Advanced options</summary>
          <div class="mt-3 space-y-3 pl-1">
            <label class="block space-y-1">
              <span class="text-sm text-text">Forward/Reply-To Email</span>
              <input
                type="email"
                class="w-full px-3 py-2 border border-border rounded-lg bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="info@yourmasjid.com"
                bind:value={brevo.forward_to_email}
              />
            </label>

            <label class="block space-y-1">
              <span class="text-sm text-text">Logging Email (BCC)</span>
              <input
                type="email"
                class="w-full px-3 py-2 border border-border rounded-lg bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="logs@yourmasjid.com"
                bind:value={brevo.logging_email}
              />
            </label>

            <label class="block space-y-1">
              <span class="text-sm text-text">Bot Name (mailer header)</span>
              <input
                class="w-full px-3 py-2 border border-border rounded-lg bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="masjid-api/1.0"
                bind:value={brevo.bot_name}
              />
            </label>
          </div>
        </details>

        <div class="flex items-center gap-3">
          <button
            class="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            disabled={saving || testing}
            onclick={saveCurrent}
          >
            {#if saving}<Loader size={14} class="animate-spin" />{/if}
            Save
          </button>

          <button
            class="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-bg disabled:opacity-50 transition-colors"
            disabled={saving || testing || !brevo.api_key}
            onclick={testCurrent}
          >
            {#if testing}<Loader size={14} class="animate-spin" />{:else}<FlaskConical size={14} />{/if}
            Test Connection
          </button>
        </div>

        {#if testResult}
          <div class="p-3 rounded-lg text-sm {testResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}">
            <p>{testResult.ok ? '\u2713' : '\u2717'} {testResult.message}</p>
            {#if testResult.hints && testResult.hints.length > 0}
              <ul class="mt-2 space-y-1 text-xs list-disc list-inside">
                {#each testResult.hints as hint}
                  <li>{hint}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </section>
    {/if}
  {/if}
</div>