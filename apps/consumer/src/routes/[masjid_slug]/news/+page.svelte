<script lang="ts">
  import { page } from '$app/stores';
  import { fetchPosts, fetchAnnouncements, type Post } from '$lib/api';
  import type { Announcement } from '@masjid/schemas';
  import AnnouncementCard from '$lib/components/AnnouncementCard.svelte';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import ErrorState from '$lib/components/ErrorState.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  let data = $derived($page.data);
  let masjid = $derived(data.masjid);

  let activeTab = $state<'posts' | 'announcements'>('posts');

  let posts = $state<Post[]>([]);
  let postsLoading = $state(false);
  let postsError = $state('');

  let announcements = $state<Announcement[]>([]);
  let announcementsLoading = $state(false);
  let announcementsError = $state('');

  async function loadPosts() {
    if (!masjid?.slug) return;
    postsLoading = true;
    postsError = '';
    try {
      const result = await fetchPosts(masjid.slug);
      posts = result.posts;
    } catch {
      postsError = 'Failed to load posts.';
    } finally {
      postsLoading = false;
    }
  }

  async function loadAnnouncements() {
    if (!masjid?.slug) return;
    announcementsLoading = true;
    announcementsError = '';
    try {
      const result = await fetchAnnouncements(masjid.slug);
      announcements = result.announcements;
    } catch {
      announcementsError = 'Failed to load announcements.';
    } finally {
      announcementsLoading = false;
    }
  }

  $effect(() => {
    if (!masjid?.slug) return;
    loadPosts();
    loadAnnouncements();
  });

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
</script>

<svelte:head>
  <title>News — {masjid?.name ?? 'Masjid'}</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-bold mb-1 font-heading text-accent">News</h1>
    <p style="color: var(--color-text-muted);">Announcements and updates from the community</p>
  </div>

  <div class="flex gap-1 border-b pb-0" style="border-color: var(--color-border);">
    <button
      class="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-[1px] {activeTab === 'posts' ? 'bg-white/5' : ''}"
      style="color: {activeTab === 'posts' ? 'var(--color-accent)' : 'var(--color-text-muted)'}; border-color: {activeTab === 'posts' ? 'var(--color-accent)' : 'transparent'};"
      onclick={() => (activeTab = 'posts')}
    >
      Posts
    </button>
    <button
      class="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-[1px] {activeTab === 'announcements' ? 'bg-white/5' : ''}"
      style="color: {activeTab === 'announcements' ? 'var(--color-accent)' : 'var(--color-text-muted)'}; border-color: {activeTab === 'announcements' ? 'var(--color-accent)' : 'transparent'};"
      onclick={() => (activeTab = 'announcements')}
    >
      Announcements
    </button>
  </div>

  {#if activeTab === 'posts'}
    {#if postsLoading}
      <LoadingSpinner />
    {:else if postsError}
      <ErrorState message={postsError} />
    {:else if posts.length === 0}
      <EmptyState
        icon="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
        title="No Posts Yet"
        message="Check back later for articles and updates."
      />
    {:else}
      <div class="space-y-4">
        {#each posts as post}
          <a
            href="/{masjid?.slug ?? ''}/posts/{post.slug}"
            class="glass-card p-5 block no-underline transition-colors hover:bg-white/[0.03]"
          >
            <h3 class="text-base font-semibold mb-1 font-heading" style="color: var(--color-text);">
              {post.title}
            </h3>
            <p class="text-xs mb-3" style="color: var(--color-text-dim);">
              {formatDate(post.created_at)}
            </p>
            {#if post.compiled_html}
              <div class="text-sm leading-relaxed line-clamp-3 overflow-hidden" style="color: var(--color-text-muted);">
                {@html post.compiled_html}
              </div>
            {/if}
            <span class="inline-block mt-3 text-sm font-medium" style="color: var(--color-accent);">
              Read more →
            </span>
          </a>
        {/each}
      </div>
    {/if}
  {:else}
    {#if announcementsLoading}
      <LoadingSpinner />
    {:else if announcementsError}
      <ErrorState message={announcementsError} />
    {:else if announcements.length === 0}
      <EmptyState
        icon="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
        title="No Announcements Yet"
        message="Check back for updates and community news."
      />
    {:else}
      <div class="space-y-3">
        {#each announcements as announcement}
          <AnnouncementCard {announcement} />
        {/each}
      </div>
    {/if}
  {/if}
</div>