<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { BookOpen, Users, ExternalLink } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';
  import ErrorCard from '$lib/components/ErrorCard.svelte';

  type Term = {
    id: string;
    name: string;
    length_months: number;
    prices: { '1': number; '2': number; '3plus': number };
  };

  type Registration = {
    id: string;
    status: string;
    monthly_amount_cents: number;
    father_name: string | null;
    mother_name: string | null;
    father_email: string | null;
    mother_email: string | null;
    created_at: string;
  };

  let masjidSlug = $derived($page.params.slug);
  let masjidId = $derived(auth.admin?.masjid_id ?? '');

  let loading = $state(true);
  let settings = $state<{ enrollment_open: boolean; active_term: Term | null; status_message: string | null } | null>(null);
  let terms = $state<Term[]>([]);
  let registrations = $state<Registration[]>([]);
  let error = $state<string | null>(null);

  let saving = $state(false);
  let creating = $state(false);

  let settingsForm = $state({
    enrollment_open: false,
    status_message: '',
    active_term_id: '',
  });

  let newTerm = $state({
    name: '',
    length_months: 1,
    price_1: '',
    price_2: '',
    price_3plus: '',
  });

  $effect(() => {
    loadAll();
  });

  async function loadAll() {
    if (!masjidId) return;
    loading = true;
    error = null;
    try {
      const [settingsRes, termsRes, registrationsRes] = await Promise.all([
        api.getMaktabSettings(masjidId),
        api.listMaktabTerms(masjidId),
        api.listMaktabRegistrations(masjidId),
      ]);
      settings = settingsRes;
      terms = termsRes.terms ?? [];
      registrations = registrationsRes.registrations ?? [];
      settingsForm = {
        enrollment_open: settingsRes.enrollment_open,
        status_message: settingsRes.status_message ?? '',
        active_term_id: settingsRes.active_term?.id ?? '',
      };
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load Maktab settings';
    } finally {
      loading = false;
    }
  }

  async function saveSettings(e: Event) {
    e.preventDefault();
    if (!settings) return;
    saving = true;
    error = null;
    try {
      await api.updateMaktabSettings(masjidId, {
        enrollment_open: settingsForm.enrollment_open,
        status_message: settingsForm.status_message || null,
        active_term_id: settingsForm.active_term_id || null,
      });
      toast.success('Maktab settings saved');
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to save settings';
      toast.error('Failed to save');
    } finally {
      saving = false;
    }
  }

  async function activateTerm(id: string) {
    try {
      await api.activateMaktabTerm(masjidId, id);
      toast.success('Term activated');
      await loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Activation failed');
    }
  }

  async function createTerm(e: Event) {
    e.preventDefault();
    if (!newTerm.name || !newTerm.price_1 || !newTerm.price_2 || !newTerm.price_3plus) return;
    creating = true;
    try {
      await api.createMaktabTerm(masjidId, {
        name: newTerm.name,
        length_months: Number(newTerm.length_months),
        price_cents_1: Math.round(Number(newTerm.price_1) * 100),
        price_cents_2: Math.round(Number(newTerm.price_2) * 100),
        price_cents_3plus: Math.round(Number(newTerm.price_3plus) * 100),
      });
      toast.success('Term created');
      newTerm = { name: '', length_months: 1, price_1: '', price_2: '', price_3plus: '' };
      await loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create term');
    } finally {
      creating = false;
    }
  }

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
</script>

<svelte:head>
  <title>Maktab Settings — Admin</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center gap-3 mb-2">
    <BookOpen class="text-accent" size={28} />
    <h1 class="text-2xl font-heading font-bold">Maktab Settings</h1>
  </div>
  <p class="text-text-muted text-sm mb-6">Manage enrollment terms, pricing, and registrations.</p>

  {#if loading}
    <SkeletonForm fields={8} />
  {:else if error}
    <ErrorCard message={error} onRetry={loadAll} />
  {:else}
    <div class="space-y-6">
      <form onsubmit={saveSettings} class="bg-surface border border-border rounded-xl p-6 space-y-6">
        <h2 class="font-heading font-semibold text-text">Enrollment</h2>

        <div class="flex flex-col sm:flex-row gap-6 items-start">
          <div class="flex items-center gap-3">
            <input
              id="enrollment_open"
              type="checkbox"
              bind:checked={settingsForm.enrollment_open}
              class="w-5 h-5 rounded border-border text-accent bg-bg"
            />
            <label for="enrollment_open" class="text-sm text-text">
              Enrollment is open
            </label>
          </div>

          <div class="flex-1 w-full">
            <label for="status_message" class="block text-sm text-text-muted mb-1">Closed message (optional)</label>
            <input
              id="status_message"
              type="text"
              bind:value={settingsForm.status_message}
              placeholder="Displayed when enrollment is closed"
              class="w-full"
            />
          </div>
        </div>

        <div>
          <label for="active_term_id" class="block text-sm text-text-muted mb-1">Active Term</label>
          <select id="active_term_id" class="w-full" bind:value={settingsForm.active_term_id}>
            <option value="">— No active term —</option>
            {#each terms as term}
              <option value={term.id}>{term.name}</option>
            {/each}
          </select>
          {#if settings?.active_term}
            <p class="text-xs text-text-muted mt-1">Currently active: {settings.active_term.name}</p>
          {/if}
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-border">
          <a
            href="/{masjidSlug}/maktab/enroll"
            target="_blank"
            class="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Open enrollment form <ExternalLink size={14} />
          </a>
          <button type="submit" class="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      <div class="bg-surface border border-border rounded-xl p-6">
        <h2 class="font-heading font-semibold text-text mb-4">Terms</h2>

        {#if terms.length === 0}
          <p class="text-text-muted text-sm mb-4">No terms created yet.</p>
        {:else}
          <div class="overflow-x-auto mb-6">
            <table class="w-full text-sm">
              <thead class="border-b border-border text-text-muted">
                <tr>
                  <th class="text-left py-2 pr-4">Name</th>
                  <th class="text-left py-2 pr-4">Length</th>
                  <th class="text-left py-2 pr-4">1 child</th>
                  <th class="text-left py-2 pr-4">2 children</th>
                  <th class="text-left py-2 pr-4">3+ children</th>
                  <th class="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody class="text-text">
                {#each terms as term}
                  <tr class="border-b border-border/50 last:border-0">
                    <td class="py-3 pr-4 font-medium">{term.name}</td>
                    <td class="py-3 pr-4">{term.length_months} mo</td>
                    <td class="py-3 pr-4">{formatCents(term.prices['1'])}</td>
                    <td class="py-3 pr-4">{formatCents(term.prices['2'])}</td>
                    <td class="py-3 pr-4">{formatCents(term.prices['3plus'])}</td>
                    <td class="py-3">
                      <button
                        type="button"
                        class="btn-secondary text-xs"
                        onclick={() => activateTerm(term.id)}
                        disabled={settings?.active_term?.id === term.id}
                      >
                        {settings?.active_term?.id === term.id ? 'Active' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        <form onsubmit={createTerm} class="border-t border-border pt-6">
          <h3 class="font-heading font-semibold text-text mb-3">Create New Term</h3>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div class="form-group sm:col-span-2 lg:col-span-3">
              <label for="term_name">Term Name</label>
              <input id="term_name" type="text" bind:value={newTerm.name} placeholder="e.g. 2026–2027 Academic Year" class="w-full" />
            </div>
            <div class="form-group">
              <label for="term_length">Length (months)</label>
              <input id="term_length" type="number" min="1" max="12" bind:value={newTerm.length_months} class="w-full" />
            </div>
            <div class="form-group">
              <label for="price_1">Price: 1 child</label>
              <input id="price_1" type="number" step="0.01" min="0" bind:value={newTerm.price_1} class="w-full" />
            </div>
            <div class="form-group">
              <label for="price_2">Price: 2 children</label>
              <input id="price_2" type="number" step="0.01" min="0" bind:value={newTerm.price_2} class="w-full" />
            </div>
            <div class="form-group">
              <label for="price_3plus">Price: 3+ children</label>
              <input id="price_3plus" type="number" step="0.01" min="0" bind:value={newTerm.price_3plus} class="w-full" />
            </div>
          </div>
          <button type="submit" class="btn-primary mt-4" disabled={creating}>
            {creating ? 'Creating...' : 'Create Term'}
          </button>
        </form>
      </div>

      <div class="bg-surface border border-border rounded-xl p-6">
        <div class="flex items-center gap-2 mb-4">
          <Users class="text-accent" size={20} />
          <h2 class="font-heading font-semibold text-text">Registrations ({registrations.length})</h2>
        </div>

        {#if registrations.length === 0}
          <p class="text-text-muted text-sm">No registrations yet.</p>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="border-b border-border text-text-muted">
                <tr>
                  <th class="text-left py-2 pr-4">Date</th>
                  <th class="text-left py-2 pr-4">Parent</th>
                  <th class="text-left py-2 pr-4">Status</th>
                  <th class="text-left py-2">Monthly</th>
                </tr>
              </thead>
              <tbody class="text-text">
                {#each registrations as reg}
                  <tr class="border-b border-border/50 last:border-0">
                    <td class="py-3 pr-4">{formatDate(reg.created_at)}</td>
                    <td class="py-3 pr-4">
                      {reg.father_name || reg.mother_name || '—'}
                      <div class="text-xs text-text-muted">{reg.father_email || reg.mother_email || ''}</div>
                    </td>
                    <td class="py-3 pr-4 capitalize">{reg.status}</td>
                    <td class="py-3">{formatCents(reg.monthly_amount_cents)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
