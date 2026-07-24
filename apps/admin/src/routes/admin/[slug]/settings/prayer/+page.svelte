<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Loader, Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Play } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let rules = $state<unknown[]>([]);
  let showAdd = $state(false);
  let editingId = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);

  let newRule = $state({ prayer_name: 'fajr', rule_name: '', execution_order: 0, conditions_json: [{ type: 'always' }], action_json: { type: 'add_minutes', minutes: 10 } });
  let editRule = $state<Record<string, unknown>>({});

  let dryRunDate = $state('');
  let dryRunResult = $state<Record<string, unknown> | null>(null);
  let showDryRun = $state(false);
  let runningDryRun = $state(false);

  const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const actionTypes = ['add_minutes', 'round_up', 'round_down', 'round_nearest', 'set_fixed_time', 'right_after_adhaan'];
  const conditionTypes = ['always', 'day_of_week', 'month', 'hijri_month', 'date_range'];

  $effect(() => { loadRules(); });

  async function loadRules() {
    try {
      const res = await api.getPrayerRules(auth.admin!.masjid_id);
      rules = res.rules || [];
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load rules';
    } finally {
      loading = false;
    }
  }

  async function addRule(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      await api.createPrayerRule(auth.admin!.masjid_id, {
        ...newRule,
        execution_order: rules.length,
      });
      showAdd = false;
      newRule = { prayer_name: 'fajr', rule_name: '', execution_order: 0, conditions_json: [{ type: 'always' }], action_json: { type: 'add_minutes', minutes: 10 } };
      toast.success('Rule added');
      await loadRules();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  async function saveEdit(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      await api.updatePrayerRule(auth.admin!.masjid_id, editingId!, editRule);
      editingId = null;
      toast.success('Rule updated');
      await loadRules();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  async function deleteRule() {
    if (!confirmDeleteId) return;
    try {
      await api.deletePrayerRule(auth.admin!.masjid_id, confirmDeleteId);
      toast.success('Rule deleted');
      confirmDeleteId = null;
      await loadRules();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function moveRule(index: number, dir: number) {
    const newRules = [...rules];
    const target = index + dir;
    if (target < 0 || target >= newRules.length) return;
    [newRules[index], newRules[target]] = [newRules[target], newRules[index]];
    const order = newRules.map((r: any) => r.id);
    try {
      await api.reorderPrayerRules(auth.admin!.masjid_id, order);
      await loadRules();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function runDryRun() {
    runningDryRun = true;
    try {
      const result = await api.dryRunPrayerTimes(auth.admin!.masjid_id, {
        date: dryRunDate || undefined,
      });
      dryRunResult = result;
      toast.success('Dry run complete');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      runningDryRun = false;
    }
  }

  function startEdit(rule: any) {
    editingId = rule.id;
    editRule = {
      prayer_name: rule.prayer_name,
      rule_name: rule.rule_name,
      execution_order: rule.execution_order,
      conditions_json: rule.conditions_json,
      action_json: rule.action_json,
    };
  }

  function conditionSummary(c: any): string {
    if (c.type === 'always') return 'Always';
    if (c.type === 'day_of_week') return `Days: ${(c.days || []).join(', ')}`;
    if (c.type === 'month') return `Months: ${(c.months || []).join(', ')}`;
    if (c.type === 'hijri_month') return `Hijri: ${(c.months || []).join(', ')}`;
    if (c.type === 'date_range') return `${c.start} – ${c.end}`;
    return c.type;
  }

  function actionSummary(a: any): string {
    if (a.type === 'add_minutes') return `+${a.minutes}m`;
    if (a.type === 'round_up') return `Round up ${a.increment}m`;
    if (a.type === 'round_down') return `Round down ${a.increment}m`;
    if (a.type === 'round_nearest') return `Round nearest ${a.increment}m`;
    if (a.type === 'set_fixed_time') return `Set ${a.time}`;
    if (a.type === 'right_after_adhaan') return 'Right after Adhaan';
    return a.type;
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-heading font-bold">Prayer Rules</h1>
      <p class="text-text-muted text-sm mt-1">Define iqaamah adjustment rules</p>
    </div>
    <button class="btn-primary text-sm" onclick={() => showAdd = !showAdd}>
      <Plus size={16} />
      Add Rule
    </button>
  </div>

  {#if loading}
    <SkeletonForm fields={4} />
  {:else}
    {#if showAdd}
      <form onsubmit={addRule} class="bg-surface border border-border rounded-xl p-4 mb-4 space-y-3">
        <h3 class="font-heading font-semibold text-sm">New Rule</h3>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="form-group">
            <label>Prayer</label>
            <select class="w-full text-sm" bind:value={newRule.prayer_name}>
              {#each prayers as p}
                <option value={p}>{p}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label>Rule Name</label>
            <input type="text" class="w-full text-sm" bind:value={newRule.rule_name} placeholder="e.g. Weekday delay" />
          </div>
          <div class="form-group">
            <label>Action Type</label>
            <select class="w-full text-sm" bind:value={newRule.action_json.type}>
              {#each actionTypes as a}
                <option value={a}>{a}</option>
              {/each}
            </select>
          </div>
          {#if newRule.action_json.type === 'add_minutes'}
            <div class="form-group">
              <label>Minutes</label>
              <input type="number" class="w-full text-sm" bind:value={newRule.action_json.minutes} min="1" />
            </div>
          {:else if newRule.action_json.type === 'set_fixed_time'}
            <div class="form-group">
              <label>Fixed Time (HH:MM)</label>
              <input type="text" class="w-full text-sm" bind:value={newRule.action_json.time} placeholder="13:30" />
            </div>
          {:else if ['round_up', 'round_down', 'round_nearest'].includes(newRule.action_json.type)}
            <div class="form-group">
              <label>Increment</label>
              <select class="w-full text-sm" bind:value={newRule.action_json.increment}>
                <option value={1}>1m</option>
                <option value={5}>5m</option>
                <option value={10}>10m</option>
                <option value={15}>15m</option>
                <option value={20}>20m</option>
                <option value={30}>30m</option>
                <option value={60}>60m</option>
              </select>
            </div>
          {/if}
        </div>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary text-sm" disabled={saving}>Add</button>
          <button type="button" class="btn-secondary text-sm" onclick={() => showAdd = false}>Cancel</button>
        </div>
      </form>
    {/if}

    {#if rules.length === 0}
      <div class="bg-surface border border-border rounded-xl p-8 text-center">
        <p class="text-text-muted">No prayer rules defined yet.</p>
      </div>
    {:else}
      <div class="bg-surface border border-border rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border">
              <th class="text-left p-3 text-text-muted font-medium">Order</th>
              <th class="text-left p-3 text-text-muted font-medium">Prayer</th>
              <th class="text-left p-3 text-text-muted font-medium">Name</th>
              <th class="text-left p-3 text-text-muted font-medium">Conditions</th>
              <th class="text-left p-3 text-text-muted font-medium">Action</th>
              <th class="text-right p-3 text-text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each rules as rule, i (rule.id)}
              <tr class="border-b border-border last:border-0 hover:bg-bg/50">
                <td class="p-3">
                  <div class="flex items-center gap-1">
                    <button class="p-0.5 text-text-muted hover:text-text" disabled={i === 0} onclick={() => moveRule(i, -1)}>
                      <ChevronUp size={14} />
                    </button>
                    <button class="p-0.5 text-text-muted hover:text-text" disabled={i === rules.length - 1} onclick={() => moveRule(i, 1)}>
                      <ChevronDown size={14} />
                    </button>
                    <span class="ml-1 text-text-muted text-xs">{i}</span>
                  </div>
                </td>
                <td class="p-3">
                  <span class="badge badge-purple capitalize">{rule.prayer_name}</span>
                </td>
                <td class="p-3 font-medium">{rule.rule_name}</td>
                <td class="p-3 text-text-muted text-xs">
                  {(rule.conditions_json || []).map((c: any) => conditionSummary(c)).join(', ')}
                </td>
                <td class="p-3">
                  <span class="badge badge-blue">{actionSummary(rule.action_json)}</span>
                </td>
                <td class="p-3 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button class="btn-secondary text-xs py-1 px-2" onclick={() => startEdit(rule)}>Edit</button>
                    <button class="p-1 text-red-400 hover:text-red-300" onclick={() => confirmDeleteId = rule.id}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if editingId}
        <form onsubmit={saveEdit} class="bg-surface border border-accent rounded-xl p-4 mt-4 space-y-3">
          <h3 class="font-heading font-semibold text-sm">Edit Rule</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
              <label>Prayer</label>
              <select class="w-full text-sm" bind:value={editRule.prayer_name}>
                {#each prayers as p}
                  <option value={p}>{p}</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label>Rule Name</label>
              <input type="text" class="w-full text-sm" bind:value={editRule.rule_name} />
            </div>
          </div>
          <div class="flex gap-2">
            <button type="submit" class="btn-primary text-sm" disabled={saving}>Save</button>
            <button type="button" class="btn-secondary text-sm" onclick={() => editingId = null}>Cancel</button>
          </div>
        </form>
      {/if}
    {/if}

    <!-- Dry Run -->
    <div class="bg-surface border border-border rounded-xl p-5 mt-6">
      <button class="flex items-center gap-2 text-text-muted hover:text-text text-sm" onclick={() => showDryRun = !showDryRun}>
        <Play size={16} />
        Dry-Run Simulator
      </button>
      {#if showDryRun}
        <div class="mt-4 space-y-3">
          <div class="flex gap-3 items-end">
            <div class="form-group flex-1">
              <label>Date (optional, defaults to today)</label>
              <input type="date" class="w-full text-sm" bind:value={dryRunDate} />
            </div>
            <button class="btn-primary text-sm" disabled={runningDryRun} onclick={runDryRun}>
              {runningDryRun ? 'Running...' : 'Run'}
            </button>
          </div>
          {#if dryRunResult}
            <div class="bg-bg rounded-lg p-4 font-mono text-xs text-text-muted whitespace-pre overflow-x-auto">
              {JSON.stringify(dryRunResult, null, 2)}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<ConfirmDialog
  open={confirmDeleteId !== null}
  title="Delete Rule"
  message="This will permanently delete this prayer rule."
  onConfirm={deleteRule}
  onCancel={() => confirmDeleteId = null}
/>
