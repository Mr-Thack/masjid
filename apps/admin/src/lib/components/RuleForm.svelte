<script lang="ts">
  import { X } from 'lucide-svelte';
  import { applyAction, allConditionsMatch, computeHijriDate } from '@masjid/ui-utils';
  import type { Condition, Action } from '@masjid/schemas';

  let {
    mode = 'add',
    rule = {
      rule_name: '',
      prayer_name: '',
      conditions_json: [{ type: 'always' }],
      action_json: { type: 'add_minutes', minutes: 10 },
      enabled: true,
    },
    prayer = '',
    adhaanTime = '',
    existingRules = [] as { conditions_json: Condition[]; action_json: Action; enabled: boolean; execution_order: number }[],
    onSave = (_e: Event) => {},
    onCancel = () => {},
    saving = false,
    submitLabel = 'Add',
  }: {
    mode?: 'add' | 'edit';
    rule?: any;
    prayer?: string;
    adhaanTime?: string;
    existingRules?: any[];
    onSave?: (e: Event) => void;
    onCancel?: () => void;
    saving?: boolean;
    submitLabel?: string;
  } = $props();

  const actionTypes = [
    { value: 'add_minutes', label: 'Add minutes' },
    { value: 'round_up', label: 'Round up' },
    { value: 'round_down', label: 'Round down' },
    { value: 'round_nearest', label: 'Round nearest' },
    { value: 'set_fixed_time', label: 'Set fixed time' },
    { value: 'right_after_adhaan', label: 'Right after adhaan' },
    { value: 'set_offset_from_prayer', label: 'Offset from prayer' },
    { value: 'cap_min', label: 'Cap minimum' },
    { value: 'cap_max', label: 'Cap maximum' },
  ];

  const conditionTypes = [
    { value: 'always', label: 'Always' },
    { value: 'day_of_week', label: 'Day of week' },
    { value: 'month', label: 'Month' },
    { value: 'hijri_month', label: 'Hijri month' },
    { value: 'date_range', label: 'Date range' },
    { value: 'time_of_day', label: 'Time of day' },
    { value: 'hijri_day_range', label: 'Hijri day range' },
    { value: 'month_day_range', label: 'Month-day range' },
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  function setActionType(type: string) {
    const target = rule;
    const current = target.action_json;
    if (type === 'add_minutes') {
      target.action_json = { type: 'add_minutes', minutes: current.minutes ?? 10 };
    } else if (type === 'round_up' || type === 'round_down' || type === 'round_nearest') {
      target.action_json = { type, increment: current.increment ?? 5 };
    } else if (type === 'set_fixed_time') {
      target.action_json = { type: 'set_fixed_time', time: current.time ?? '' };
    } else if (type === 'right_after_adhaan') {
      target.action_json = { type: 'right_after_adhaan' };
    } else if (type === 'set_offset_from_prayer') {
      target.action_json = { type: 'set_offset_from_prayer', prayer: current.prayer ?? 'dhuhr', from: current.from ?? 'adhaan', minutes: current.minutes ?? 10 };
    } else if (type === 'cap_min' || type === 'cap_max') {
      target.action_json = { type, time: current.time ?? '' };
    }
  }

  function addCondition() {
    rule.conditions_json = [...rule.conditions_json, { type: 'always' }];
  }

  function removeCondition(index: number) {
    if (rule.conditions_json.length <= 1) return;
    rule.conditions_json = rule.conditions_json.filter((_: any, i: number) => i !== index);
  }

  function setConditionType(ci: number, type: string) {
    const conds = [...rule.conditions_json];
    if (type === 'always') {
      conds[ci] = { type: 'always' };
    } else if (type === 'day_of_week') {
      conds[ci] = { type: 'day_of_week', days: [] };
    } else if (type === 'month') {
      conds[ci] = { type: 'month', months: [] };
    } else if (type === 'hijri_month') {
      conds[ci] = { type: 'hijri_month', months: [] };
    } else if (type === 'date_range') {
      conds[ci] = { type: 'date_range', start: '', end: '' };
    } else if (type === 'time_of_day') {
      conds[ci] = { type: 'time_of_day', operator: 'before', threshold: '' };
    } else if (type === 'hijri_day_range') {
      conds[ci] = { type: 'hijri_day_range', month: 1, start_day: 1, end_day: 1 };
    } else if (type === 'month_day_range') {
      conds[ci] = { type: 'month_day_range', start_month: 1, start_day: 1, end_month: 1, end_day: 1 };
    }
    rule.conditions_json = conds;
  }

  function setCondItem(ci: number, field: string, item: number) {
    const conds = [...rule.conditions_json];
    const arr = (conds[ci][field] as number[]) || [];
    conds[ci] = { ...conds[ci], [field]: arr.includes(item) ? arr.filter((x: number) => x !== item) : [...arr, item] };
    rule.conditions_json = conds;
  }

  let previewInput = $derived.by(() => {
    if (!adhaanTime || !rule.action_json?.type) return null;
    let time = adhaanTime;
    const hijri = computeHijriDate(new Date());
    const now = new Date();

    for (const existing of existingRules) {
      const conds = existing.conditions_json as Condition[];
      const action = existing.action_json as Action;
      if (existing.enabled !== false && allConditionsMatch(conds, now, hijri, time)) {
        time = applyAction(action, time);
      }
    }

    const newConds = rule.conditions_json as Condition[];
    const newAction = rule.action_json as Action;
    let matched = allConditionsMatch(newConds, now, hijri, time);
    let output = matched ? applyAction(newAction, time) : time;

    return { input: time, output, matched };
  });
</script>

<form onsubmit={onSave} class="border border-accent rounded-lg p-4 space-y-3 bg-bg/50">
  <div class="flex items-center gap-2">
    <h3 class="font-heading font-semibold text-sm text-accent">
      {mode === 'edit' ? `Edit ${prayer} Rule` : `New ${prayer} Rule`}
    </h3>
  </div>

  <div class="grid grid-cols-2 gap-3">
    {#if mode === 'edit'}
      <div>
        <label for="edit-prayer">Prayer</label>
        <select id="edit-prayer" class="w-full text-sm" bind:value={rule.prayer_name}>
          {#each prayerNames as p}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </div>
    {/if}
    <div class={mode === 'edit' ? '' : 'col-span-2'}>
      <label for="rule-name">Rule Name</label>
      <input id="rule-name" type="text" class="w-full text-sm" bind:value={rule.rule_name} placeholder="e.g. Weekday delay" />
    </div>
  </div>

  <div>
    <label for="action-type">Action</label>
    <select id="action-type" class="w-full text-sm" value={rule.action_json.type} onchange={(e: any) => setActionType(e.target.value)}>
      {#each actionTypes as a}
        <option value={a.value}>{a.label}</option>
      {/each}
    </select>
  </div>

  {#if rule.action_json.type === 'add_minutes'}
    <div>
      <label for="action-minutes">Minutes</label>
      <input id="action-minutes" type="number" class="w-48 text-sm" bind:value={rule.action_json.minutes} min="1" />
    </div>
  {:else if rule.action_json.type === 'set_fixed_time'}
    <div>
      <label for="action-fixed-time">Fixed Time (HH:MM)</label>
      <input id="action-fixed-time" type="text" class="w-32 text-sm" bind:value={rule.action_json.time} placeholder="13:30" />
    </div>
  {:else if ['round_up', 'round_down', 'round_nearest'].includes(rule.action_json.type)}
    <div>
      <label for="action-increment">Increment</label>
      <select id="action-increment" class="w-32 text-sm" value={rule.action_json.increment} onchange={(e: any) => rule.action_json.increment = Number(e.target.value)}>
        <option value={1}>1m</option>
        <option value={5}>5m</option>
        <option value={10}>10m</option>
        <option value={15}>15m</option>
        <option value={20}>20m</option>
        <option value={30}>30m</option>
        <option value={60}>60m</option>
      </select>
    </div>
  {:else if rule.action_json.type === 'set_offset_from_prayer'}
    <div class="grid grid-cols-3 gap-2">
      <div>
        <label for="offset-prayer">Reference Prayer</label>
        <select id="offset-prayer" class="w-full text-sm" bind:value={rule.action_json.prayer}>
          {#each prayerNames as p}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="offset-from">From</label>
        <select id="offset-from" class="w-full text-sm" bind:value={rule.action_json.from}>
          <option value="adhaan">Adhaan</option>
          <option value="iqaamah">Iqaamah</option>
          <option value="sunrise">Sunrise</option>
        </select>
      </div>
      <div>
        <label for="offset-minutes">Minutes</label>
        <input id="offset-minutes" type="number" class="w-full text-sm" bind:value={rule.action_json.minutes} min="1" />
      </div>
    </div>
  {:else if rule.action_json.type === 'cap_min' || rule.action_json.type === 'cap_max'}
    <div>
      <label for="cap-time">{rule.action_json.type === 'cap_min' ? 'Minimum' : 'Maximum'} Time (HH:MM)</label>
      <input id="cap-time" type="text" class="w-32 text-sm" bind:value={rule.action_json.time} placeholder="13:30" />
    </div>
  {/if}

  <fieldset class="border border-border rounded-lg p-3">
    <legend class="text-sm font-medium text-text-muted px-1">Conditions</legend>
    <div class="space-y-3">
      {#each rule.conditions_json as cond, ci (ci)}
        <div class="flex gap-2 items-start">
          <select class="text-sm w-40" value={cond.type} onchange={(e: any) => setConditionType(ci, e.target.value)}>
            {#each conditionTypes as ct}
              <option value={ct.value}>{ct.label}</option>
            {/each}
          </select>

          <div class="flex-1">
            {#if cond.type === 'always'}
              <p class="text-xs text-text-muted py-1.5">Always applies</p>
            {:else if cond.type === 'day_of_week'}
              <div class="flex flex-wrap gap-1">
                {#each dayNames as day, di}
                  <label class="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border cursor-pointer hover:bg-surface {(cond.days || []).includes(di) ? 'bg-accent/20 border-accent' : ''}">
                    <input type="checkbox" class="sr-only" checked={(cond.days || []).includes(di)} onchange={() => setCondItem(ci, 'days', di)} />
                    {day}
                  </label>
                {/each}
              </div>
            {:else if cond.type === 'month'}
              <div class="flex flex-wrap gap-1">
                {#each monthNames as month, mi}
                  <label class="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border cursor-pointer hover:bg-surface {(cond.months || []).includes(mi + 1) ? 'bg-accent/20 border-accent' : ''}">
                    <input type="checkbox" class="sr-only" checked={(cond.months || []).includes(mi + 1)} onchange={() => setCondItem(ci, 'months', mi + 1)} />
                    {month}
                  </label>
                {/each}
              </div>
            {:else if cond.type === 'hijri_month'}
              <div class="flex flex-wrap gap-1">
                {#each Array(12) as _, i (i)}
                  {@const m = i + 1}
                  <label class="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border cursor-pointer hover:bg-surface {(cond.months || []).includes(m) ? 'bg-accent/20 border-accent' : ''}">
                    <input type="checkbox" class="sr-only" checked={(cond.months || []).includes(m)} onchange={() => setCondItem(ci, 'months', m)} />
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
            {:else if cond.type === 'time_of_day'}
              <div class="flex items-center gap-2">
                <select class="text-xs w-24" bind:value={cond.operator}>
                  <option value="before">Before</option>
                  <option value="after">After</option>
                </select>
                <input type="text" class="text-xs w-24" bind:value={cond.threshold} placeholder="HH:MM" />
              </div>
            {:else if cond.type === 'hijri_day_range'}
              <div class="flex items-center gap-2">
                <span class="text-xs text-text-muted">Month</span>
                <select class="text-xs w-20" bind:value={cond.month}>
                  {#each Array(12) as _, i (i)}
                    <option value={i + 1}>{i + 1}</option>
                  {/each}
                </select>
                <span class="text-xs text-text-muted">Day</span>
                <input type="number" class="text-xs w-16" bind:value={cond.start_day} min="1" max="30" />
                <span class="text-xs text-text-muted">–</span>
                <input type="number" class="text-xs w-16" bind:value={cond.end_day} min="1" max="30" />
              </div>
            {:else if cond.type === 'month_day_range'}
              <div class="flex items-center gap-1 flex-wrap">
                <span class="text-xs text-text-muted">From</span>
                <select class="text-xs w-16" bind:value={cond.start_month}>
                  {#each monthNames as m, mi}
                    <option value={mi + 1}>{m}</option>
                  {/each}
                </select>
                <input type="number" class="text-xs w-14" bind:value={cond.start_day} min="1" max="31" />
                <span class="text-xs text-text-muted">to</span>
                <select class="text-xs w-16" bind:value={cond.end_month}>
                  {#each monthNames as m, mi}
                    <option value={mi + 1}>{m}</option>
                  {/each}
                </select>
                <input type="number" class="text-xs w-14" bind:value={cond.end_day} min="1" max="31" />
              </div>
            {/if}
          </div>

          <button type="button" class="p-1 text-text-muted hover:text-red-400" disabled={rule.conditions_json.length <= 1}
            title="Remove condition" onclick={() => removeCondition(ci)}>
            <X size={14} />
          </button>
        </div>
      {/each}
    </div>
    <button type="button" class="text-xs text-accent hover:underline mt-2" onclick={addCondition}>
      + Add Condition
    </button>
  </fieldset>

  {#if previewInput && rule.action_json?.type}
    <div class="bg-bg rounded-lg p-3 text-xs font-mono border border-border">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-text-muted">Pipeline preview after existing rules:</span>
        <span class="font-mono">{previewInput.input}</span>
        <span class="mx-1">&rarr;</span>
        {#if previewInput.matched}
          <span class="text-green-500 font-bold">{previewInput.output}</span>
          <span class="text-green-500 text-[10px]">(matched)</span>
        {:else}
          <span class="text-text-dim">{previewInput.output}</span>
          <span class="text-text-dim text-[10px]">(not matched today)</span>
        {/if}
      </div>
    </div>
  {/if}

  <div class="flex gap-2">
    <button type="submit" class="btn-primary text-sm" disabled={saving}>{submitLabel}</button>
    <button type="button" class="btn-secondary text-sm" onclick={onCancel}>Cancel</button>
  </div>
</form>