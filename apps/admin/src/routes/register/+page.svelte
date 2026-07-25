<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte';

  const API_BASE = import.meta.env.VITE_API_URL || '';

  let slug = $state('');
  let name = $state('');
  let latitude = $state('');
  let longitude = $state('');
  let timezone = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);
  let calculationMethod = $state('2');
  let adminEmail = $state('');
  let adminPassword = $state('');
  let adminDisplayName = $state('');
  let error = $state<string | null>(null);
  let submitting = $state(false);

  const timezones = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver',
    'America/Mexico_City', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
    'Europe/Amsterdam', 'Europe/Stockholm', 'Europe/Moscow', 'Europe/Istanbul',
    'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka',
    'Asia/Jakarta', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Tokyo',
    'Asia/Shanghai', 'Asia/Seoul', 'Asia/Manila',
    'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg', 'Africa/Nairobi',
    'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
    'Pacific/Auckland', 'Pacific/Fiji',
  ];

  const methods: Record<string, string> = {
    '1': 'University of Islamic Sciences, Karachi',
    '2': 'ISNA (Islamic Society of North America)',
    '3': 'MWL (Muslim World League)',
    '4': 'Umm al-Qura, Makkah',
    '5': 'Egyptian General Authority of Survey',
    '7': 'Union of Islamic Organisations of France',
  };

  let slugAuto = $state(true);

  function onNameInput() {
    if (slugAuto) {
      slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
  }

  function onSlugInput() {
    slugAuto = false;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (!name.trim() || !slug.trim() || !adminEmail.trim() || !adminPassword.trim() || isNaN(lat) || isNaN(lng)) {
      error = 'Please fill in all required fields.';
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      error = 'Slug must be lowercase alphanumeric with hyphens (e.g. masjid-al-noor).';
      return;
    }
    if (adminPassword.length < 8) {
      error = 'Password must be at least 8 characters.';
      return;
    }
    if (lat < -90 || lat > 90) {
      error = 'Latitude must be between -90 and 90.';
      return;
    }
    if (lng < -180 || lng > 180) {
      error = 'Longitude must be between -180 and 180.';
      return;
    }

    submitting = true;
    try {
      await auth.register({
        slug: slug.trim(),
        name: name.trim(),
        latitude: lat,
        longitude: lng,
        timezone,
        calculation_method: parseInt(calculationMethod, 10),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
        admin_display_name: adminDisplayName.trim() || undefined,
      });
      goto(`/admin/${slug.trim()}`);
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Registration failed';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="min-h-dvh flex items-center justify-center p-4">
  <div class="w-full max-w-lg animate-fade-in-up">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-heading font-bold text-text">Create Your Masjid</h1>
      <p class="text-text-muted text-sm mt-1">Set up your masjid in under a minute</p>
    </div>

    <div class="bg-surface border border-border rounded-xl p-6">
      <form onsubmit={handleSubmit}>
        <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Masjid Details</h2>

        <div class="form-group">
          <label for="name">Masjid Name</label>
          <input
            id="name"
            type="text"
            class="w-full"
            placeholder="Masjid Al-Noor"
            bind:value={name}
            oninput={onNameInput}
          />
        </div>

        <div class="form-group">
          <label for="slug">URL Slug</label>
          <input
            id="slug"
            type="text"
            class="w-full font-mono text-sm"
            placeholder="masjid-al-noor"
            bind:value={slug}
            oninput={onSlugInput}
          />
          <p class="text-xs text-text-muted mt-1">Your public page at <span class="text-accent">{slug || '...'}</span></p>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="latitude">Latitude</label>
            <input
              id="latitude"
              type="text"
              inputmode="decimal"
              class="w-full"
              placeholder="41.8781"
              bind:value={latitude}
            />
          </div>
          <div class="form-group">
            <label for="longitude">Longitude</label>
            <input
              id="longitude"
              type="text"
              inputmode="decimal"
              class="w-full"
              placeholder="-87.6298"
              bind:value={longitude}
            />
          </div>
        </div>
        <p class="text-xs text-text-muted mb-4">Find coordinates on <a href="https://maps.google.com" target="_blank" rel="noopener" class="text-accent underline">Google Maps</a> (right-click a location).</p>

        <div class="form-row">
          <div class="form-group">
            <label for="timezone">Timezone</label>
            <select id="timezone" class="w-full" bind:value={timezone}>
              {#each timezones as tz}
                <option value={tz}>{tz}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label for="method">Prayer Calculation</label>
            <select id="method" class="w-full" bind:value={calculationMethod}>
              {#each Object.entries(methods) as [value, label]}
                <option value={value}>{label}</option>
              {/each}
            </select>
          </div>
        </div>

        <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3 mt-6 pt-4 border-t border-border">Admin Account</h2>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            class="w-full"
            placeholder="admin@masjid.org"
            bind:value={adminEmail}
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="displayName">Display Name (optional)</label>
          <input
            id="displayName"
            type="text"
            class="w-full"
            placeholder="Imam Ahmad"
            bind:value={adminDisplayName}
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            class="w-full"
            placeholder="Min. 8 characters"
            bind:value={adminPassword}
            autocomplete="new-password"
          />
        </div>

        {#if error}
          <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p class="text-red-400 text-sm">{error}</p>
          </div>
        {/if}

        <button type="submit" class="btn-primary w-full justify-center mt-2" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Masjid'}
        </button>
      </form>
    </div>

    <p class="text-text-muted text-sm text-center mt-4">
      Already have an account? <a href="/login" class="text-accent underline">Sign in</a>
    </p>
  </div>
</div>