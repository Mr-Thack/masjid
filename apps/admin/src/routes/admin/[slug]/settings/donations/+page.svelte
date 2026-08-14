<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { DONATE_REASON_DEFAULTS, type DonateReason } from '@masjid/ui-utils';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  // Separate from save errors: a failed initial GET must not render a saveable
  // form full of default values (they'd clobber the real settings).
  let loadError = $state<string | null>(null);
  let dirty = $state(false);

  let donationLinks = $state<{ label: string; url: string }[]>([]);
  let showDonateQr = $state(true);
  let donateAppeal = $state('');
  let donateReasons = $state<DonateReason[]>([...DONATE_REASON_DEFAULTS]);
  // The profile API replaces style_options wholesale, so keep the full object
  // around and only mutate the donation keys before sending it back.
  let styleOptions = $state<Record<string, unknown>>({});

  $effect(() => { load(); });

  function handleChange() { dirty = true; }

  function parseLinks(raw: string | null | undefined): { label: string; url: string }[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((l: { label?: string; url?: string }) => l && typeof l.url === 'string')
        : [];
    } catch {
      return [];
    }
  }

  async function load() {
    try {
      const profile = await api.getProfile(auth.admin!.masjid_id);
      donationLinks = parseLinks(profile.donation_links);
      showDonateQr = profile.show_donate_qr !== false;
      styleOptions = (profile?.theme?.style_options && typeof profile.theme.style_options === 'object')
        ? profile.theme.style_options as Record<string, unknown>
        : {};
      donateAppeal = typeof styleOptions.donateAppeal === 'string' ? styleOptions.donateAppeal : '';
      const loadedReasons = styleOptions.donateReasons;
      donateReasons = Array.isArray(loadedReasons) && loadedReasons.length > 0
        ? loadedReasons as DonateReason[]
        : [...DONATE_REASON_DEFAULTS];
    } catch (e: unknown) {
      loadError = e instanceof Error ? e.message : 'Failed to load donation settings';
    } finally {
      loading = false;
    }
  }

  function addLink() {
    donationLinks.push({ label: '', url: '' });
    dirty = true;
  }

  function removeLink(index: number) {
    donationLinks.splice(index, 1);
    dirty = true;
  }

  function updateLink(index: number, field: 'label' | 'url', value: string) {
    donationLinks[index][field] = value;
    dirty = true;
  }

  function addReason() {
    donateReasons = [...donateReasons, { icon: '❤️', title: '', desc: '' }];
    dirty = true;
  }

  function removeReason(index: number) {
    donateReasons = donateReasons.filter((_, idx) => idx !== index);
    dirty = true;
  }

  async function handleSave(e: Event) {
    e.preventDefault();
    saving = true;
    error = null;
    try {
      const links = donationLinks
        .filter((l) => l.url.trim().length > 0)
        .map((l) => ({ label: l.label.trim() || 'Donate', url: l.url.trim() }));
      const reasons = donateReasons
        .filter((r) => r.icon.trim().length > 0 && r.title.trim().length > 0 && r.desc.trim().length > 0)
        .map((r) => ({ icon: r.icon.trim(), title: r.title.trim(), desc: r.desc.trim() }));

      await api.updateProfile(auth.admin!.masjid_id, {
        donation_links: JSON.stringify(links),
        show_donate_qr: showDonateQr,
        style_options: { ...styleOptions, donateAppeal: donateAppeal.trim(), donateReasons: reasons },
      });
      dirty = false;
      toast.success('Donation settings updated');
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to save';
      toast.error('Failed to save');
    } finally {
      saving = false;
    }
  }
</script>

<div class="max-w-3xl mx-auto">
  <h1 class="text-2xl font-heading font-bold mb-2">Donations</h1>
  <p class="text-text-muted text-sm mb-6">Configure how your masjid accepts and presents donations</p>

  {#if loading}
    <SkeletonForm fields={4} />
  {:else if loadError}
    <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
      <p class="text-red-400 text-sm mb-1">Failed to load donation settings</p>
      <p class="text-red-400/70 text-xs mb-4">{loadError}</p>
      <button
        class="btn-secondary text-sm"
        onclick={() => { loadError = null; loading = true; load(); }}
      >
        Retry
      </button>
    </div>
  {:else}
    <form onsubmit={handleSave}>
      <div class="bg-surface border border-border rounded-xl p-6 space-y-6">
        <!-- Donation Links -->
        <div class="form-group">
          <h2 class="font-heading font-semibold text-text mb-1">Donation Links</h2>
          <p class="text-xs text-text-muted mb-3">Where the "Support This Masjid" button sends visitors. Add multiple links with labels (e.g. PayPal, LaunchGood, Zelle).</p>
          {#if donationLinks.length === 0}
            <p class="text-sm text-text-muted mb-3">No donation links configured. The Donate page will show a "coming soon" message.</p>
          {/if}
          {#each donationLinks as link, i}
            <div class="form-row mb-2">
              <div class="form-group flex-1">
                <input type="text" class="w-full" placeholder="Label" value={link.label} oninput={(e) => updateLink(i, 'label', (e.target as HTMLInputElement).value)} />
              </div>
              <div class="form-group flex-[2]">
                <input type="url" class="w-full" placeholder="https://" value={link.url} oninput={(e) => updateLink(i, 'url', (e.target as HTMLInputElement).value)} />
              </div>
              <button type="button" class="btn-ghost text-red-400 text-sm px-2" onclick={() => removeLink(i)}>Remove</button>
            </div>
          {/each}
          <button type="button" class="btn-ghost text-sm" onclick={addLink}>+ Add Link</button>
        </div>

        <div class="pt-4 border-t border-border">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="w-4 h-4" bind:checked={showDonateQr} onchange={handleChange} />
            <span>Show Share QR card on donate page</span>
          </label>
        </div>

        <!-- Donate Appeal -->
        <div class="pt-4 border-t border-border">
          <h2 class="font-heading font-semibold text-text mb-3">Donate Appeal</h2>
          <p class="text-xs text-text-muted mb-2">Short appeal text shown on the TV donate frame (max 80 characters).</p>
          <div class="form-group">
            <input
              id="donateAppeal"
              type="text"
              class="w-full"
              maxlength="80"
              bind:value={donateAppeal}
              oninput={handleChange}
              placeholder="Every contribution makes a difference"
            />
            <p class="text-xs text-text-muted mt-1">{donateAppeal.length}/80</p>
          </div>
        </div>

        <!-- Donate Reasons -->
        <div class="pt-4 border-t border-border">
          <h2 class="font-heading font-semibold text-text mb-4">Why Give?</h2>
          <p class="text-xs text-text-muted mb-4">The cards shown in the "Why Give?" section on the Donate page (icon, title, description). Up to 8 cards.</p>
          <div class="space-y-3">
            {#each donateReasons as reason, i (i)}
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
                  onclick={() => removeReason(i)}
                  title="Remove card"
                >Remove</button>
              </div>
            {/each}
            {#if donateReasons.length < 8}
              <button
                type="button"
                class="btn-secondary text-xs w-full"
                onclick={addReason}
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

        <div class="pt-4 border-t border-border">
          <button type="submit" class="btn-primary" disabled={saving || !dirty}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  {/if}
</div>
