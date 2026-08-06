import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/svelte';

vi.mock('$lib/auth.svelte', () => ({
  auth: {
    admin: { id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'masjid-1' },
    token: 'test-token',
    loading: false,
    get isAuthenticated() { return true; },
    logout: vi.fn(),
  },
}));

let mockGetPosts: ReturnType<typeof vi.fn>;
let mockCreatePost: ReturnType<typeof vi.fn>;
let mockUpdatePost: ReturnType<typeof vi.fn>;
let mockDeletePost: ReturnType<typeof vi.fn>;
let mockPinPostHomepage: ReturnType<typeof vi.fn>;
let mockPinPostInfo: ReturnType<typeof vi.fn>;

function createMocks() {
  mockGetPosts = vi.fn().mockResolvedValue({ posts: [] });
  mockCreatePost = vi.fn().mockResolvedValue({ id: 'new-id', slug: 'new-post', title: 'New Post' });
  mockUpdatePost = vi.fn().mockResolvedValue({ success: true });
  mockDeletePost = vi.fn().mockResolvedValue({ success: true });
  mockPinPostHomepage = vi.fn().mockResolvedValue({ is_pinned: true });
  mockPinPostInfo = vi.fn().mockResolvedValue({ is_pinned: true });
}

createMocks();

vi.mock('$lib/api', () => ({
  api: {
    getPosts: (...args: unknown[]) => mockGetPosts(...args),
    createPost: (...args: unknown[]) => mockCreatePost(...args),
    updatePost: (...args: unknown[]) => mockUpdatePost(...args),
    deletePost: (...args: unknown[]) => mockDeletePost(...args),
    pinPostHomepage: (...args: unknown[]) => mockPinPostHomepage(...args),
    pinPostInfo: (...args: unknown[]) => mockPinPostInfo(...args),
    getAnnouncements: vi.fn().mockResolvedValue({ announcements: [] }),
    getProfile: vi.fn().mockResolvedValue({ name: 'Test' }),
  },
}));

import PostsPage from '../../routes/admin/[slug]/settings/posts/+page.svelte';

const slugData = { data: { masjidSlug: 'masjid-al-noor' } };

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    title: 'Test Post',
    slug: 'test-post',
    content_markdown: '# Hello',
    show_on_homepage: false,
    show_on_info: false,
    is_hidden: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Posts settings page', () => {
  beforeEach(() => {
    cleanup();
    createMocks();
  });

  // ── rendering ──────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the Posts heading', () => {
      render(PostsPage, { props: slugData });
      expect(screen.getByText('Posts')).toBeInTheDocument();
    });

    it('shows loading skeleton while fetching', () => {
      mockGetPosts.mockReturnValue(new Promise(() => {}));
      render(PostsPage, { props: slugData });
      const shimmerDivs = document.querySelectorAll('.animate-shimmer');
      expect(shimmerDivs.length).toBeGreaterThan(0);
    });

    it('shows all/visible/hidden filter tabs', async () => {
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Posts')).toBeInTheDocument(); });
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Visible')).toBeInTheDocument();
      expect(screen.getByText('Hidden')).toBeInTheDocument();
    });

    it('shows "New" button', async () => {
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Posts')).toBeInTheDocument(); });
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });

  // ── post list ───────────────────────────────────────────────────────────

  describe('post list', () => {
    it('displays post title, date, and slug', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ title: 'Welcome Post', slug: 'welcome' })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Welcome Post')).toBeInTheDocument(); });
      expect(screen.getByText(/welcome/)).toBeInTheDocument();
      expect(screen.getByText(/Created:/)).toBeInTheDocument();
    });

    it('shows "Hidden" badge for hidden posts', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ id: 'h1', title: 'Hidden Post', slug: 'hidden', is_hidden: true })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Hidden Post')).toBeInTheDocument(); });
      // There should be at least 2 "Hidden" elements: the filter tab and the badge
      const hiddenElements = screen.getAllByText('Hidden');
      expect(hiddenElements.length).toBeGreaterThanOrEqual(2);
    });

    it('shows "Homepage" badge for homepage-pinned posts', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ id: 'hp', title: 'Homepage Post', slug: 'hp', show_on_homepage: true })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Homepage Post')).toBeInTheDocument(); });
      expect(screen.getByText('Homepage')).toBeInTheDocument();
    });

    it('shows "Info" badge for info-pinned posts', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ id: 'ip', title: 'Info Post', slug: 'ip', show_on_info: true })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Info Post')).toBeInTheDocument(); });
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('shows multiple badges when a post is both hidden and pinned', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ id: 'm', title: 'Multi', slug: 'multi', is_hidden: true, show_on_homepage: true })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Multi')).toBeInTheDocument(); });
      // Badges are span.badge elements; exclude the filter tab buttons
      const badges = document.querySelectorAll('span.badge');
      const badgeTexts = Array.from(badges).map(b => b.textContent);
      expect(badgeTexts).toContain('Hidden');
      expect(badgeTexts).toContain('Homepage');
    });

    it('shows updated date when different from created', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ id: 'u', title: 'Updated Post', slug: 'updated', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-02-01T00:00:00.000Z' })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Updated Post')).toBeInTheDocument(); });
      expect(screen.getByText(/Updated:/)).toBeInTheDocument();
    });

    it('does not show updated date when unchanged', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ id: 'n', title: 'New Post', slug: 'new', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('New Post')).toBeInTheDocument(); });
      expect(screen.queryByText(/Updated:/)).toBeNull();
    });

    it('shows homepage pin button per row', async () => {
      mockGetPosts.mockResolvedValue({ posts: [makePost()] });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Test Post')).toBeInTheDocument(); });
      expect(screen.getByTitle('Toggle homepage pin')).toBeInTheDocument();
    });

    it('shows info pin button per row', async () => {
      mockGetPosts.mockResolvedValue({ posts: [makePost()] });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Test Post')).toBeInTheDocument(); });
      expect(screen.getByTitle('Toggle info pin')).toBeInTheDocument();
    });

    it('shows edit button per row', async () => {
      mockGetPosts.mockResolvedValue({ posts: [makePost()] });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Test Post')).toBeInTheDocument(); });
      // The edit button is the <button> with text "Edit" and class btn-secondary
      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      expect(editBtn).toBeInTheDocument();
      expect(editBtn.textContent).toBe('Edit');
    });

    it('shows delete button per row', async () => {
      mockGetPosts.mockResolvedValue({ posts: [makePost()] });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Test Post')).toBeInTheDocument(); });
      const deleteBtn = document.querySelector('button.text-red-400');
      expect(deleteBtn).not.toBeNull();
    });

    it('shows empty state when no posts', async () => {
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('No posts.')).toBeInTheDocument(); });
    });

    it('shows total count', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost(), makePost({ id: 'p2', slug: 'post-2', title: 'Post 2' })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Post 2')).toBeInTheDocument(); });
      expect(screen.getByText('2 total')).toBeInTheDocument();
    });
  });

  // ── filtering ───────────────────────────────────────────────────────────

  describe('filtering', () => {
    const threePosts = {
      posts: [
        makePost({ id: 'a', title: 'Alpha', slug: 'alpha', is_hidden: false }),
        makePost({ id: 'b', title: 'Bravo', slug: 'bravo', is_hidden: true }),
        makePost({ id: 'c', title: 'Charlie', slug: 'charlie', is_hidden: false, show_on_homepage: true }),
      ],
    };

    it('defaults to "All" filter showing all posts', async () => {
      mockGetPosts.mockResolvedValue(threePosts);
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Alpha')).toBeInTheDocument(); });
      expect(screen.getByText('Bravo')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('filters to visible posts when "Visible" tab clicked', async () => {
      mockGetPosts.mockResolvedValue(threePosts);
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Alpha')).toBeInTheDocument(); });

      const visibleBtn = screen.getByText('Visible');
      await fireEvent.click(visibleBtn);

      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.queryByText('Bravo')).toBeNull();
    });

    it('filters to hidden posts when "Hidden" tab clicked', async () => {
      mockGetPosts.mockResolvedValue(threePosts);
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Alpha')).toBeInTheDocument(); });

      // Click the Hidden filter tab button (first "Hidden" is the tab, not the badge)
      const hiddenElements = screen.getAllByText('Hidden');
      const hiddenTab = hiddenElements.find(el => el.tagName === 'BUTTON') || hiddenElements[0];
      await fireEvent.click(hiddenTab);

      expect(screen.getByText('Bravo')).toBeInTheDocument();
      expect(screen.queryByText('Alpha')).toBeNull();
      expect(screen.queryByText('Charlie')).toBeNull();
    });

    it('shows "No hidden posts." when hidden filter has no results', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ id: 'x', title: 'X-Ray', slug: 'xray', is_hidden: false })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('X-Ray')).toBeInTheDocument(); });

      const hiddenBtn = screen.getByText('Hidden');
      await fireEvent.click(hiddenBtn);

      expect(screen.getByText('No hidden posts.')).toBeInTheDocument();
    });
  });

  // ── create post ─────────────────────────────────────────────────────────

  describe('create post', () => {
    it('opens create form when "New" is clicked', async () => {
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Posts')).toBeInTheDocument(); });

      const newBtn = screen.getByText('New');
      await fireEvent.click(newBtn);

      expect(screen.getByText('New Post')).toBeInTheDocument();
    });

    it('closes create form when Cancel is clicked', async () => {
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Posts')).toBeInTheDocument(); });

      const newBtn = screen.getByText('New');
      await fireEvent.click(newBtn);

      expect(screen.getByText('New Post')).toBeInTheDocument();

      // The create form Cancel is inside the form, it's a <button type="button" class="btn-secondary">
      const cancelBtns = screen.getAllByText('Cancel');
      await fireEvent.click(cancelBtns[0]);

      expect(screen.queryByText('New Post')).toBeNull();
    });

    it('calls createPost with correct data on submit', async () => {
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Posts')).toBeInTheDocument(); });

      const newBtn = screen.getByText('New');
      await fireEvent.click(newBtn);

      const titleInput = document.querySelector('.form-group input[type="text"]') as HTMLInputElement;
      await fireEvent.input(titleInput, { target: { value: 'My Post' } });

      const contentTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(contentTextarea, { target: { value: '# Hello World' } });

      const createBtn = screen.getByText('Create');
      await fireEvent.click(createBtn);

      expect(mockCreatePost).toHaveBeenCalledWith('masjid-1', expect.objectContaining({
        title: 'My Post',
        content_markdown: '# Hello World',
        show_on_homepage: false,
        show_on_info: false,
        is_hidden: false,
      }));
    });

    it('can create a post with homepage checkbox checked', async () => {
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Posts')).toBeInTheDocument(); });

      const newBtn = screen.getByText('New');
      await fireEvent.click(newBtn);

      const titleInput = document.querySelector('.form-group input[type="text"]') as HTMLInputElement;
      await fireEvent.input(titleInput, { target: { value: 'HP Post' } });

      const contentTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(contentTextarea, { target: { value: '# Content' } });

      const homepageCheckbox = screen.getByLabelText('Show on Homepage') as HTMLInputElement;
      await fireEvent.click(homepageCheckbox);

      const createBtn = screen.getByText('Create');
      await fireEvent.click(createBtn);

      expect(mockCreatePost).toHaveBeenCalledWith('masjid-1', expect.objectContaining({
        show_on_homepage: true,
      }));
    });

    it('can create a hidden post', async () => {
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Posts')).toBeInTheDocument(); });

      const newBtn = screen.getByText('New');
      await fireEvent.click(newBtn);

      const titleInput = document.querySelector('.form-group input[type="text"]') as HTMLInputElement;
      await fireEvent.input(titleInput, { target: { value: 'Draft' } });

      const contentTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(contentTextarea, { target: { value: '# Draft content' } });

      const hiddenCheckbox = screen.getByLabelText('Hidden') as HTMLInputElement;
      await fireEvent.click(hiddenCheckbox);

      const createBtn = screen.getByText('Create');
      await fireEvent.click(createBtn);

      expect(mockCreatePost).toHaveBeenCalledWith('masjid-1', expect.objectContaining({
        is_hidden: true,
      }));
    });

    it('closes form after successful create', async () => {
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Posts')).toBeInTheDocument(); });

      const newBtn = screen.getByText('New');
      await fireEvent.click(newBtn);

      const titleInput = document.querySelector('.form-group input[type="text"]') as HTMLInputElement;
      await fireEvent.input(titleInput, { target: { value: 'Test' } });

      const contentTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(contentTextarea, { target: { value: '# Test content' } });

      await fireEvent.click(screen.getByText('Create'));

      await waitFor(() => { expect(screen.queryByText('New Post')).toBeNull(); });
    });

    it('shows toast on create error', async () => {
      const { toast } = await import('svelte-sonner');
      mockCreatePost.mockRejectedValue(new Error('Server error'));

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Posts')).toBeInTheDocument(); });

      const newBtn = screen.getByText('New');
      await fireEvent.click(newBtn);

      const titleInput = document.querySelector('.form-group input[type="text"]') as HTMLInputElement;
      await fireEvent.input(titleInput, { target: { value: 'Test' } });

      const contentTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(contentTextarea, { target: { value: '# Test' } });

      await fireEvent.click(screen.getByText('Create'));

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Server error'); });
    });
  });

  // ── edit post ───────────────────────────────────────────────────────────

  describe('edit post', () => {
    it('opens edit form with pre-populated data when edit is clicked', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({
          title: 'Editable Post',
          slug: 'editable',
          content_markdown: '# Original content',
          show_on_homepage: true,
          show_on_info: false,
          is_hidden: false,
        })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Editable Post')).toBeInTheDocument(); });

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      expect(screen.getByText('Edit Post')).toBeInTheDocument();

      const titleInput = document.querySelectorAll('input[type="text"]')[0] as HTMLInputElement;
      expect(titleInput.value).toBe('Editable Post');

      const textareas = document.querySelectorAll('textarea');
      const contentTextarea = textareas[0] as HTMLTextAreaElement;
      expect(contentTextarea.value).toBe('# Original content');
    });

    it('closes the add form when edit starts (mutual exclusion)', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'some-post', title: 'A Post' })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('A Post')).toBeInTheDocument(); });

      const newBtn = screen.getByText('New');
      await fireEvent.click(newBtn);

      expect(screen.getByText('New Post')).toBeInTheDocument();

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      expect(screen.queryByText('New Post')).toBeNull();
      expect(screen.getByText('Edit Post')).toBeInTheDocument();
    });

    it('calls updatePost with correct data on save', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'edit-me', title: 'Old Title', content_markdown: '# Old' })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Old Title')).toBeInTheDocument(); });

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      const titleInput = document.querySelectorAll('input[type="text"]')[0] as HTMLInputElement;
      await fireEvent.input(titleInput, { target: { value: 'New Title' } });

      await fireEvent.click(screen.getByText('Save'));

      expect(mockUpdatePost).toHaveBeenCalledWith('masjid-1', 'edit-me', expect.objectContaining({
        title: 'New Title',
      }));
    });

    it('closes form after successful update', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'update-me', title: 'To Update' })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('To Update')).toBeInTheDocument(); });

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      expect(screen.getByText('Edit Post')).toBeInTheDocument();

      await fireEvent.click(screen.getByText('Save'));

      await waitFor(() => { expect(screen.queryByText('Edit Post')).toBeNull(); });
    });

    it('closes form when Cancel is clicked', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'cancel-me', title: 'Cancel Edit' })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Cancel Edit')).toBeInTheDocument(); });

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      expect(screen.getByText('Edit Post')).toBeInTheDocument();

      // The edit form Cancel is the last one (after the create form and the dialog)
      const cancelBtns = screen.getAllByText('Cancel');
      const editCancelBtn = cancelBtns[cancelBtns.length - 1];
      await fireEvent.click(editCancelBtn);

      expect(screen.queryByText('Edit Post')).toBeNull();
    });

    it('shows toast on update error', async () => {
      const { toast } = await import('svelte-sonner');
      mockUpdatePost.mockRejectedValue(new Error('Update failed'));
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'fail', title: 'Fail' })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Fail')).toBeInTheDocument(); });

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      await fireEvent.click(screen.getByText('Save'));

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Update failed'); });
    });

    it('toggles edit form checkboxes', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'chk', title: 'Checkbox Post' })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Checkbox Post')).toBeInTheDocument(); });

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      // Only the edit form is visible, so the label appears once
      const infoCheckbox = screen.getByLabelText('Show on Info Page') as HTMLInputElement;
      await fireEvent.click(infoCheckbox);

      await fireEvent.click(screen.getByText('Save'));

      expect(mockUpdatePost).toHaveBeenCalledWith('masjid-1', 'chk', expect.objectContaining({
        show_on_info: true,
      }));
    });
  });

  // ── delete post ─────────────────────────────────────────────────────────

  describe('delete post', () => {
    it('shows confirmation dialog when delete is clicked', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'del-me', title: 'Delete Me' })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Delete Me')).toBeInTheDocument(); });

      const deleteBtn = document.querySelector('button.text-red-400') as HTMLButtonElement;
      await fireEvent.click(deleteBtn);

      expect(screen.getByText('Delete Post')).toBeInTheDocument();
      expect(screen.getByText('This will permanently delete the post. This action cannot be undone.')).toBeInTheDocument();
    });

    it('calls deletePost on confirmation', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'del-me', title: 'Delete Me' })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Delete Me')).toBeInTheDocument(); });

      const deleteBtn = document.querySelector('button.text-red-400') as HTMLButtonElement;
      await fireEvent.click(deleteBtn);

      const confirmBtn = screen.getByText('Confirm');
      await fireEvent.click(confirmBtn);

      expect(mockDeletePost).toHaveBeenCalledWith('masjid-1', 'del-me');
    });

    it('closes dialog on Cancel', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'del-me', title: 'Delete Me' })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Delete Me')).toBeInTheDocument(); });

      const deleteBtn = document.querySelector('button.text-red-400') as HTMLButtonElement;
      await fireEvent.click(deleteBtn);

      const dialogCancel = screen.getByRole('dialog').querySelector('button.btn-secondary') as HTMLButtonElement;
      await fireEvent.click(dialogCancel);

      await waitFor(() => {
        expect(screen.queryByText('Delete Post')).toBeNull();
      });
    });

    it('closes dialog on backdrop click', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'del-me', title: 'Delete Me' })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Delete Me')).toBeInTheDocument(); });

      const deleteBtn = document.querySelector('button.text-red-400') as HTMLButtonElement;
      await fireEvent.click(deleteBtn);

      const dialog = screen.getByRole('dialog');
      await fireEvent.click(dialog);

      await waitFor(() => {
        expect(screen.queryByText('Delete Post')).toBeNull();
      });
    });

    it('shows toast on delete error', async () => {
      const { toast } = await import('svelte-sonner');
      mockDeletePost.mockRejectedValue(new Error('Cannot delete'));
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'del-me', title: 'Delete Me' })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Delete Me')).toBeInTheDocument(); });

      const deleteBtn = document.querySelector('button.text-red-400') as HTMLButtonElement;
      await fireEvent.click(deleteBtn);

      const confirmBtn = screen.getByText('Confirm');
      await fireEvent.click(confirmBtn);

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Cannot delete'); });
    });

    it('does nothing if confirmDeleteSlug is null', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'safe', title: 'Safe' })],
      });
      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Safe')).toBeInTheDocument(); });

      expect(mockDeletePost).not.toHaveBeenCalled();
    });
  });

  // ── pin toggles ─────────────────────────────────────────────────────────

  describe('pin toggles', () => {
    it('calls pinPostHomepage when homepage pin is clicked on an unpinned post', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'pin-me', title: 'Pin Me', show_on_homepage: false })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Pin Me')).toBeInTheDocument(); });

      const homepageBtn = screen.getByTitle('Toggle homepage pin');
      await fireEvent.click(homepageBtn);

      expect(mockPinPostHomepage).toHaveBeenCalledWith('masjid-1', 'pin-me');
    });

    it('calls pinPostHomepage when homepage pin is clicked on a pinned post', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'unpin-me', title: 'Unpin Me', show_on_homepage: true })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Unpin Me')).toBeInTheDocument(); });

      const homepageBtn = screen.getByTitle('Toggle homepage pin');
      await fireEvent.click(homepageBtn);

      expect(mockPinPostHomepage).toHaveBeenCalledWith('masjid-1', 'unpin-me');
    });

    it('calls pinPostInfo when info pin is clicked on an unpinned post', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'info-pin', title: 'Info Pin', show_on_info: false })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Info Pin')).toBeInTheDocument(); });

      const infoBtn = screen.getByTitle('Toggle info pin');
      await fireEvent.click(infoBtn);

      expect(mockPinPostInfo).toHaveBeenCalledWith('masjid-1', 'info-pin');
    });

    it('calls pinPostInfo when info pin is clicked on a pinned post', async () => {
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'info-unpin', title: 'Info Unpin', show_on_info: true })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Info Unpin')).toBeInTheDocument(); });

      const infoBtn = screen.getByTitle('Toggle info pin');
      await fireEvent.click(infoBtn);

      expect(mockPinPostInfo).toHaveBeenCalledWith('masjid-1', 'info-unpin');
    });

    it('shows toast on pin error', async () => {
      const { toast } = await import('svelte-sonner');
      mockPinPostHomepage.mockRejectedValue(new Error('Pin failed'));
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'err', title: 'Error Post' })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Error Post')).toBeInTheDocument(); });

      const homepageBtn = screen.getByTitle('Toggle homepage pin');
      await fireEvent.click(homepageBtn);

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Pin failed'); });
    });

    it('shows pin-specific success toast for homepage', async () => {
      const { toast } = await import('svelte-sonner');
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'fresh', title: 'Fresh', show_on_homepage: false })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Fresh')).toBeInTheDocument(); });

      const homepageBtn = screen.getByTitle('Toggle homepage pin');
      await fireEvent.click(homepageBtn);

      await waitFor(() => { expect(toast.success).toHaveBeenCalledWith('Pinned to homepage'); });
    });

    it('shows pin-specific success toast for info', async () => {
      const { toast } = await import('svelte-sonner');
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'ifresh', title: 'IFresh', show_on_info: false })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('IFresh')).toBeInTheDocument(); });

      const infoBtn = screen.getByTitle('Toggle info pin');
      await fireEvent.click(infoBtn);

      await waitFor(() => { expect(toast.success).toHaveBeenCalledWith('Pinned to info page'); });
    });

    it('shows unpin-specific success toast for homepage', async () => {
      const { toast } = await import('svelte-sonner');
      mockGetPosts.mockResolvedValue({
        posts: [makePost({ slug: 'remove', title: 'Remove', show_on_homepage: true })],
      });

      render(PostsPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Remove')).toBeInTheDocument(); });

      const homepageBtn = screen.getByTitle('Toggle homepage pin');
      await fireEvent.click(homepageBtn);

      await waitFor(() => { expect(toast.success).toHaveBeenCalledWith('Unpinned from homepage'); });
    });
  });

  // ── initial load error ──────────────────────────────────────────────────

  describe('initial load error', () => {
    it('shows toast on initial load failure', async () => {
      const { toast } = await import('svelte-sonner');
      mockGetPosts.mockRejectedValue(new Error('Network error'));

      render(PostsPage, { props: slugData });

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Network error'); });
    });
  });
});