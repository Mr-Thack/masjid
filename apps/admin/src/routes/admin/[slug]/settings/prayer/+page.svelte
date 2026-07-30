<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Loader, Plus, Trash2, ChevronUp, ChevronDown, X, Play } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let rules = $state<any[]>([]);
  let editingId = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);
  let showAddPrayer = $state<string | null>(null);

  function defaultNewRule(prayer: string) {
    return {
      prayer_name: prayer,
      rule_name: '',
      execution_order: 0,
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'add_minutes', minutes: 10 },
    };
  }

  let newRule = $state(defaultNewRule('fajr'));
  let editRule = $state<any>({});

  const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const actionTypes = ['add_minutes', 'round_up', 'round_down', 'round_nearest', 'set_fixed_time', 'right_after_adhaan'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const groupedRules = $derived(
    Object.fromEntries(prayers.map(p => [p, rules.filter(r => r.prayer_name === p)]))
  );

  let dryRunDate = $state('');
  let dryRunResult = $state<Record<string, unknown> | null>(null);
  let showDryRun = $state(false);
  let runningDryRun = $state(false);

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

  function startAdd(prayer: string) {
    showAddPrayer = prayer;
    newRule = defaultNewRule(prayer);
    editingId = null;
  }

  async function addRule(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      const group = rules.filter((r: any) => r.prayer_name === newRule.prayer_name);
      const maxOrder = group.length > 0 ? Math.max(...group.map((r: any) => r.execution_order)) : -1;
      await api.createPrayerRule(auth.admin!.masjid_id, {
        ...newRule,
        execution_order: maxOrder + 1,
      });
      showAddPrayer = null;
      toast.success('Rule added');
      await loadRules();
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
    };
  }

  async function saveEdit(e: Event) {
    e.preventDefault();
    saving = true;
    try {
      await api.updatePrayerRule(auth.admin!.masjid_id, editingId!, {
        prayer_name: editRule.prayer_name,
        rule_name: editRule.rule_name,
        conditions_json: editRule.conditions_json,
        action_json: editRule.action_json,
      });
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
    console.log('[handleReorder] called', e.type, e.currentTarget);
    const btn = e.currentTarget as HTMLButtonElement;
    const prayer = btn.dataset.prayer!;
    const index = parseInt(btn.dataset.index!, 10);
    const dir = parseInt(btn.dataset.dir!, 10);
    console.log('[handleReorder] prayer=%s index=%d dir=%d', prayer, index, dir);
    reorderWithinPrayer(prayer, index, dir);
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

  function addCondition(target: any) {
    target.conditions_json = [...target.conditions_json, { type: 'always' }];
  }

  function removeCondition(target: any, index: number) {
    if (target.conditions_json.length <= 1) return;
    target.conditions_json = target.conditions_json.filter((_: any, i: number) => i !== index);
  }

  function setConditionType(target: any, index: number, type: string) {
    const conds = [...target.conditions_json];
    conds[index] = buildEmptyCondition(type);
    target.conditions_json = conds;
  }

  function buildEmptyCondition(type: string): any {
    switch (type) {
      case 'always': return { type: 'always' };
      case 'day_of_week': return { type: 'day_of_week', days: [] };
      case 'month': return { type: 'month', months: [] };
      case 'hijri_month': return { type: 'hijri_month', months: [] };
      case 'date_range': return { type: 'date_range', start: '', end: '' };
      default: return { type: 'always' };
    }
  }

  function setActionType(target: any, type: string) {
    switch (type) {
      case 'add_minutes':
        target.action_json = { type: 'add_minutes', minutes: 10 };
        break;
      case 'round_up':
      case 'round_down':
      case 'round_nearest':
        target.action_json = { type, increment: 5 };
        break;
      case 'set_fixed_time':
        target.action_json = { type: 'set_fixed_time', time: '' };
        break;
      case 'right_after_adhaan':
        target.action_json = { type: 'right_after_adhaan' };
        break;
    }
  }

  function toggleCondItem(arr: number[], item: number): number[] {
    if (arr.includes(item)) return arr.filter(x => x !== item);
    return [...arr, item];
  }

  function setCondItem(target: any, condIndex: number, field: string, item: number) {
    const conds = [...target.conditions_json];
    const arr = (conds[condIndex][field] as number[]) || [];
    conds[condIndex] = { ...conds[condIndex], [field]: toggleCondItem(arr, item) };
    target.conditions_json = conds;
  }

  function conditionSummary(c: any): string {
    if (c.type === 'always') return 'Always';
    if (c.type === 'day_of_week') return `Days: ${(c.days || []).map((d: number) => dayNames[d]).join(', ') || 'none'}`;
    if (c.type === 'month') return `Months: ${(c.months || []).map((m: number) => monthNames[m - 1]).join(', ') || 'none'}`;
    if (c.type === 'hijri_month') return `Hijri: ${(c.months || []).join(', ') || 'none'}`;
    if (c.type === 'date_range') return `${c.start || '?'} – ${c.end || '?'}`;
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
    return a.type;
  }
</script>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-heading font-bold">Prayer Rules</h1>
      <p class="text-text-muted text-sm mt-1">Define iqaamah adjustment rules per prayer</p>
    </div>
  </div>

  {#if loading}
    <SkeletonForm fields={4} />
  {:else}
    {#each prayers as prayer}
      {@const group = groupedRules[prayer] as any[]}

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
          <form onsubmit={addRule} class="border border-accent rounded-lg p-4 mb-4 space-y-3 bg-bg/50">
            <div class="flex items-center gap-2">
              <h3 class="font-heading font-semibold text-sm text-accent">New {prayer} Rule</h3>
            </div>

            <div>
              <label>Rule Name</label>
              <input type="text" class="w-full text-sm" bind:value={newRule.rule_name} placeholder="e.g. Weekday delay" />
            </div>

            <div>
              <label>Action</label>
              <select class="w-full text-sm" value={newRule.action_json.type} onchange={(e: any) => setActionType(newRule, e.target.value)}>
                {#each actionTypes as a}
                  <option value={a}>{a.replace(/_/g, ' ')}</option>
                {/each}
              </select>
            </div>

            {#if newRule.action_json.type === 'add_minutes'}
              <div>
                <label>Minutes</label>
                <input type="number" class="w-48 text-sm" bind:value={newRule.action_json.minutes} min="1" />
              </div>
            {:else if newRule.action_json.type === 'set_fixed_time'}
              <div>
                <label>Fixed Time (HH:MM)</label>
                <input type="text" class="w-32 text-sm" bind:value={newRule.action_json.time} placeholder="13:30" />
              </div>
            {:else if ['round_up', 'round_down', 'round_nearest'].includes(newRule.action_json.type)}
              <div>
                <label>Increment</label>
                <select class="w-32 text-sm" value={newRule.action_json.increment} onchange={(e: any) => newRule.action_json.increment = Number(e.target.value)}>
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

            <fieldset class="border border-border rounded-lg p-3">
              <legend class="text-sm font-medium text-text-muted px-1">Conditions</legend>
              <div class="space-y-3">
                {#each newRule.conditions_json as cond, ci (ci)}
                  <div class="flex gap-2 items-start">
                    <select class="text-sm w-36" value={cond.type} onchange={(e: any) => setConditionType(newRule, ci, e.target.value)}>
                      <option value="always">Always</option>
                      <option value="day_of_week">Day of week</option>
                      <option value="month">Month</option>
                      <option value="hijri_month">Hijri month</option>
                      <option value="date_range">Date range</option>
                    </select>

                    <div class="flex-1">
                      {#if cond.type === 'always'}
                        <p class="text-xs text-text-muted py-1.5">Always applies</p>
                      {:else if cond.type === 'day_of_week'}
                        <div class="flex flex-wrap gap-1">
                          {#each dayNames as day, di}
                            <label class="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border cursor-pointer hover:bg-surface {(cond.days || []).includes(di) ? 'bg-accent/20 border-accent' : ''}">
                              <input type="checkbox" class="sr-only"
                                checked={(cond.days || []).includes(di)}
                                onchange={() => setCondItem(newRule, ci, 'days', di)} />
                              {day}
                            </label>
                          {/each}
                        </div>
                      {:else if cond.type === 'month'}
                        <div class="flex flex-wrap gap-1">
                          {#each monthNames as month, mi}
                            <label class="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border cursor-pointer hover:bg-surface {(cond.months || []).includes(mi + 1) ? 'bg-accent/20 border-accent' : ''}">
                              <input type="checkbox" class="sr-only"
                                checked={(cond.months || []).includes(mi + 1)}
                                onchange={() => setCondItem(newRule, ci, 'months', mi + 1)} />
                              {month}
                            </label>
                          {/each}
                        </div>
                      {:else if cond.type === 'hijri_month'}
                        <div class="flex flex-wrap gap-1">
                          {#each Array(12) as _, i (i)}
                            {@const m = i + 1}
                            <label class="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border cursor-pointer hover:bg-surface {(cond.months || []).includes(m) ? 'bg-accent/20 border-accent' : ''}">
                              <input type="checkbox" class="sr-only"
                                checked={(cond.months || []).includes(m)}
                                onchange={() => setCondItem(newRule, ci, 'months', m)} />
                              {m}
                            </label>
                          {/each}
                        </div>
                      {:else if cond.type === 'date_range'}
                        <div class="flex items-center gap-2">
                          <input type="date" class="text-xs w-36" bind:value={cond.start} />
                          <span class="text-xs text-text-muted">to</span>
                          <input type="date" class="text-xs w-36" bind:value={cond.end} />
                        </div>
                      {/if}
                    </div>

                    <button type="button" class="p-1 text-text-muted hover:text-red-400" disabled={newRule.conditions_json.length <= 1}
                      title="Remove condition" onclick={() => removeCondition(newRule, ci)}>
                      <X size={14} />
                    </button>
                  </div>
                {/each}
              </div>
              <button type="button" class="text-xs text-accent hover:underline mt-2" onclick={() => addCondition(newRule)}>
                + Add Condition
              </button>
            </fieldset>

            <div class="flex gap-2">
              <button type="submit" class="btn-primary text-sm" disabled={saving}>Add</button>
              <button type="button" class="btn-secondary text-sm" onclick={() => showAddPrayer = null}>Cancel</button>
            </div>
          </form>
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
                  <th class="text-right p-3 text-text-muted font-medium w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each group as rule, gi (rule.id)}
                  <tr class="border-b border-border last:border-0 hover:bg-bg/50">
                    <td class="p-3">
                      <div class="flex items-center gap-1">
                        <button
    type="button"
    class="px-1 py-0.5 text-text-muted hover:text-text disabled:opacity-30 text-lg leading-none"
    disabled={gi === 0}
    data-prayer={rule.prayer_name} data-index={gi} data-dir={-1}
    onclick={handleReorder}>▲</button>
<button
    type="button"
    class="px-1 py-0.5 text-text-muted hover:text-text disabled:opacity-30 text-lg leading-none"
    disabled={gi === group.length - 1}
    data-prayer={rule.prayer_name} data-index={gi} data-dir={1}
    onclick={handleReorder}>▼</button>
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
        {/if}

        {#if editingId && editRule.prayer_name === prayer}
          <form onsubmit={saveEdit} class="border border-accent rounded-lg p-4 mt-4 space-y-3 bg-bg/50">
            <div class="flex items-center gap-2">
              <h3 class="font-heading font-semibold text-sm text-accent">Edit Rule</h3>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label>Prayer</label>
                <select class="w-full text-sm" bind:value={editRule.prayer_name}>
                  {#each prayers as p}
                    <option value={p}>{p}</option>
                  {/each}
                </select>
              </div>
              <div>
                <label>Rule Name</label>
                <input type="text" class="w-full text-sm" bind:value={editRule.rule_name} />
              </div>
            </div>

            <div>
              <label>Action</label>
              <select class="w-full text-sm" value={editRule.action_json?.type} onchange={(e: any) => setActionType(editRule, e.target.value)}>
                {#each actionTypes as a}
                  <option value={a}>{a.replace(/_/g, ' ')}</option>
                {/each}
              </select>
            </div>

            {#if editRule.action_json?.type === 'add_minutes'}
              <div>
                <label>Minutes</label>
                <input type="number" class="w-48 text-sm" bind:value={editRule.action_json.minutes} min="1" />
              </div>
            {:else if editRule.action_json?.type === 'set_fixed_time'}
              <div>
                <label>Fixed Time (HH:MM)</label>
                <input type="text" class="w-32 text-sm" bind:value={editRule.action_json.time} placeholder="13:30" />
              </div>
            {:else if editRule.action_json?.type && ['round_up', 'round_down', 'round_nearest'].includes(editRule.action_json.type)}
              <div>
                <label>Increment</label>
                <select class="w-32 text-sm" value={editRule.action_json.increment} onchange={(e: any) => editRule.action_json.increment = Number(e.target.value)}>
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

            <fieldset class="border border-border rounded-lg p-3">
              <legend class="text-sm font-medium text-text-muted px-1">Conditions</legend>
              <div class="space-y-3">
                {#each editRule.conditions_json as cond, ci (ci)}
                  <div class="flex gap-2 items-start">
                    <select class="text-sm w-36" value={cond.type} onchange={(e: any) => setConditionType(editRule, ci, e.target.value)}>
                      <option value="always">Always</option>
                      <option value="day_of_week">Day of week</option>
                      <option value="month">Month</option>
                      <option value="hijri_month">Hijri month</option>
                      <option value="date_range">Date range</option>
                    </select>

                    <div class="flex-1">
                      {#if cond.type === 'always'}
                        <p class="text-xs text-text-muted py-1.5">Always applies</p>
                      {:else if cond.type === 'day_of_week'}
                        <div class="flex flex-wrap gap-1">
                          {#each dayNames as day, di}
                            <label class="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border cursor-pointer hover:bg-surface {(cond.days || []).includes(di) ? 'bg-accent/20 border-accent' : ''}">
                              <input type="checkbox" class="sr-only"
                                checked={(cond.days || []).includes(di)}
                                onchange={() => setCondItem(editRule, ci, 'days', di)} />
                              {day}
                            </label>
                          {/each}
                        </div>
                      {:else if cond.type === 'month'}
                        <div class="flex flex-wrap gap-1">
                          {#each monthNames as month, mi}
                            <label class="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border cursor-pointer hover:bg-surface {(cond.months || []).includes(mi + 1) ? 'bg-accent/20 border-accent' : ''}">
                              <input type="checkbox" class="sr-only"
                                checked={(cond.months || []).includes(mi + 1)}
                                onchange={() => setCondItem(editRule, ci, 'months', mi + 1)} />
                              {month}
                            </label>
                          {/each}
                        </div>
                      {:else if cond.type === 'hijri_month'}
                        <div class="flex flex-wrap gap-1">
                          {#each Array(12) as _, i (i)}
                            {@const m = i + 1}
                            <label class="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border cursor-pointer hover:bg-surface {(cond.months || []).includes(m) ? 'bg-accent/20 border-accent' : ''}">
                              <input type="checkbox" class="sr-only"
                                checked={(cond.months || []).includes(m)}
                                onchange={() => setCondItem(editRule, ci, 'months', m)} />
                              {m}
                            </label>
                          {/each}
                        </div>
                      {:else if cond.type === 'date_range'}
                        <div class="flex items-center gap-2">
                          <input type="date" class="text-xs w-36" bind:value={cond.start} />
                          <span class="text-xs text-text-muted">to</span>
                          <input type="date" class="text-xs w-36" bind:value={cond.end} />
                        </div>
                      {/if}
                    </div>

                    <button type="button" class="p-1 text-text-muted hover:text-red-400" disabled={editRule.conditions_json.length <= 1}
                      title="Remove condition" onclick={() => removeCondition(editRule, ci)}>
                      <X size={14} />
                    </button>
                  </div>
                {/each}
              </div>
              <button type="button" class="text-xs text-accent hover:underline mt-2" onclick={() => addCondition(editRule)}>
                + Add Condition
              </button>
            </fieldset>

            <div class="flex gap-2">
              <button type="submit" class="btn-primary text-sm" disabled={saving}>Save</button>
              <button type="button" class="btn-secondary text-sm" onclick={() => editingId = null}>Cancel</button>
            </div>
          </form>
        {/if}
      </div>
    {/each}

    {#if !error}
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
  {/if}
</div>

<ConfirmDialog
  open={confirmDeleteId !== null}
  title="Delete Rule"
  message="This will permanently delete this prayer rule."
  onConfirm={deleteRule}
  onCancel={() => confirmDeleteId = null}
/>