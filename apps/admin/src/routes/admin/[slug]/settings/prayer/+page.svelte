<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Plus, Trash2, Play, Copy, Eye, EyeOff, ToggleLeft, ToggleRight, TriangleAlert } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import RuleForm from '$lib/components/RuleForm.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let previewLoading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let rules = $state<any[]>([]);
  let previewData = $state<any>(null);
  let editingId = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);
  let showAddPrayer = $state<string | null>(null);
  let showPipeline = $state<Record<string, boolean>>({});
  let togglingRuleIds = $state<Set<string>>(new Set());
  let prayerHealth = $state<{ healthy: boolean; failingDates: string[] } | null>(null);

  function defaultNewRule(prayer: string) {
    return {
      prayer_name: prayer,
      rule_name: '',
      execution_order: 0,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'add_minutes', minutes: 10 },
      enabled: true,
    };
  }

  let newRule = $state(defaultNewRule('fajr'));
  let editRule = $state<any>({});

  const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const groupedRules = $derived(
    Object.fromEntries(prayers.map(p => [p, rules.filter(r => r.prayer_name === p)]))
  );

  const chainMap = $derived.by(() => {
    const map: Record<string, any> = {};
    if (!previewData?.chains) return map;
    for (const prayer of prayers) {
      const chain = previewData.chains[prayer];
      if (!chain?.rules) continue;
      for (const entry of chain.rules) {
        map[entry.id] = entry;
      }
    }
    return map;
  });

  const prayerChains = $derived.by(() => {
    const chains: Record<string, any> = {};
    if (!previewData?.chains) return chains;
    for (const prayer of prayers) {
      chains[prayer] = previewData.chains[prayer] ?? null;
    }
    return chains;
  });

  let dryRunDate = $state('');
  let dryRunResult = $state<any>(null);
  let dryRunError = $state<string | null>(null);
  let showDryRun = $state(false);
  let runningDryRun = $state(false);

  $effect(() => { loadRules(); loadPreview(); loadHealth(); });

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

  async function loadPreview() {
    try {
      previewData = await api.getPrayerRulesPreview(auth.admin!.masjid_id);
    } catch {
      // preview is non-critical — silently ignore
    } finally {
      previewLoading = false;
    }
  }

  async function loadHealth() {
    try {
      prayerHealth = await api.getPrayerHealth(auth.admin!.masjid_id);
    } catch {
      prayerHealth = null;
    }
  }

  function startAdd(prayer: string) {
    showAddPrayer = prayer;
    newRule = defaultNewRule(prayer);
    editingId = null;
  }

  function duplicateRule(rule: any) {
    const group = rules.filter((r: any) => r.prayer_name === rule.prayer_name);
    const maxOrder = group.length > 0 ? Math.max(...group.map((r: any) => r.execution_order)) : -1;
    showAddPrayer = rule.prayer_name;
    editingId = null;
    newRule = {
      prayer_name: rule.prayer_name,
      rule_name: `Copy of ${rule.rule_name || 'rule'}`,
      execution_order: maxOrder + 1,
      conditions_json: (rule.conditions_json || []).map((c: any) => ({ ...c })),
      action_json: { ...rule.action_json },
      enabled: true,
    };
    window.scrollTo({ top: document.querySelector('.bg-surface.border')?.getBoundingClientRect().top! + window.scrollY - 100, behavior: 'smooth' });
  }

  async function addRule(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      const group = rules.filter((r: any) => r.prayer_name === newRule.prayer_name);
      const maxOrder = group.length > 0 ? Math.max(...group.map((r: any) => r.execution_order)) : -1;
      const res = await api.createPrayerRule(auth.admin!.masjid_id, {
        ...newRule,
        execution_order: maxOrder + 1,
      });
      showAddPrayer = null;
      if (res.warning) {
        toast.warning(res.warning, { duration: 8000 });
      } else {
        toast.success('Rule added');
      }
      await loadRules();
      await loadPreview();
      await loadHealth();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  function startEdit(rule: any) {
    editingId = rule.id;
    showAddPrayer = null;
    editRule = {
      ...rule,
      conditions_json: (rule.conditions_json || []).map((c: any) => ({ ...c })),
      action_json: { ...rule.action_json },
      enabled: rule.enabled !== false,
    };
  }

  async function saveEdit(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      const res = await api.updatePrayerRule(auth.admin!.masjid_id, editingId!, {
        prayer_name: editRule.prayer_name,
        rule_name: editRule.rule_name,
        conditions_json: editRule.conditions_json,
        action_json: editRule.action_json,
        enabled: editRule.enabled,
      });
      editingId = null;
      if (res.warning) {
        toast.warning(res.warning, { duration: 8000 });
      } else {
        toast.success('Rule updated');
      }
      await loadRules();
      await loadPreview();
      await loadHealth();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      saving = false;
    }
  }

  async function deleteRule() {
    if (!confirmDeleteId) return;
    try {
      const res = await api.deletePrayerRule(auth.admin!.masjid_id, confirmDeleteId);
      confirmDeleteId = null;
      if (res.warning) {
        toast.warning(res.warning, { duration: 8000 });
      } else {
        toast.success('Rule deleted');
      }
      await loadRules();
      await loadPreview();
      await loadHealth();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function toggleRuleEnabled(rule: any) {
    const newEnabled = !(rule.enabled !== false);
    togglingRuleIds = new Set([...togglingRuleIds, rule.id]);
    try {
      await api.updatePrayerRule(auth.admin!.masjid_id, rule.id, { enabled: newEnabled });
      rule.enabled = newEnabled;
      toast.success(newEnabled ? 'Rule enabled' : 'Rule disabled');
      await loadPreview();
      await loadHealth();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      const next = new Set(togglingRuleIds);
      next.delete(rule.id);
      togglingRuleIds = next;
    }
  }

  async function reorderWithinPrayer(prayer: string, index: number, dir: number) {
    const group = [...groupedRules[prayer]] as any[];
    const target = index + dir;
    if (target < 0 || target >= group.length) return;
    [group[index], group[target]] = [group[target], group[index]];
    const reorderedIds = group.map((r: any) => r.id);
    try {
      await api.reorderPrayerRules(auth.admin!.masjid_id, reorderedIds);
      await loadRules();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  function handleReorder(e: MouseEvent) {
    const btn = e.currentTarget as HTMLButtonElement;
    const prayer = btn.dataset.prayer!;
    const index = parseInt(btn.dataset.index!, 10);
    const dir = parseInt(btn.dataset.dir!, 10);
    reorderWithinPrayer(prayer, index, dir);
  }

  async function runDryRun() {
    runningDryRun = true;
    dryRunResult = null;
    dryRunError = null;
    try {
      const result = await api.dryRunPrayerTimes(auth.admin!.masjid_id, {
        date: dryRunDate || undefined,
      });
      dryRunResult = result;
    } catch (e: unknown) {
      dryRunError = e instanceof Error ? e.message : 'Failed';
      try {
        const fallback = await api.getPrayerRulesPreview(auth.admin!.masjid_id, dryRunDate || undefined);
        dryRunResult = { ...fallback, _error: dryRunError };
      } catch {
        // fallback also failed
      }
    } finally {
      runningDryRun = false;
    }
  }

  function conditionSummary(c: any): string {
    if (!c) return '?';
    if (c.type === 'always') return 'Always';
    if (c.type === 'day_of_week') return `Days: ${(c.days || []).map((d: number) => dayNames[d]).join(', ') || 'none'}`;
    if (c.type === 'month') return `Months: ${(c.months || []).map((m: number) => monthNames[m - 1]).join(', ') || 'none'}`;
    if (c.type === 'hijri_month') return `Hijri: ${(c.months || []).join(', ') || 'none'}`;
    if (c.type === 'date_range') return `${c.start || '?'} – ${c.end || '?'}`;
    if (c.type === 'time_of_day') return `${c.operator === 'before' ? 'Before' : 'After'} ${c.threshold || '?'}`;
    if (c.type === 'hijri_day_range') return `Hijri month ${c.month || '?'} days ${c.start_day || '?'}–${c.end_day || '?'}`;
    if (c.type === 'month_day_range') {
      const sm = monthNames[(c.start_month || 1) - 1];
      const em = monthNames[(c.end_month || 1) - 1];
      return `${sm} ${c.start_day || '?'} – ${em} ${c.end_day || '?'}`;
    }
    return c.type;
  }

  function actionSummary(a: any): string {
    if (!a) return '—';
    if (a.type === 'add_minutes') return `+${a.minutes}m`;
    if (a.type === 'round_up') return `Round up ${a.increment}m`;
    if (a.type === 'round_down') return `Round down ${a.increment}m`;
    if (a.type === 'round_nearest') return `Round nearest ${a.increment}m`;
    if (a.type === 'set_fixed_time') return `Set ${a.time}`;
    if (a.type === 'right_after_adhaan') return 'Right after Adhaan';
    if (a.type === 'set_offset_from_prayer') return `${a.prayer} ${a.from} ${a.minutes > 0 ? '+' : ''}${a.minutes}m`;
    if (a.type === 'cap_min') return `Min ${a.time}`;
    if (a.type === 'cap_max') return `Max ${a.time}`;
    return a.type;
  }

  function chainEntryForRule(ruleId: string): any | null {
    return chainMap[ruleId] ?? null;
  }

  function existingRulesForPrayer(prayer: string): any[] {
    const group = groupedRules[prayer] as any[];
    return group.map((r: any) => ({
      conditions_json: r.conditions_json,
      action_json: r.action_json,
      enabled: r.enabled,
      execution_order: r.execution_order,
    }));
  }

  function existingRulesExcluding(prayer: string, excludeId: string): any[] {
    const group = groupedRules[prayer] as any[];
    return group
      .filter((r: any) => r.id !== excludeId)
      .map((r: any) => ({
        conditions_json: r.conditions_json,
        action_json: r.action_json,
        enabled: r.enabled,
        execution_order: r.execution_order,
      }));
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-heading font-bold">Prayer Rules</h1>
      <p class="text-text-muted text-sm mt-1">Define iqaamah adjustment rules per prayer</p>
    </div>
  </div>

  {#if prayerHealth && !prayerHealth.healthy}
    <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
      <div class="flex items-start gap-3">
        <TriangleAlert size={20} class="text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p class="text-amber-400 text-sm font-medium">
            {prayerHealth.failingDates.length} day{prayerHealth.failingDates.length > 1 ? 's' : ''} failing in the next 30 days
          </p>
          <p class="text-amber-400/70 text-xs mt-1">
            {prayerHealth.failingDates.join(', ')}
          </p>
          <p class="text-amber-400/60 text-xs mt-1">
            The TV and consumer displays will show --:-- for prayer times on those dates. Check your rules below.
          </p>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <SkeletonForm fields={4} />
  {:else}
    {#each prayers as prayer}
      {@const group = groupedRules[prayer] as any[]}
      {@const chain = prayerChains[prayer]}
      {@const pipelineOpen = showPipeline[prayer] || false}

      <div class="bg-surface border border-border rounded-xl p-5 mb-4">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-heading font-semibold capitalize">{prayer}</h2>
            <span class="badge badge-purple">{group.length} rule{group.length !== 1 ? 's' : ''}</span>
          </div>
          <button class="btn-primary text-sm" onclick={() => startAdd(prayer)}>
            <Plus size={16} />
            Add Rule
          </button>
        </div>

        {#if showAddPrayer === prayer}
          <div class="mb-4">
            <RuleForm
              mode="add"
              bind:rule={newRule}
              {prayer}
              adhaanTime={chain?.adhaan ?? ''}
              existingRules={existingRulesForPrayer(prayer)}
              onSave={addRule}
              onCancel={() => showAddPrayer = null}
              {saving}
              submitLabel="Add"
            />
          </div>
        {/if}

        {#if group.length === 0}
          <div class="bg-bg rounded-lg p-6 text-center">
            <p class="text-text-muted text-sm">No rules for {prayer}. Click "Add Rule" above.</p>
          </div>
        {:else}
          <div class="overflow-hidden rounded-lg border border-border">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-border bg-bg/50">
                  <th class="text-left p-3 text-text-muted font-medium w-20">Order</th>
                  <th class="text-left p-3 text-text-muted font-medium">Name</th>
                  <th class="text-left p-3 text-text-muted font-medium">Conditions</th>
                  <th class="text-left p-3 text-text-muted font-medium">Action</th>
                  <th class="text-center p-3 text-text-muted font-medium w-16">Active</th>
                  <th class="text-center p-3 text-text-muted font-medium w-20">Today</th>
                  <th class="text-right p-3 text-text-muted font-medium w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each group as rule, gi (rule.id)}
                  {@const entry = chainEntryForRule(rule.id)}
                  <tr class="border-b border-border last:border-0 hover:bg-bg/50 {rule.enabled === false ? 'opacity-50' : ''}">
                    <td class="p-3">
                      <div class="flex items-center gap-1">
                        <button
                          type="button"
                          class="px-1 py-0.5 text-text-muted hover:text-text disabled:opacity-30 text-lg leading-none"
                          disabled={gi === 0}
                          data-prayer={rule.prayer_name} data-index={gi} data-dir={-1}
                          onclick={handleReorder}>&#9650;</button>
                        <button
                          type="button"
                          class="px-1 py-0.5 text-text-muted hover:text-text disabled:opacity-30 text-lg leading-none"
                          disabled={gi === group.length - 1}
                          data-prayer={rule.prayer_name} data-index={gi} data-dir={1}
                          onclick={handleReorder}>&#9660;</button>
                        <span class="ml-1 text-text-muted text-xs font-mono">{gi + 1}</span>
                      </div>
                    </td>
                    <td class="p-3 font-medium">{rule.rule_name}</td>
                    <td class="p-3 text-text-muted text-xs">
                      {(rule.conditions_json || []).map((c: any) => conditionSummary(c)).join(', ')}
                    </td>
                    <td class="p-3">
                      <span class="badge badge-blue">{actionSummary(rule.action_json)}</span>
                    </td>
                    <td class="p-3 text-center">
                      <button
                        type="button"
                        class="p-0.5 rounded hover:bg-bg transition-colors"
                        disabled={togglingRuleIds.has(rule.id)}
                        onclick={() => toggleRuleEnabled(rule)}
                        title={rule.enabled !== false ? 'Disable rule' : 'Enable rule'}
                      >
                        {#if rule.enabled !== false}
                          <ToggleRight size={22} class="text-green-500" />
                        {:else}
                          <ToggleLeft size={22} class="text-text-muted" />
                        {/if}
                      </button>
                    </td>
                    <td class="p-3 text-center text-xs text-text-muted">
                      {#if entry}
                        {#if entry.matched}
                          <span class="text-green-500 font-medium">HIT<br/>{entry.input_time} &rarr; {entry.output_time}</span>
                        {:else}
                          <span class="text-text-dim" title={entry.enabled ? 'Conditions not met' : 'Rule disabled'}>
                            {entry.enabled ? '—' : 'OFF'}
                          </span>
                        {/if}
                      {:else if previewLoading}
                        <span class="text-text-dim">...</span>
                      {:else}
                        <span class="text-text-dim">—</span>
                      {/if}
                    </td>
                    <td class="p-3 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <button class="btn-secondary text-xs py-1 px-2" onclick={() => startEdit(rule)}>Edit</button>
                        <button class="p-1 text-text-muted hover:text-text" title="Duplicate" onclick={() => duplicateRule(rule)}>
                          <Copy size={14} />
                        </button>
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

          {#if chain}
            <div class="mt-3 flex items-center gap-2 text-xs text-text-muted px-1">
              <span class="font-medium">Adhaan:</span>
              <span class="font-mono bg-bg px-2 py-0.5 rounded">{chain.adhaan}</span>
              <span class="mx-1">&rarr;</span>
              <span class="font-medium">Iqaamah:</span>
              <span class="font-mono bg-bg px-2 py-0.5 rounded text-accent">{chain.iqaamah}</span>
            </div>
          {/if}

          {#if group.length > 0}
            <button
              class="mt-3 text-xs text-accent hover:underline flex items-center gap-1"
              onclick={() => showPipeline = { ...showPipeline, [prayer]: !pipelineOpen }}
            >
              {#if pipelineOpen}
                <EyeOff size={14} /> Hide pipeline
              {:else}
                <Eye size={14} /> Show pipeline
              {/if}
            </button>
          {/if}

          {#if pipelineOpen && chain}
            <div class="mt-3 rounded-lg border border-border bg-bg/50 p-4 font-mono text-xs">
              <div class="text-text-muted mb-2">Adhaan ({chain.adhaan})</div>
              {#each chain.rules as cr, cri (cr.id)}
                {@const isLast = cri === chain.rules.length - 1}
                <div class="flex items-start gap-2 py-1.5 border-t border-border/50 first:border-t-0 {!cr.matched ? 'opacity-50' : ''}">
                  <span class="text-text-dim font-mono w-6 text-right">{cr.order + 1}</span>
                  <div class="flex-1">
                    <span class="font-medium">{cr.rule_name || '(unnamed)'}</span>
                    {#if cr.matched}
                      <span class="ml-1 text-green-500">&check;</span>
                      <span class="mx-1 text-text-dim">— {actionSummary(cr.action_json)} —</span>
                      <span class="font-mono">{cr.input_time} &rarr; <span class="text-accent">{cr.output_time}</span></span>
                    {:else}
                      <span class="ml-1 text-text-dim">— skipped {!cr.enabled ? '(disabled)' : '(not matched)'}</span>
                    {/if}
                  </div>
                </div>
              {/each}
              <div class="mt-3 pt-2 border-t border-border text-text-muted">
                Iqaamah: <span class="font-mono text-accent font-bold">{chain.iqaamah}</span>
              </div>
            </div>
          {/if}
        {/if}

        {#if editingId && editRule.prayer_name === prayer}
          <div class="mt-4">
            <RuleForm
              mode="edit"
              bind:rule={editRule}
              {prayer}
              adhaanTime={chain?.adhaan ?? ''}
              existingRules={existingRulesExcluding(prayer, editingId!)}
              onSave={saveEdit}
              onCancel={() => editingId = null}
              {saving}
              submitLabel="Save"
            />
          </div>
        {/if}
      </div>
    {/each}

    {#if !error}
      <div class="bg-surface border border-border rounded-xl p-5 mt-6">
        <button class="flex items-center gap-2 text-text-muted hover:text-text text-sm font-medium" onclick={() => showDryRun = !showDryRun}>
          <Play size={16} />
          Dry-Run Simulator
          <span class="text-xs text-text-dim">— test any date</span>
        </button>
        {#if showDryRun}
          <div class="mt-4 space-y-3">
            <div class="flex gap-3 items-end">
              <div class="form-group flex-1">
                <label for="dryrun-date">Date (optional, defaults to today)</label>
                <input id="dryrun-date" type="date" class="w-full text-sm" bind:value={dryRunDate} />
              </div>
              <button class="btn-primary text-sm" disabled={runningDryRun} onclick={runDryRun}>
                {runningDryRun ? 'Running...' : 'Run'}
              </button>
            </div>

            {#if dryRunError && !dryRunResult}
              <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p class="text-red-400 text-sm font-medium">Computation failed</p>
                <p class="text-red-400/70 text-xs mt-1 font-mono">{dryRunError}</p>
                <p class="text-red-400/60 text-xs mt-2">
                  This usually means your prayer config (coordinates, timezone, calculation method) produces
                  times that cannot be ordered correctly, or a rule's action creates an invalid result.
                  Check the pipeline above for today's values, then try adjusting your settings.
                </p>
              </div>
            {/if}

            {#if dryRunResult}
              {#if dryRunResult._error}
                <div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-3">
                  <p class="text-amber-400 text-xs font-medium">Error: {dryRunResult._error}</p>
                  <p class="text-amber-400/60 text-xs mt-1">Showing partial computation below</p>
                </div>
              {/if}

              {#if dryRunResult.chains}
                <div class="space-y-4">
                  <div class="text-xs text-text-muted">
                    Date: <span class="font-mono text-text">{dryRunResult.date}</span>
                    {#if dryRunResult.hijri}
                      &middot; Hijri: <span class="font-mono text-text">{dryRunResult.hijri.month}/{dryRunResult.hijri.day}/{dryRunResult.hijri.year}</span>
                    {/if}
                    &middot; Sunrise: <span class="font-mono text-text">{dryRunResult.sunrise}</span>
                  </div>
                  {#each prayers as prayer}
                    {@const chain = dryRunResult.chains[prayer]}
                    {#if chain}
                      <div class="rounded-lg border border-border bg-bg/50 p-4 font-mono text-xs">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="font-heading font-semibold text-sm capitalize">{prayer}</span>
                          <span class="text-text-muted">Adhaan:</span>
                          <span class="font-mono">{chain.adhaan}</span>
                          <span class="mx-1">&rarr;</span>
                          <span class="text-text-muted">Iqaamah:</span>
                          <span class="font-mono text-accent font-bold">{chain.iqaamah}</span>
                        </div>
                        {#each chain.rules as cr, cri (cr.id)}
                          <div class="flex items-start gap-2 py-1.5 border-t border-border/50 first:border-t-0 {!cr.matched ? 'opacity-50' : ''}">
                            <span class="text-text-dim font-mono w-6 text-right">{cr.order + 1}</span>
                            <div class="flex-1">
                              <span class="font-medium">{cr.rule_name || '(unnamed)'}</span>
                              {#if cr.matched}
                                <span class="ml-1 text-green-500">&check;</span>
                                <span class="mx-1 text-text-dim">— {actionSummary(cr.action_json)} —</span>
                                <span class="font-mono">{cr.input_time} &rarr; <span class="text-accent">{cr.output_time}</span></span>
                              {:else}
                                <span class="ml-1 text-text-dim">— skipped {!cr.enabled ? '(disabled)' : '(not matched)'}</span>
                              {/if}
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  {/each}
                </div>
              {:else}
                <div class="bg-bg rounded-lg p-4 font-mono text-xs text-text-muted whitespace-pre overflow-x-auto">
                  {JSON.stringify(dryRunResult, null, 2)}
                </div>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<ConfirmDialog
  open={confirmDeleteId !== null}
  title="Delete Rule"
  message="This will permanently delete this prayer rule."
  onConfirm={deleteRule}
  onCancel={() => confirmDeleteId = null}
/>