<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte';

  let email = $state('');
  let password = $state('');
  let error = $state<string | null>(null);
  let submitting = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    if (!email.trim() || !password.trim()) {
      error = 'Please enter your email and password.';
      return;
    }
    submitting = true;
    try {
      const admin = await auth.login(email.trim(), password);
      const profile = await fetch(`/api/v1/admin/masjids/${admin.masjid_id}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      }).then(r => r.json());
      goto(`/admin/${profile.slug}`);
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Login failed';
    } finally {
      submitting = false;
    }
  }

  $effect(() => {
    if (auth.isAuthenticated) {
      auth.checkAuth().then(valid => {
        if (valid && auth.admin) {
          fetch(`/api/v1/admin/masjids/${auth.admin.masjid_id}`, {
            headers: { Authorization: `Bearer ${auth.token}` },
          }).then(r => r.json()).then(profile => {
            goto(`/admin/${profile.slug}`);
          });
        }
      });
    }
  });
</script>

<div class="min-h-dvh flex items-center justify-center p-4">
  <div class="w-full max-w-md animate-fade-in-up">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-heading font-bold text-text">Masjid Admin</h1>
      <p class="text-text-muted text-sm mt-1">Sign in to manage your masjid</p>
    </div>

    <div class="bg-surface border border-border rounded-xl p-6">
      <form onsubmit={handleSubmit}>
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            class="w-full"
            placeholder="admin@masjid.org"
            bind:value={email}
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            class="w-full"
            placeholder="Enter your password"
            bind:value={password}
            autocomplete="current-password"
          />
        </div>

        {#if error}
          <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p class="text-red-400 text-sm">{error}</p>
          </div>
        {/if}

        <button type="submit" class="btn-primary w-full justify-center" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  </div>
</div>
