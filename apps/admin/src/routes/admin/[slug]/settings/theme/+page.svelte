<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { metalPalettes } from '@masjid/ui-utils';
  import ImageTracer from 'imagetracerjs';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  // Separate from save errors: a failed initial GET must not render a
  // saveable form full of default values (they'd clobber the real theme).
  let loadError = $state<string | null>(null);
  let dirty = $state(false);
  let tracing = $state(false);
  let traceError = $state('');

  let form = $state({
    style_system: 'sakeenah' as 'sakeenah' | 'mishkaat',
    style_options: {
      metal: 'gold' as string,
      motif: 'eight-point-star' as string,
      arch: true,
      numerals: 'western' as string,
      density: 'standard' as string,
      ambient: true,
      themeMode: 'dark' as string,
      quietHours: {
        enabled: false,
        quietMinutes: 10,
        sleepAfterIshaMinutes: 90,
        wakeBeforeFajrMinutes: 30,
      },
      frames: [] as string[],
      emblem: 'medallion' as string,
      donateAppeal: '',
      photoUrl: '',
      logoUrl: '',
      engravedSvg: '',
      donateReasons: [
        { icon: '🕌', title: 'Maintain the House of Allah', desc: 'Keep our masjid clean, safe, and welcoming' },
        { icon: '📚', title: 'Support Education', desc: 'Fund classes, lectures, and youth programs' },
        { icon: '🤝', title: 'Serve the Community', desc: 'Help those in need through outreach programs' },
      ] as Array<{ icon: string; title: string; desc: string }>,
    },
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
    label_speech: '',
  });

  const fonts = [
    'Inter', 'Roboto', 'Amiri', 'Noto Naskh Arabic', 'Scheherazade New',
    'Georgia', 'serif', 'sans-serif',
  ];

  const labelDefaults: Record<string, string> = {
    label_adhaan: 'Adhaan', label_iqaamah: 'Iqaamah', label_jumuah: "Jumu'ah",
    label_sunrise: 'Sunrise', label_fajr: 'Fajr', label_dhuhr: 'Dhuhr',
    label_asr: 'Asr', label_maghrib: 'Maghrib', label_isha: 'Isha',
    label_speech: 'Speech',
  };

  const metals = ['gold', 'silver', 'copper', 'rose'];
  const motifs = ['eight-point-star', 'honeycomb', 'girih', 'arabesque', 'none'];
  const frameOptions = [
    { value: 'jumuah', label: "Jumu'ah Times" },
    { value: 'hadith', label: 'Hadith of the Day' },
    { value: 'announcements', label: 'Announcements' },
    { value: 'donate', label: 'Donate Appeal' },
    { value: 'qr', label: 'Scan to Give (QR)' },
    { value: 'community', label: 'Community Frames' },
  ];

  function handleChange() { dirty = true; }

  function toggleFrame(frame: string) {
    dirty = true;
    const idx = form.style_options.frames.indexOf(frame);
    if (idx === -1) {
      form.style_options.frames = [...form.style_options.frames, frame];
    } else {
      form.style_options.frames = form.style_options.frames.filter(f => f !== frame);
    }
  }

  function setStyleSystem(system: 'sakeenah' | 'mishkaat') {
    dirty = true;
    form.style_system = system;
    if (system === 'mishkaat') {
      form.layout_preset = 'mishkaat';
    } else {
      form.layout_preset = 'glass-dark';
    }
  }

  const sakeenahPresets = [
    { value: 'glass-dark', label: 'Glass Dark', desc: 'Dark glassmorphism panels' },
    { value: 'minimal-light', label: 'Minimal Light', desc: 'Clean light mode' },
  ];

  function indoPakPreset() {
    dirty = true;
    form.label_adhaan = 'Azaan';
    form.label_iqaamah = 'Iqamah';
    form.label_jumuah = 'Jummah';
    form.label_dhuhr = 'Zuhr';
    form.label_speech = 'Bayaan';
    form.time_format = '12h';
    form.font_body = 'Roboto';
    form.font_heading = 'Inter';
    toast.success('Indo-Pak preset applied');
  }

  function englishStandardPreset() {
    dirty = true;
    form.label_adhaan = 'Adhaan';
    form.label_iqaamah = 'Iqaamah';
    form.label_jumuah = "Jumu'ah";
    form.label_dhuhr = 'Dhuhr';
    form.label_speech = 'Speech';
    form.label_sunrise = 'Sunrise';
    form.label_fajr = 'Fajr';
    form.label_asr = 'Asr';
    form.label_maghrib = 'Maghrib';
    form.label_isha = 'Isha';
    toast.success('Standard English preset applied');
  }

  function arabicPreset() {
    dirty = true;
    form.label_adhaan = 'Adhan';
    form.label_iqaamah = 'Iqama';
    form.label_jumuah = "Jumu'ah";
    form.label_dhuhr = 'Dhuhr';
    form.label_speech = 'Khutbah';
    form.label_asr = 'Asr';
    toast.success('Arabic transliteration preset applied');
  }

  function turkishPreset() {
    dirty = true;
    form.label_adhaan = 'Ezan';
    form.label_iqaamah = 'Kamet';
    form.label_jumuah = 'Cuma';
    form.label_dhuhr = 'Öğle';
    form.label_speech = 'Hutbe';
    form.label_sunrise = 'Güneş';
    form.label_fajr = 'Sabah';
    form.label_asr = 'İkindi';
    form.label_maghrib = 'Akşam';
    form.label_isha = 'Yatsı';
    form.time_format = '24h';
    toast.success('Turkish preset applied');
  }

  function malayPreset() {
    dirty = true;
    form.label_adhaan = 'Azan';
    form.label_iqaamah = 'Iqamat';
    form.label_jumuah = 'Jumaat';
    form.label_dhuhr = 'Zohor';
    form.label_speech = 'Khutbah';
    form.label_asr = 'Asar';
    form.label_maghrib = 'Maghrib';
    toast.success('Malay preset applied');
  }

  function bosnianPreset() {
    dirty = true;
    form.label_adhaan = 'Ezan';
    form.label_iqaamah = 'Ikamet';
    form.label_jumuah = 'Džuma';
    form.label_dhuhr = 'Podne';
    form.label_speech = 'Hutba';
    form.label_asr = 'Ikindija';
    form.label_maghrib = 'Akšam';
    form.label_isha = 'Jacija';
    form.time_format = '24h';
    toast.success('Bosnian preset applied');
  }

  $effect(() => {
    loadTheme();
  });

  async function loadTheme() {
    try {
      const profile = await api.getProfile(auth.admin!.masjid_id);
      const t = profile.theme;
      if (t) {
        form.style_system = t.style_system || 'sakeenah';
        form.style_options = deepMerge(form.style_options, t.style_options || {});
        form.layout_preset = t.layout_preset || 'glass-dark';
        form.primary_color = t.primary_color || '#1e3a8a';
        form.accent_color = t.accent_color || '#10b981';
        form.font_heading = t.font_heading || 'Inter';
        form.font_body = t.font_body || 'Inter';
        form.time_format = t.time_format || '24h';
        form.label_adhaan = t.label_adhaan || '';
        form.label_iqaamah = t.label_iqaamah || '';
        form.label_jumuah = t.label_jumuah || '';
        form.label_sunrise = t.label_sunrise || '';
        form.label_fajr = t.label_fajr || '';
        form.label_dhuhr = t.label_dhuhr || '';
        form.label_asr = t.label_asr || '';
        form.label_maghrib = t.label_maghrib || '';
        form.label_isha = t.label_isha || '';
        form.label_speech = t.label_speech || '';
      }
    } catch (e: unknown) {
      loadError = e instanceof Error ? e.message : 'Failed to load theme';
    } finally {
      loading = false;
    }
  }

  function deepMerge(defaults: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
    const result = { ...defaults };
    for (const key of Object.keys(overrides)) {
      const ov = overrides[key];
      if (ov !== null && typeof ov === 'object' && !Array.isArray(ov) && key in defaults && typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])) {
        result[key] = deepMerge(defaults[key] as Record<string, unknown>, ov as Record<string, unknown>);
      } else {
        result[key] = ov;
      }
    }
    return result;
  }

  function generateEngraving() {
    const url = form.style_options.photoUrl;
    if (!url) return;
    tracing = true;
    traceError = '';
    ImageTracer.imageToSVG(
      url,
      (svg: string) => {
        form.style_options.engravedSvg = svg;
        dirty = true;
        tracing = false;
        toast.success('Engraving generated');
      },
      {
        corsenabled: true,
        numberofcolors: 3,
        strokewidth: 1.5,
        scale: 1,
      },
    );
    setTimeout(() => {
      if (tracing) {
        tracing = false;
        traceError = 'Tracing timed out — the image may be too large or unreachable. Ensure the photo URL is accessible (CORS-friendly) and try again.';
      }
    }, 30000);
  }

  async function handleSave(e: Event) {
    e.preventDefault();
    saving = true;
    error = null;
    try {
      await api.updateProfile(auth.admin!.masjid_id, {
        style_system: form.style_system,
        style_options: form.style_options,
        layout_preset: form.layout_preset,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
        font_heading: form.font_heading,
        font_body: form.font_body,
        time_format: form.time_format,
        label_adhaan: form.label_adhaan,
        label_iqaamah: form.label_iqaamah,
        label_jumuah: form.label_jumuah,
        label_sunrise: form.label_sunrise,
        label_fajr: form.label_fajr,
        label_dhuhr: form.label_dhuhr,
        label_asr: form.label_asr,
        label_maghrib: form.label_maghrib,
        label_isha: form.label_isha,
        label_speech: form.label_speech,
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
  {:else if loadError}
    <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
      <p class="text-red-400 text-sm mb-1">Failed to load theme</p>
      <p class="text-red-400/70 text-xs mb-4">{loadError}</p>
      <button
        class="btn-secondary text-sm"
        onclick={() => { loadError = null; loading = true; loadTheme(); }}
      >
        Retry
      </button>
    </div>
  {:else}
    <form onsubmit={handleSave}>
      <div class="space-y-6">
        <!-- Style System -->
        <div class="bg-surface border border-border rounded-xl p-6">
          <h2 class="font-heading font-semibold text-text mb-3">Style</h2>
          <p class="text-xs text-text-muted mb-4">Choose your display experience. Mishkaat is the full soul-forward experience with frames, ceremony states, and ambient colors. Sakeenah is simple and minimal.</p>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              class="border rounded-xl p-4 text-left transition-colors {form.style_system === 'mishkaat' ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border hover:border-text-muted text-text-muted'}"
              onclick={() => setStyleSystem('mishkaat')}
            >
              <div class="font-heading font-semibold text-base mb-1.5">Mishkaat</div>
              <div class="text-xs opacity-80 leading-relaxed">The full experience — frames, ceremony states, ambient palette, RTL layout. Warm gold on espresso.</div>
            </button>
            <button
              type="button"
              class="border rounded-xl p-4 text-left transition-colors {form.style_system === 'sakeenah' ? 'border-blue-400 bg-blue-400/10 text-blue-400' : 'border-border hover:border-text-muted text-text-muted'}"
              onclick={() => setStyleSystem('sakeenah')}
            >
              <div class="font-heading font-semibold text-base mb-1.5">Sakeenah</div>
              <div class="text-xs opacity-80 leading-relaxed">Simple &amp; minimal — clean panels, prayer times only. For masjids that want just the times.</div>
            </button>
          </div>
        </div>

        {#if form.style_system === 'mishkaat'}
          <!-- Screen Appearance -->
          <div class="bg-surface border border-border rounded-xl p-6">
            <h2 class="font-heading font-semibold text-text mb-4">Screen Appearance</h2>

            <!-- Metal -->
            <div class="mb-5">
              <label class="block text-sm font-medium text-text mb-2">Metal</label>
              <p class="text-xs text-text-muted mb-2">Accent metal finish — your primary styling knob. Gold is the default.</p>
              <div class="flex flex-wrap gap-2">
                {#each metals as metal}
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg text-xs border transition-colors capitalize {form.style_options.metal === metal ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-text-muted hover:border-text-muted'}"
                    onclick={() => { form.style_options.metal = metal; form.primary_color = metalPalettes[metal as keyof typeof metalPalettes].primary; form.accent_color = metalPalettes[metal as keyof typeof metalPalettes].accent; dirty = true; }}
                  >
                    {metal}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Light/Dark Mode -->
            <div class="mb-5">
              <label class="block text-sm font-medium text-text mb-2">Theme Mode</label>
              <p class="text-xs text-text-muted mb-2">Light mode uses a warm cream background; dark mode uses deep espresso. The metal palette colors the accents in both.</p>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm border transition-colors {form.style_options.themeMode === 'dark' ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-text-muted hover:border-text-muted'}"
                  onclick={() => { form.style_options.themeMode = 'dark'; dirty = true; }}
                >Dark</button>
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm border transition-colors {form.style_options.themeMode === 'light' ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-text-muted hover:border-text-muted'}"
                  onclick={() => { form.style_options.themeMode = 'light'; dirty = true; }}
                >Light</button>
              </div>
            </div>

            <!-- Motif -->
            <div class="mb-5">
              <label class="block text-sm font-medium text-text mb-2">Pattern</label>
              <p class="text-xs text-text-muted mb-2">Ornamental band motif on the prayer board. Rendered tone-on-tone at low contrast.</p>
              <div class="flex flex-wrap gap-2">
                {#each motifs as motif}
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg text-xs border transition-colors capitalize {form.style_options.motif === motif ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-text-muted hover:border-text-muted'}"
                    onclick={() => { form.style_options.motif = motif; dirty = true; }}
                  >
                    {motif.replace(/-/g, ' ')}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Arch -->
            <div class="mb-5 flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-text">Arch</label>
                <p class="text-xs text-text-muted">Show the mihrab arch niche around the clock</p>
              </div>
              <label class="toggle">
                <input type="checkbox" checked={form.style_options.arch} onchange={() => { form.style_options.arch = !form.style_options.arch; dirty = true; }} />
                <span class="toggle-slider"></span>
              </label>
            </div>

            <!-- Numerals -->
            <div class="mb-5">
              <label class="block text-sm font-medium text-text mb-2">Numerals</label>
              <p class="text-xs text-text-muted mb-2">Western digits (1, 2, 3) or Arabic-Indic (&#1632;&#1633;&#1634;). Clock hands and layout unaffected.</p>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm border transition-colors {form.style_options.numerals === 'western' ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-text-muted hover:border-text-muted'}"
                  onclick={() => { form.style_options.numerals = 'western'; dirty = true; }}
                >Western (5:29)</button>
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm border transition-colors {form.style_options.numerals === 'arabic-indic' ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-text-muted hover:border-text-muted'}"
                  onclick={() => { form.style_options.numerals = 'arabic-indic'; dirty = true; }}
                >Arabic-Indic (&#1637;:&#1633;&#1633;)</button>
              </div>
            </div>

            <!-- Density -->
            <div class="mb-5">
              <label class="block text-sm font-medium text-text mb-2">Density</label>
              <p class="text-xs text-text-muted mb-2">Large print for aging congregations.</p>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm border transition-colors {form.style_options.density === 'standard' ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-text-muted hover:border-text-muted'}"
                  onclick={() => { form.style_options.density = 'standard'; dirty = true; }}
                >Standard</button>
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-sm border transition-colors {form.style_options.density === 'large-print' ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-text-muted hover:border-text-muted'}"
                  onclick={() => { form.style_options.density = 'large-print'; dirty = true; }}
                >Large Print</button>
              </div>
            </div>
          </div>

          <!-- Day & Night Colors -->
          <div class="bg-surface border border-border rounded-xl p-6">
            <h2 class="font-heading font-semibold text-text mb-3">Day &amp; Night Colors</h2>
            <p class="text-xs text-text-muted mb-4">Ambient palette shifts the background tint through the solar day — deep blue before Fajr, gold at sunrise, neutral midday, amber approaching Maghrib, deep night after Isha. Subtle tints only; content colors never change.</p>
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-text">Enable ambient palette</label>
                <p class="text-xs text-text-muted">Let the screen breathe with the time of day</p>
              </div>
              <label class="toggle">
                <input type="checkbox" checked={form.style_options.ambient} onchange={() => { form.style_options.ambient = !form.style_options.ambient; dirty = true; }} />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <!-- Quiet Hours -->
          <div class="bg-surface border border-border rounded-xl p-6">
            <h2 class="font-heading font-semibold text-text mb-4">Quiet Hours</h2>
            <p class="text-xs text-text-muted mb-4">The screen observes the room's etiquette — it quiets itself after salah and dims at night. Configure the timing below.</p>

            <div class="flex items-center justify-between mb-5">
              <div>
                <label class="text-sm font-medium text-text">Enable quiet hours</label>
                <p class="text-xs text-text-muted">Post-iqaamah quiet mode and night calm veil</p>
              </div>
              <label class="toggle">
                <input type="checkbox" checked={form.style_options.quietHours.enabled} onchange={() => { form.style_options.quietHours.enabled = !form.style_options.quietHours.enabled; dirty = true; }} />
                <span class="toggle-slider"></span>
              </label>
            </div>

            {#if form.style_options.quietHours.enabled}
              <div class="space-y-4 pl-2 border-l-2 border-border">
                <div class="form-group">
                  <label for="quietMinutes">Quiet minutes after iqaamah</label>
                  <p class="text-xs text-text-muted mb-1">Screen dims after iqaamah and stays quiet for this many minutes</p>
                  <input id="quietMinutes" type="number" min="0" max="180" class="w-32" bind:value={form.style_options.quietHours.quietMinutes} oninput={handleChange} />
                </div>
                <div class="form-group">
                  <label for="sleepAfterIshaMinutes">Sleep after Isha (minutes)</label>
                  <p class="text-xs text-text-muted mb-1">Night calm veil settles this many minutes after Isha iqaamah</p>
                  <input id="sleepAfterIshaMinutes" type="number" min="0" max="360" class="w-32" bind:value={form.style_options.quietHours.sleepAfterIshaMinutes} oninput={handleChange} />
                </div>
                <div class="form-group">
                  <label for="wakeBeforeFajrMinutes">Wake before Fajr (minutes)</label>
                  <p class="text-xs text-text-muted mb-1">Night calm veil lifts this many minutes before Fajr adhaan</p>
                  <input id="wakeBeforeFajrMinutes" type="number" min="0" max="180" class="w-32" bind:value={form.style_options.quietHours.wakeBeforeFajrMinutes} oninput={handleChange} />
                </div>
              </div>
            {/if}
          </div>

          <!-- Screen Panels (Frames) -->
          <div class="bg-surface border border-border rounded-xl p-6">
            <h2 class="font-heading font-semibold text-text mb-4">Screen Panels</h2>
            <p class="text-xs text-text-muted mb-4">The soul column rotates through content panels on the TV display. Enable the panels you want to show. Empty panels never render.</p>
            <div class="space-y-2.5">
              {#each frameOptions as frame}
                <label class="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-text-muted transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    class="w-4 h-4 rounded accent-amber-400"
                    checked={form.style_options.frames.includes(frame.value)}
                    onchange={() => toggleFrame(frame.value)}
                  />
                  <span class="text-sm text-text">{frame.label}</span>
                </label>
              {/each}
            </div>
          </div>

          <!-- Masjid Logo -->
          <div class="bg-surface border border-border rounded-xl p-6">
            <h2 class="font-heading font-semibold text-text mb-3">Masjid Logo</h2>
            <p class="text-xs text-text-muted mb-4">Choose how your masjid identity appears. Engraved renders a line-art version of your building photo (requires a photo URL set in the Images section above). Medallion uses the eight-point star as default.</p>
            <div class="flex gap-2 mb-4">
              <button
                type="button"
                class="px-4 py-2 rounded-lg text-sm border transition-colors {form.style_options.emblem === 'medallion' ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-text-muted hover:border-text-muted'}"
                onclick={() => { form.style_options.emblem = 'medallion'; dirty = true; }}
              >Medallion (star)</button>
              <button
                type="button"
                class="px-4 py-2 rounded-lg text-sm border transition-colors {form.style_options.emblem === 'engraved' ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-border text-text-muted hover:border-text-muted'}"
                onclick={() => { form.style_options.emblem = 'engraved'; dirty = true; }}
              >Engraved (photo)</button>
            </div>
            {#if form.style_options.emblem === 'engraved'}
              {#if !form.style_options.photoUrl}
                <p class="text-xs text-text-dim">Set a photo URL in the Images section above first, then generate the engraving.</p>
              {:else if form.style_options.engravedSvg}
                <div class="mb-3 p-3 rounded-lg border border-border bg-surface">
                  <p class="text-xs text-text-muted mb-2">Engraving preview:</p>
                  {@html form.style_options.engravedSvg}
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn-secondary text-xs"
                    disabled={tracing}
                    onclick={generateEngraving}
                  >{tracing ? 'Tracing...' : 'Regenerate'}</button>
                  <button
                    type="button"
                    class="text-xs text-red-400 hover:text-red-300"
                    onclick={() => { form.style_options.engravedSvg = ''; dirty = true; }}
                  >Clear</button>
                </div>
              {:else}
                <button
                  type="button"
                  class="btn-primary text-xs"
                  disabled={tracing}
                  onclick={generateEngraving}
                >{tracing ? 'Tracing...' : 'Generate Engraving'}</button>
                {#if traceError}
                  <p class="text-xs text-red-400 mt-2">{traceError}</p>
                {/if}
              {/if}
            {/if}
          </div>

          <!-- Donate Appeal -->
          <div class="bg-surface border border-border rounded-xl p-6">
            <h2 class="font-heading font-semibold text-text mb-3">Donate Appeal</h2>
            <p class="text-xs text-text-muted mb-2">Short appeal text shown on the donate frame (max 80 characters).</p>
            <div class="form-group">
              <input
                id="donateAppeal"
                type="text"
                class="w-full"
                maxlength="80"
                bind:value={form.style_options.donateAppeal}
                oninput={handleChange}
                placeholder="Every contribution makes a difference"
              />
              <p class="text-xs text-text-muted mt-1">{form.style_options.donateAppeal.length}/80</p>
            </div>
          </div>
        {/if}

        <!-- Layout Preset (Sakeenah only) -->
        {#if form.style_system === 'sakeenah'}
          <div class="bg-surface border border-border rounded-xl p-6">
            <h2 class="font-heading font-semibold text-text mb-3">Layout Preset</h2>
            <div class="grid grid-cols-2 gap-3">
              {#each sakeenahPresets as preset}
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
        {/if}

        <!-- Colors -->
        <div class="bg-surface border border-border rounded-xl p-6">
          <h2 class="font-heading font-semibold text-text mb-4">Colors</h2>
          {#if form.style_system === 'mishkaat'}
            <p class="text-xs text-text-muted mb-4">Custom colors override the metal palette. Leave at defaults to use the metal scheme.</p>
          {/if}
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
          <h2 class="font-heading font-semibold text-text mb-4">Labels</h2>
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

          <div class="mt-6 pt-4 border-t border-border">
            <p class="text-xs text-text-muted mb-3">Apply Preset</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn-secondary text-xs" onclick={indoPakPreset} title="Azaan, Iqamah, Zuhr, Jummah, Bayaan · 12h, Roboto">Indo-Pak</button>
              <button type="button" class="btn-secondary text-xs" onclick={englishStandardPreset} title="Adhaan, Iqaamah, Dhuhr, Jumu'ah, Speech, Sunrise, Fajr, Asr, Maghrib, Isha">Standard English</button>
              <button type="button" class="btn-secondary text-xs" onclick={arabicPreset} title="Adhan, Iqama, Dhuhr, Jumu'ah, Khutbah">Arabic</button>
              <button type="button" class="btn-secondary text-xs" onclick={turkishPreset} title="Ezan, Kamet, Öğle, Cuma, Hutbe, Güneş, Sabah, İkindi, Akşam, Yatsı · 24h">Turkish</button>
              <button type="button" class="btn-secondary text-xs" onclick={malayPreset} title="Azan, Iqamat, Zohor, Jumaat, Khutbah, Asar">Malay</button>
              <button type="button" class="btn-secondary text-xs" onclick={bosnianPreset} title="Ezan, Ikamet, Podne, Džuma, Hutba, Ikindija, Akšam, Jacija · 24h">Bosnian</button>
            </div>
          </div>
        </div>

        <!-- Images -->
        <div class="bg-surface border border-border rounded-xl p-6">
          <h2 class="font-heading font-semibold text-text mb-4">Images</h2>
          <p class="text-xs text-text-muted mb-4">Upload or link a homepage photo and a header logo image.</p>
          <div class="space-y-4">
            <div class="form-group">
              <label for="photoUrl">Homepage Photo URL</label>
              <p class="text-xs text-text-muted mb-1">Shown as the hero banner on the homepage.</p>
              <input
                id="photoUrl"
                type="text"
                class="w-full"
                bind:value={form.style_options.photoUrl}
                oninput={handleChange}
                placeholder="https://example.com/masjid-photo.jpg"
              />
              {#if form.style_options.photoUrl}
                <img src={form.style_options.photoUrl} alt="Homepage photo preview" class="mt-2 rounded-lg max-h-32 border border-border" onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              {/if}
            </div>
            <div class="form-group">
              <label for="logoUrl">Header Logo URL</label>
              <p class="text-xs text-text-muted mb-1">Replaces the default rosette/avatar in the header.</p>
              <input
                id="logoUrl"
                type="text"
                class="w-full"
                bind:value={form.style_options.logoUrl}
                oninput={handleChange}
                placeholder="https://example.com/masjid-logo.png"
              />
              {#if form.style_options.logoUrl}
                <img src={form.style_options.logoUrl} alt="Logo preview" class="mt-2 rounded-lg max-h-12 border border-border" onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              {/if}
            </div>
          </div>
        </div>

        <!-- Donate Reasons -->
        <div class="bg-surface border border-border rounded-xl p-6">
          <h2 class="font-heading font-semibold text-text mb-4">Donate Reasons</h2>
          <p class="text-xs text-text-muted mb-4">Customize the "Why Give?" cards on the Donate page (icon, title, description). Up to 8 cards.</p>
          <div class="space-y-3">
            {#each form.style_options.donateReasons as reason, i (i)}
              <div class="grid grid-cols-[2.5rem_1fr_1fr] gap-3 items-start p-3 rounded-lg border border-border">
                <input
                  type="text"
                  class="w-full text-center text-lg"
                  bind:value={reason.icon}
                  oninput={handleChange}
                  maxlength="10"
                  placeholder="🕌"
                  aria-label="Card {i + 1} icon"
                />
                <div class="space-y-1">
                  <input
                    type="text"
                    class="w-full text-sm"
                    bind:value={reason.title}
                    oninput={handleChange}
                    maxlength="100"
                    placeholder="Title"
                    aria-label="Card {i + 1} title"
                  />
                  <input
                    type="text"
                    class="w-full text-xs"
                    bind:value={reason.desc}
                    oninput={handleChange}
                    maxlength="200"
                    placeholder="Description"
                    aria-label="Card {i + 1} description"
                  />
                </div>
                <button
                  type="button"
                  class="text-xs text-red-400 hover:text-red-300 self-center"
                  onclick={() => {
                    form.style_options.donateReasons = form.style_options.donateReasons.filter((_, idx) => idx !== i);
                    dirty = true;
                  }}
                  title="Remove card"
                >Remove</button>
              </div>
            {/each}
            {#if form.style_options.donateReasons.length < 8}
              <button
                type="button"
                class="btn-secondary text-xs w-full"
                onclick={() => {
                  form.style_options.donateReasons = [...form.style_options.donateReasons, { icon: '❤️', title: '', desc: '' }];
                  dirty = true;
                }}
              >+ Add Reason</button>
            {:else}
              <p class="text-xs text-text-dim">Maximum 8 cards reached.</p>
            {/if}
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