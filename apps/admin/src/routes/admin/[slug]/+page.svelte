<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Loader, Plus, ExternalLink, Sparkles, Check, TriangleAlert } from 'lucide-svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let profile = $state<Record<string, unknown> | null>(null);
  let announcements = $state<unknown[]>([]);
  let posts = $state<unknown[]>([]);
  let jumuahSessions = $state<unknown[]>([]);
  let rules = $state<unknown[]>([]);
  let domains = $state<{ domain: unknown | null }>({ domain: null });
  let prayerConfig = $state<{ calculation_method: number; timezone: string }>({ calculation_method: 2, timezone: 'America/Chicago' });
  let branches = $state<unknown[]>([]);
  let prayerHealth = $state<{ healthy: boolean; failingDates: string[] } | null>(null);

  $effect(() => {
    loadDashboard();
  });

  async function loadDashboard() {
    try {
      const masjidId = auth.admin!.masjid_id;
      const [p, a, j, r, d, pc] = await Promise.all([
        api.getProfile(masjidId),
        api.getAnnouncements(masjidId),
        api.getJumuah(masjidId),
        api.getPrayerRules(masjidId),
        api.getDomains(masjidId).catch(() => ({ domain: null })),
        api.getPrayerConfig(masjidId),
      ]);
      profile = p;
      announcements = a.announcements || [];
      jumuahSessions = j.sessions || [];
      rules = r.rules || [];
      domains = d;
      prayerConfig = pc;
      try {
        const ps = await api.getPosts(masjidId);
        posts = ps.posts || [];
      } catch {
        posts = [];
      }
      try {
        const b = await api.getBranches(masjidId);
        branches = b.branches || [];
      } catch {
        branches = [];
      }
      try {
        prayerHealth = await api.getPrayerHealth(masjidId);
      } catch {
        prayerHealth = null;
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load dashboard';
    } finally {
      loading = false;
    }
  }

  const activeBranches = $derived(branches.filter((b: any) => b.status === 'OPEN'));
  const activeAnnouncements = $derived(announcements.filter((a: any) => a.status === 'published'));
  const publicPageUrl = $derived(`http://localhost:5175/${data.masjidSlug}`);
</script>

{#if loading}
  <div class="flex items-center justify-center py-20">
    <Loader class="animate-spin text-accent" size={32} />
  </div>
{:else if error}
  <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{error}</div>
{:else}
  <div class="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
    <h1 class="text-2xl font-heading font-bold">{profile?.name || 'Dashboard'}</h1>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <div class="bg-surface border border-border rounded-xl p-4">
        <p class="text-3xl font-bold text-text">{activeAnnouncements.length}</p>
        <p class="text-sm text-text-muted mt-1">Announcements</p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4">
        <p class="text-3xl font-bold text-text">{posts.length}</p>
        <p class="text-sm text-text-muted mt-1">Posts</p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4">
        <p class="text-3xl font-bold text-text">{jumuahSessions.length}</p>
        <p class="text-sm text-text-muted mt-1">Jumu'ah Sessions</p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4">
        <p class="text-3xl font-bold text-text">{rules.length}</p>
        <p class="text-sm text-text-muted mt-1">Prayer Rules</p>
      </div>
      <div class="bg-surface border border-border rounded-xl p-4">
        <p class="text-3xl font-bold text-amber-400">{activeBranches.length}</p>
        <p class="text-sm text-text-muted mt-1">Active Branches</p>
      </div>
    </div>

    <!-- Status chips + Quick info -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Status pane -->
      <div class="bg-surface border border-border rounded-xl p-5 space-y-3">
        <h2 class="font-heading font-semibold text-sm text-text-muted uppercase tracking-wider">Service Status</h2>
        <div class="flex flex-wrap gap-3">
          <span class="badge badge-green">
            <span class="w-2 h-2 rounded-full bg-green-500"></span>
            WhatsApp Configurable
          </span>
          {#if domains.domain}
            <span class="badge badge-green">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              Domain: {domains.domain.domain}
            </span>
          {:else}
            <span class="badge badge-grey">
              <span class="w-2 h-2 rounded-full bg-gray-500"></span>
              No Custom Domain
            </span>
          {/if}
        </div>
      </div>

      <!-- Display Health -->
      {#if prayerHealth !== null}
        <div class="bg-surface border border-border rounded-xl p-5 space-y-3">
          <h2 class="font-heading font-semibold text-sm text-text-muted uppercase tracking-wider">Display Health</h2>
          {#if prayerHealth.healthy}
            <div class="flex items-center gap-2 text-green-400">
              <Check size={18} />
              <span class="text-sm font-medium">All 30 days valid</span>
            </div>
          {:else}
            <div class="flex items-start gap-2 text-amber-400">
              <TriangleAlert size={18} class="mt-0.5 shrink-0" />
              <div>
                <p class="text-sm font-medium">{prayerHealth.failingDates.length} day{prayerHealth.failingDates.length > 1 ? 's' : ''} failing</p>
                <p class="text-xs text-text-muted mt-1">{prayerHealth.failingDates.join(', ')}</p>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="bg-surface border border-border rounded-xl p-5 space-y-3">
          <h2 class="font-heading font-semibold text-sm text-text-muted uppercase tracking-wider">Display Health</h2>
          <p class="text-sm text-text-muted">Unable to check</p>
        </div>
      {/if}
    </div>

    <!-- Active branches -->
    {#if activeBranches.length > 0}
      <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        <p class="text-amber-400 text-sm font-medium">
          Active config session — {activeBranches.length} branch{activeBranches.length > 1 ? 'es' : ''} open
        </p>
      </div>
    {/if}

    <!-- Quick actions -->
    <div class="bg-surface border border-border rounded-xl p-5">
      <h2 class="font-heading font-semibold text-sm text-text-muted uppercase tracking-wider mb-4">Quick Actions</h2>
      <div class="flex flex-wrap gap-3">
        <a href="/admin/{data.masjidSlug}/settings/announcements" class="btn-primary text-sm">
          <Plus size={16} />
          New Announcement
        </a>
        <a href="/admin/{data.masjidSlug}/bot" class="btn-secondary text-sm">
          <Sparkles size={16} />
          Chat with AI
        </a>
        <a href={publicPageUrl} target="_blank" rel="noopener" class="btn-secondary text-sm">
          <ExternalLink size={16} />
          View Public Page
        </a>
      </div>
    </div>
  </div>
{/if}
