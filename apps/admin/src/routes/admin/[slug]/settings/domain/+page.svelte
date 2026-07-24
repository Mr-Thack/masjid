<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Loader, Plus, Trash2, Globe, Check, Clock } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let domain = $state<Record<string, unknown> | null>(null);
  let showAdd = $state(false);
  let confirmDelete = $state(false);

  let newDomain = $state('');

  $effect(() => { load(); });

  async function load() {
    try {
      const res = await api.getDomains(auth.admin!.masjid_id);
      domain = res.domain;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      loading = false;
    }
  }

  async function add(e: Event) {
    e.preventDefault();
    if (!newDomain.trim()) return;
    saving = true;
    try {
      const res = await api.createDomain(auth.admin!.masjid_id, { domain: newDomain.trim().toLowerCase() });
      showAdd = false;
      newDomain = '';
      domain = res.domain;
      toast.success('Domain added');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!domain) return;
    saving = true;
    try {
      await api.deleteDomain(auth.admin!.masjid_id, domain.id as string);
      domain = null;
      confirmDelete = false;
      toast.success('Domain removed');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  function sslColor(status: string) {
    if (status === 'active') return 'badge-green';
    if (status === 'pending') return 'badge-yellow';
    return 'badge-grey';
  }
</script>

<div class="max-w-3xl mx-auto">
  <h1 class="text-2xl font-heading font-bold mb-2">Domain</h1>
  <p class="text-text-muted text-sm mb-6">Custom domain for your masjid's public page</p>

  {#if loading}
    <SkeletonForm fields={2} />
  {:else}
    {#if domain}
      <div class="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Globe size={20} class="text-accent" />
            <div>
              <p class="font-medium text-lg">{domain.domain}</p>
              <p class="text-xs text-text-muted">Added {domain.created_at ? new Date(domain.created_at as string).toLocaleDateString() : '—'}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge {sslColor(domain.ssl_status as string)}">
              {#if domain.ssl_status === 'active'}
                <Check size={12} />
              {:else if domain.ssl_status === 'pending'}
                <Clock size={12} />
              {/if}
              SSL: {domain.ssl_status || 'unknown'}
            </span>
            <button class="btn-danger text-sm" onclick={() => confirmDelete = true}>
              <Trash2 size={14} />
              Remove
            </button>
          </div>
        </div>

        {#if domain.ssl_status === 'pending'}
          <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-400">
            SSL certificate is being provisioned. This may take a few minutes.
          </div>
        {/if}
        {#if domain.verified_at}
          <p class="text-xs text-green-400">
            <Check size={12} class="inline" /> Verified {new Date(domain.verified_at as string).toLocaleDateString()}
          </p>
        {/if}
      </div>
    {:else}
      <div class="bg-surface border border-border rounded-xl p-6">
        {#if showAdd}
          <form onsubmit={add} class="space-y-3">
            <h3 class="font-heading font-semibold text-sm">Add Custom Domain</h3>
            <p class="text-xs text-text-muted">Enter the FQDN you want to use (e.g. prayers.mymasjid.org). DNS must be configured to point to our servers.</p>
            <div class="form-group">
              <label>Domain (FQDN)</label>
              <input
                type="text"
                class="w-full"
                bind:value={newDomain}
                placeholder="prayers.mymasjid.org"
                required
              />
            </div>
            <div class="flex gap-2">
              <button type="submit" class="btn-primary text-sm" disabled={saving}>Add Domain</button>
              <button type="button" class="btn-secondary text-sm" onclick={() => showAdd = false}>Cancel</button>
            </div>
          </form>
        {:else}
          <div class="text-center py-6">
            <Globe size={32} class="mx-auto mb-3 text-text-muted" />
            <p class="text-text-muted mb-4">No custom domain configured</p>
            <button class="btn-primary text-sm" onclick={() => showAdd = true}>
              <Plus size={16} />
              Add Domain
            </button>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<ConfirmDialog
  open={confirmDelete}
  title="Remove Domain"
  message="This will remove the custom domain. Your public page will still be accessible via the default URL."
  onConfirm={remove}
  onCancel={() => confirmDelete = false}
/>
