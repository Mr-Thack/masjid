<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { Loader, Lock, Eye, EyeOff } from 'lucide-svelte';

  let { data }: { data: { masjidSlug: string } } = $props();

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let saving = $state(false);
  let error = $state<string | null>(null);
  let showCurrent = $state(false);
  let showNew = $state(false);
  let showConfirm = $state(false);

  let strength = $derived.by(() => {
    const p = newPassword;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[a-z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 2) return { label: 'Weak', color: 'text-red-400', width: '25%' };
    if (score <= 3) return { label: 'Fair', color: 'text-yellow-400', width: '50%' };
    if (score <= 4) return { label: 'Good', color: 'text-yellow-400', width: '75%' };
    return { label: 'Strong', color: 'text-green-400', width: '100%' };
  });

  const isValid = $derived(
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    currentPassword.length > 0
  );

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    if (!isValid) {
      error = 'Please ensure passwords match and are at least 8 characters.';
      return;
    }
    saving = true;
    try {
      await api.changePassword(auth.admin!.masjid_id, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      toast.success('Password changed');
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to change password';
      toast.error('Failed');
    } finally {
      saving = false;
    }
  }
</script>

<div class="max-w-lg mx-auto">
  <h1 class="text-2xl font-heading font-bold mb-2">Account</h1>
  <p class="text-text-muted text-sm mb-6">Change your admin password</p>

  <div class="bg-surface border border-border rounded-xl p-6">
    <div class="flex items-center gap-2 mb-6">
      <Lock size={16} class="text-text-muted" />
      <p class="text-sm text-text-muted">
        Logged in as <span class="text-text font-medium">{auth.admin?.email || '—'}</span>
      </p>
    </div>

    <form onsubmit={handleSubmit} class="space-y-4">
      <div class="form-group">
        <label for="current">Current Password</label>
        <div class="relative">
          <input
            id="current"
            type={showCurrent ? 'text' : 'password'}
            class="w-full pr-10"
            bind:value={currentPassword}
            required
          />
          <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0 border-0 bg-transparent" onclick={() => showCurrent = !showCurrent}>
            {#if showCurrent}
              <EyeOff size={16} />
            {:else}
              <Eye size={16} />
            {/if}
          </button>
        </div>
      </div>

      <div class="form-group">
        <label for="newPassword">New Password</label>
        <div class="relative">
          <input
            id="newPassword"
            type={showNew ? 'text' : 'password'}
            class="w-full pr-10"
            bind:value={newPassword}
            required
            minlength={8}
          />
          <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0 border-0 bg-transparent" onclick={() => showNew = !showNew}>
            {#if showNew}
              <EyeOff size={16} />
            {:else}
              <Eye size={16} />
            {/if}
          </button>
        </div>
        {#if newPassword}
          <div class="mt-2">
            <div class="h-1.5 bg-bg rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300 {strength.color}" style="width: {strength.width}; background-color: currentColor;"></div>
            </div>
            <p class="form-hint mt-1">{strength.label}</p>
          </div>
        {/if}
      </div>

      <div class="form-group">
        <label for="confirmPassword">Confirm New Password</label>
        <div class="relative">
          <input
            id="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            class="w-full pr-10"
            bind:value={confirmPassword}
            required
          />
          <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0 border-0 bg-transparent" onclick={() => showConfirm = !showConfirm}>
            {#if showConfirm}
              <EyeOff size={16} />
            {:else}
              <Eye size={16} />
            {/if}
          </button>
        </div>
        {#if confirmPassword && newPassword !== confirmPassword}
          <p class="form-error">Passwords do not match</p>
        {/if}
      </div>

      {#if error}
        <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p class="text-red-400 text-sm">{error}</p>
        </div>
      {/if}

      <button type="submit" class="btn-primary w-full justify-center" disabled={saving || !isValid}>
        {saving ? 'Changing...' : 'Change Password'}
      </button>
    </form>
  </div>
</div>
