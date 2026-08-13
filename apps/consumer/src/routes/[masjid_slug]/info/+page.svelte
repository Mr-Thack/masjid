<script lang="ts">
  import { page } from '$app/stores';
  import { parseStyleOptions, resolveStyleOptions } from '@masjid/ui-utils';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);
  let opts = $derived(resolveStyleOptions(parseStyleOptions(data.theme?.style_options as string | Record<string, unknown> | null | undefined)));

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
  <title>About — {masjid?.name ?? 'Masjid'}</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-6">
  <section class="text-center py-6">
    <h1 class="text-2xl sm:text-3xl font-bold font-heading">
      About {masjid?.name ?? 'Masjid'}
    </h1>
  </section>

  {#if masjid?.about_html}
    <section class="glass-card p-6">
      <div class="prose-base leading-relaxed" style="color: var(--color-text);">
        {@html masjid.about_html}
      </div>
    </section>
  {/if}

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

  {#if socialLinks.length > 0 || opts.whatsappGroupUrl}
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
        {#if opts.whatsappGroupUrl}
          <a
            href={opts.whatsappGroupUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium no-underline transition-colors"
            style="background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border);"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
            Join Our WhatsApp Group
          </a>
        {/if}
      </div>
    </section>
  {/if}

  {#if !masjid?.about_html && data.info_post}
    <section class="glass-card p-5">
      <h2 class="text-sm font-semibold uppercase tracking-wider mb-3" style="color: var(--color-text-muted);">{data.info_post.title}</h2>
      <div class="prose-base leading-relaxed" style="color: var(--color-text);">
        {@html data.info_post.compiled_html}
      </div>
    </section>
  {/if}
</div>