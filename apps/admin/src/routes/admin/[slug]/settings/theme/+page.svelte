<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Loader } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let dirty = $state(false);

  let form = $state({
    layout_preset: 'glass-dark',
    primary_color: '#1e3a8a',
    accent_color: '#10b981',
    font_heading: 'Inter',
    font_body: 'Inter',
    time_format: '24h' as '12h' | '24h',
    label_adhaan: '',
    label_iqaamah: '',
    label_jumuah: '',
    label_sunrise: '',
    label_fajr: '',
    label_dhuhr: '',
    label_asr: '',
    label_maghrib: '',
    label_isha: '',
  });

  const presets = [
    { value: 'glass-dark', label: 'Glass Dark', desc: 'Dark glassmorphism' },
    { value: 'minimal-light', label: 'Minimal Light', desc: 'Clean light mode' },
    { value: 'modern_minimal', label: 'Modern', desc: 'Modern default' },
  ];

  const fonts = [
    'Inter', 'Roboto', 'Amiri', 'Noto Naskh Arabic', 'Scheherazade New',
    'Georgia', 'serif', 'sans-serif',
  ];

  const labelDefaults: Record<string, string> = {
    label_adhaan: 'Adhaan', label_iqaamah: 'Iqaamah', label_jumuah: "Jumu'ah",
    label_sunrise: 'Sunrise', label_fajr: 'Fajr', label_dhuhr: 'Dhuhr',
    label_asr: 'Asr', label_maghrib: 'Maghrib', label_isha: 'Isha',
  };

  function indoPakPreset() {
    dirty = true;
    form.label_adhaan = 'Azaan';
    form.label_iqaamah = 'Iqamah';
    form.label_jumuah = 'Jummah';
    form.label_dhuhr = 'Zuhr';
    form.time_format = '12h';
    form.font_body = 'Roboto';
    form.font_heading = 'Inter';
    toast.success('Indo-Pak preset applied');
  }

  $effect(() => {
    loadTheme();
  });

  function handleChange() { dirty = true; }

  async function loadTheme() {
    try {
      const profile = await api.getProfile(auth.admin!.masjid_id);
      const t = profile.theme;
      if (t) {
        form = {
          layout_preset: t.layout_preset || 'glass-dark',
          primary_color: t.primary_color || '#1e3a8a',
          accent_color: t.accent_color || '#10b981',
          font_heading: t.font_heading || 'Inter',
          font_body: t.font_body || 'Inter',
          time_format: t.time_format || '24h',
          label_adhaan: t.label_adhaan || '',
          label_iqaamah: t.label_iqaamah || '',
          label_jumuah: t.label_jumuah || '',
          label_sunrise: t.label_sunrise || '',
          label_fajr: t.label_fajr || '',
          label_dhuhr: t.label_dhuhr || '',
          label_asr: t.label_asr || '',
          label_maghrib: t.label_maghrib || '',
          label_isha: t.label_isha || '',
        };
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load theme';
    } finally {
      loading = false;
    }
  }

  async function handleSave(e: Event) {
    e.preventDefault();
    saving = true;
    error = null;
    try {
      await api.updateProfile(auth.admin!.masjid_id, {
        ...form,
        time_format: form.time_format,
      });
      dirty = false;
      toast.success('Theme updated');
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to save';
      toast.error('Failed to save');
    } finally {
      saving = false;
    }
  }
</script>

<div class="max-w-3xl mx-auto">
  <h1 class="text-2xl font-heading font-bold mb-2">Theme</h1>
  <p class="text-text-muted text-sm mb-6">Customize your masjid's appearance</p>

  {#if loading}
    <SkeletonForm fields={8} />
  {:else}
    <form onsubmit={handleSave}>
      <div class="space-y-6">
        <!-- Presets -->
        <div class="bg-surface border border-border rounded-xl p-6">
          <h2 class="font-heading font-semibold text-text mb-3">Layout Preset</h2>
          <div class="grid grid-cols-3 gap-3">
            {#each presets as preset}
              <button
                type="button"
                class="border rounded-lg p-3 text-sm text-left transition-colors {form.layout_preset === preset.value ? 'border-accent bg-accent/10 text-accent' : 'border-border hover:border-text-muted text-text-muted'}"
                onclick={() => { form.layout_preset = preset.value; dirty = true; }}
              >
                <div class="font-medium">{preset.label}</div>
                <div class="text-xs mt-0.5 opacity-70">{preset.desc}</div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Colors -->
        <div class="bg-surface border border-border rounded-xl p-6">
          <h2 class="font-heading font-semibold text-text mb-4">Colors</h2>
          <div class="form-row">
            <div class="form-group">
              <label for="primary_color">Primary Color</label>
              <div class="flex gap-2">
                <input id="primary_color" type="color" class="w-12 h-9 p-0 border-0 cursor-pointer rounded" bind:value={form.primary_color} oninput={handleChange} />
                <input type="text" class="flex-1 font-mono text-sm" bind:value={form.primary_color} oninput={handleChange} placeholder="#1e3a8a" />
              </div>
            </div>
            <div class="form-group">
              <label for="accent_color">Accent Color</label>
              <div class="flex gap-2">
                <input id="accent_color" type="color" class="w-12 h-9 p-0 border-0 cursor-pointer rounded" bind:value={form.accent_color} oninput={handleChange} />
                <input type="text" class="flex-1 font-mono text-sm" bind:value={form.accent_color} oninput={handleChange} placeholder="#10b981" />
              </div>
            </div>
          </div>
        </div>

        <!-- Fonts -->
        <div class="bg-surface border border-border rounded-xl p-6">
          <h2 class="font-heading font-semibold text-text mb-4">Typography</h2>
          <div class="form-row">
            <div class="form-group">
              <label for="font_heading">Heading Font</label>
              <select id="font_heading" class="w-full" bind:value={form.font_heading} onchange={handleChange}>
                {#each fonts as f}
                  <option value={f}>{f}</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label for="font_body">Body Font</label>
              <select id="font_body" class="w-full" bind:value={form.font_body} onchange={handleChange}>
                {#each fonts as f}
                  <option value={f}>{f}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <!-- Time format -->
        <div class="bg-surface border border-border rounded-xl p-6">
          <h2 class="font-heading font-semibold text-text mb-3">Time Format</h2>
          <div class="flex gap-3">
            <button
              type="button"
              class="px-4 py-2 rounded-lg text-sm border transition-colors {form.time_format === '12h' ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted hover:border-text-muted'}"
              onclick={() => { form.time_format = '12h'; dirty = true; }}
            >
              12-hour (1:30 PM)
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg text-sm border transition-colors {form.time_format === '24h' ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted hover:border-text-muted'}"
              onclick={() => { form.time_format = '24h'; dirty = true; }}
            >
              24-hour (13:30)
            </button>
          </div>
        </div>

        <!-- Labels -->
        <div class="bg-surface border border-border rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-heading font-semibold text-text">Labels</h2>
            <button type="button" class="btn-secondary text-xs" onclick={indoPakPreset}>
              Indo-Pak Preset
            </button>
          </div>
          <p class="text-xs text-text-muted mb-4">Customize prayer time labels. Leave empty to use defaults.</p>
          <div class="grid grid-cols-2 gap-4">
            {#each Object.keys(labelDefaults) as key}
              <div class="form-group">
                <label for={key}>{key.replace('label_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
                <input
                  id={key}
                  type="text"
                  class="w-full"
                  bind:value={form[key as keyof typeof form]}
                  oninput={handleChange}
                  placeholder={labelDefaults[key]}
                />
              </div>
            {/each}
          </div>
        </div>

        {#if error}
          <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p class="text-red-400 text-sm">{error}</p>
          </div>
        {/if}

        <button type="submit" class="btn-primary" disabled={saving || !dirty}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  {/if}
</div>
