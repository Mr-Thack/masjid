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
    name: '', address_line1: '', address_line2: '', city: '', state: '',
    postal_code: '', country: 'US', contact_phone: '', contact_email: '',
    facebook_url: '', youtube_url: '', instagram_url: '', website_url: '',
    external_donation_url: '', calculation_method: 2, timezone: 'America/Chicago',
    asr_madhab: 'shafi', high_latitude_rule: 'seventh_of_night',
    show_dual_asr: false,
    latitude: 0, longitude: 0,
  });

  const methods = [
    { value: 2, label: 'ISNA (North America, default)' },
    { value: 3, label: 'Muslim World League' },
    { value: 4, label: 'Umm Al-Qura (Makkah)' },
    { value: 5, label: 'Egyptian General Authority' },
    { value: 7, label: 'University of Islamic Sciences, Karachi' },
    { value: 6, label: 'Institute of Geophysics, Tehran' },
    { value: 8, label: 'Turkey (Diyanet)' },
    { value: 9, label: 'Singapore / Malaysia / Indonesia' },
    { value: 10, label: 'Dubai (UAE)' },
    { value: 11, label: 'Kuwait' },
    { value: 12, label: 'Qatar' },
    { value: 13, label: 'Moonsighting Committee' },
  ];

  const madhabs = [
    { value: 'shafi', label: 'Shafi (earlier Asr)' },
    { value: 'hanafi', label: 'Hanafi (later Asr)' },
  ];

  const highLatRules = [
    { value: 'seventh_of_night', label: 'Seventh of Night (recommended for >48°N)' },
    { value: 'middle_of_night', label: 'Middle of Night' },
    { value: 'twilight_angle', label: 'Twilight Angle' },
    { value: 'none', label: 'None (use raw angles)' },
  ];

  const timezones = [
    'America/Chicago', 'America/New_York', 'America/Denver', 'America/Los_Angeles',
    'America/Detroit', 'America/Phoenix', 'America/Anchorage', 'America/Edmonton',
    'America/Toronto', 'America/Vancouver', 'Europe/London', 'Europe/Paris',
    'Europe/Berlin', 'Asia/Dubai', 'Asia/Doha', 'Asia/Jeddah', 'Asia/Karachi',
    'Asia/Kolkata', 'Asia/Jakarta', 'Asia/Kuala_Lumpur',
  ];

  $effect(() => {
    loadProfile();
  });

  function handleChange() { dirty = true; }

  function handleDirty() { dirty = true; }

  async function loadProfile() {
    try {
      const profile = await api.getProfile(auth.admin!.masjid_id);
      form = {
        name: profile.name || '',
        address_line1: profile.address_line1 || '',
        address_line2: profile.address_line2 || '',
        city: profile.city || '',
        state: profile.state || '',
        postal_code: profile.postal_code || '',
        country: profile.country || 'US',
        contact_phone: profile.contact_phone || '',
        contact_email: profile.contact_email || '',
        facebook_url: profile.facebook_url || '',
        youtube_url: profile.youtube_url || '',
        instagram_url: profile.instagram_url || '',
        website_url: profile.website_url || '',
        external_donation_url: profile.external_donation_url || '',
        calculation_method: profile.calculation_method || 2,
        asr_madhab: profile.asr_madhab || 'shafi',
        high_latitude_rule: profile.high_latitude_rule || 'seventh_of_night',
        show_dual_asr: !!profile.show_dual_asr,
        timezone: profile.timezone || 'America/Chicago',
        latitude: profile.latitude || 0,
        longitude: profile.longitude || 0,
      };
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load profile';
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
        calculation_method: Number(form.calculation_method),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      });
      dirty = false;
      toast.success('Profile updated');
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to save';
      toast.error('Failed to save');
    } finally {
      saving = false;
    }
  }
</script>

<div class="max-w-3xl mx-auto">
  <h1 class="text-2xl font-heading font-bold mb-6">Profile</h1>

  {#if loading}
    <SkeletonForm />
  {:else}
    <form onsubmit={handleSave}>
      <div class="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div class="form-group">
          <label for="name">Masjid Name *</label>
          <input id="name" type="text" class="w-full" bind:value={form.name} oninput={handleChange} required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="address_line1">Address Line 1</label>
            <input id="address_line1" type="text" class="w-full" bind:value={form.address_line1} oninput={handleChange} />
          </div>
          <div class="form-group">
            <label for="address_line2">Address Line 2</label>
            <input id="address_line2" type="text" class="w-full" bind:value={form.address_line2} oninput={handleChange} />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="city">City</label>
            <input id="city" type="text" class="w-full" bind:value={form.city} oninput={handleChange} />
          </div>
          <div class="form-group">
            <label for="state">State</label>
            <input id="state" type="text" class="w-full" bind:value={form.state} oninput={handleChange} />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="postal_code">Postal Code</label>
            <input id="postal_code" type="text" class="w-full" bind:value={form.postal_code} oninput={handleChange} />
          </div>
          <div class="form-group">
            <label for="country">Country</label>
            <input id="country" type="text" class="w-full" bind:value={form.country} oninput={handleChange} />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="contact_phone">Contact Phone</label>
            <input id="contact_phone" type="text" class="w-full" bind:value={form.contact_phone} oninput={handleChange} />
          </div>
          <div class="form-group">
            <label for="contact_email">Contact Email</label>
            <input id="contact_email" type="email" class="w-full" bind:value={form.contact_email} oninput={handleChange} />
          </div>
        </div>

        <div class="form-group">
          <label for="website_url">Website URL</label>
          <input id="website_url" type="url" class="w-full" bind:value={form.website_url} oninput={handleChange} placeholder="https://" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="facebook_url">Facebook URL</label>
            <input id="facebook_url" type="url" class="w-full" bind:value={form.facebook_url} oninput={handleChange} placeholder="https://" />
          </div>
          <div class="form-group">
            <label for="youtube_url">YouTube URL</label>
            <input id="youtube_url" type="url" class="w-full" bind:value={form.youtube_url} oninput={handleChange} placeholder="https://" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="instagram_url">Instagram URL</label>
            <input id="instagram_url" type="url" class="w-full" bind:value={form.instagram_url} oninput={handleChange} placeholder="https://" />
          </div>
          <div class="form-group">
            <label for="external_donation_url">Donation URL</label>
            <input id="external_donation_url" type="url" class="w-full" bind:value={form.external_donation_url} oninput={handleChange} placeholder="https://" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="calculation_method">Calculation Method</label>
            <select id="calculation_method" class="w-full" bind:value={form.calculation_method} onchange={handleChange}>
              {#each methods as m}
                <option value={m.value}>{m.label}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label for="timezone">Timezone</label>
            <select id="timezone" class="w-full" bind:value={form.timezone} onchange={handleChange}>
              {#each timezones as tz}
                <option value={tz}>{tz}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="asr_madhab">Asr Madhab</label>
            <select id="asr_madhab" class="w-full" bind:value={form.asr_madhab} onchange={handleChange}>
              {#each madhabs as m}
                <option value={m.value}>{m.label}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label for="high_latitude_rule">High Latitude Rule</label>
            <select id="high_latitude_rule" class="w-full" bind:value={form.high_latitude_rule} onchange={handleChange}>
              {#each highLatRules as r}
                <option value={r.value}>{r.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" class="w-4 h-4" bind:checked={form.show_dual_asr} onchange={handleChange} />
              <span>Show both Asr times (Shafi + Hanafi)</span>
            </label>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="latitude">Latitude</label>
            <input id="latitude" type="number" step="any" class="w-full" bind:value={form.latitude} oninput={handleChange} />
          </div>
          <div class="form-group">
            <label for="longitude">Longitude</label>
            <input id="longitude" type="number" step="any" class="w-full" bind:value={form.longitude} oninput={handleChange} />
          </div>
        </div>

        {#if error}
          <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p class="text-red-400 text-sm">{error}</p>
          </div>
        {/if}

        <div class="pt-4 border-t border-border">
          <button type="submit" class="btn-primary" disabled={saving || !dirty}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  {/if}
</div>
