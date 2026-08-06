<script lang="ts">
  import { page } from '$app/stores';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);

  let address = $derived.by(() => {
    const parts = [
      masjid?.address_line1,
      masjid?.address_line2,
      [masjid?.city, masjid?.state, masjid?.postal_code].filter(Boolean).join(', '),
      masjid?.country,
    ].filter(Boolean);
    return parts;
  });

  let socialLinks = $derived([
    { label: 'Website', url: masjid?.website_url, icon: 'globe' },
    { label: 'Facebook', url: masjid?.facebook_url, icon: 'facebook' },
    { label: 'YouTube', url: masjid?.youtube_url, icon: 'youtube' },
    { label: 'Instagram', url: masjid?.instagram_url, icon: 'instagram' },
  ].filter((l) => l.url));

  function contactHref(type: string, value: string): string {
    if (type === 'email') return `mailto:${value}`;
    if (type === 'phone') return `tel:${value.replace(/\s+/g, '')}`;
    return value;
  }
</script>

<svelte:head>
  <title>Info — {masjid?.name ?? 'Masjid'}</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-6">
  <section class="text-center py-6">
    <h1 class="text-2xl sm:text-3xl font-bold font-heading">
      {masjid?.name ?? 'Masjid'}
    </h1>
    <p class="mt-1 text-sm" style="color: var(--color-text-dim);">Contact & Location</p>
  </section>

  {#if address.length > 0}
    <section class="glass-card p-5">
      <div class="flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-accent);"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        <div>
          <h2 class="text-sm font-semibold uppercase tracking-wider mb-1" style="color: var(--color-text-muted);">Address</h2>
          {#each address as line}
            <p class="text-base" style="color: var(--color-text);">{line}</p>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  {#if masjid?.contact_phone}
    <section class="glass-card p-5">
      <a href={contactHref('phone', masjid.contact_phone)} class="flex items-center gap-3 no-underline" style="color: var(--color-text);">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-accent);"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
        <div>
          <h2 class="text-sm font-semibold uppercase tracking-wider mb-0.5" style="color: var(--color-text-muted);">Phone</h2>
          <p class="text-base">{masjid.contact_phone}</p>
        </div>
      </a>
    </section>
  {/if}

  {#if masjid?.contact_email}
    <section class="glass-card p-5">
      <a href={contactHref('email', masjid.contact_email)} class="flex items-center gap-3 no-underline" style="color: var(--color-text);">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-accent);"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        <div>
          <h2 class="text-sm font-semibold uppercase tracking-wider mb-0.5" style="color: var(--color-text-muted);">Email</h2>
          <p class="text-base">{masjid.contact_email}</p>
        </div>
      </a>
    </section>
  {/if}

  {#if socialLinks.length > 0}
    <section class="glass-card p-5">
      <h2 class="text-sm font-semibold uppercase tracking-wider mb-3" style="color: var(--color-text-muted);">Links</h2>
      <div class="flex flex-wrap gap-3">
        {#each socialLinks as link}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium no-underline transition-colors"
            style="background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);"
          >
            {#if link.icon === 'globe'}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
            {:else if link.icon === 'facebook'}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"></path></svg>
            {:else if link.icon === 'youtube'}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"></path></svg>
            {:else if link.icon === 'instagram'}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
            {/if}
            {link.label}
          </a>
        {/each}
      </div>
    </section>
  {/if}

  {#if data.info_post}
    <section class="glass-card p-5">
      <h2 class="text-sm font-semibold uppercase tracking-wider mb-3" style="color: var(--color-text-muted);">{data.info_post.title}</h2>
      <div class="text-base leading-relaxed" style="color: var(--color-text);">
        {@html data.info_post.compiled_html}
      </div>
    </section>
  {/if}
</div>
