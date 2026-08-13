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

let mockGetContent: ReturnType<typeof vi.fn>;
let mockCreateContent: ReturnType<typeof vi.fn>;
let mockUpdateContent: ReturnType<typeof vi.fn>;
let mockDeleteContent: ReturnType<typeof vi.fn>;
let mockPinContentHomepage: ReturnType<typeof vi.fn>;
let mockPinContentInfo: ReturnType<typeof vi.fn>;

function createMocks() {
  mockGetContent = vi.fn().mockResolvedValue({ content: [] });
  mockCreateContent = vi.fn().mockResolvedValue({ id: 'new-id', slug: 'new-post', title: 'New Post' });
  mockUpdateContent = vi.fn().mockResolvedValue({ success: true });
  mockDeleteContent = vi.fn().mockResolvedValue({ success: true });
  mockPinContentHomepage = vi.fn().mockResolvedValue({ is_pinned: true });
  mockPinContentInfo = vi.fn().mockResolvedValue({ is_pinned: true });
}

createMocks();

vi.mock('$lib/api', () => ({
  api: {
    getContent: (...args: unknown[]) => mockGetContent(...args),
    createContent: (...args: unknown[]) => mockCreateContent(...args),
    updateContent: (...args: unknown[]) => mockUpdateContent(...args),
    deleteContent: (...args: unknown[]) => mockDeleteContent(...args),
    pinContentHomepage: (...args: unknown[]) => mockPinContentHomepage(...args),
    pinContentInfo: (...args: unknown[]) => mockPinContentInfo(...args),
    getAnnouncements: vi.fn().mockResolvedValue({ announcements: [] }),
    getProfile: vi.fn().mockResolvedValue({ name: 'Test' }),
  },
}));

import ContentPage from '../../routes/admin/[slug]/settings/content/+page.svelte';

const slugData = { data: { masjidSlug: 'masjid-al-noor' } };

function makeContent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    title: 'Test Post',
    slug: 'test-post',
    content_markdown: '# Hello',
    content_type: 'post',
    show_on_homepage: false,
    show_on_info: false,
    is_hidden: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Content settings page', () => {
  beforeEach(() => {
    cleanup();
    createMocks();
  });

  // ── rendering ──────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the Content heading', () => {
      render(ContentPage, { props: slugData });
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('shows loading skeleton while fetching', () => {
      mockGetContent.mockReturnValue(new Promise(() => {}));
      render(ContentPage, { props: slugData });
      const shimmerDivs = document.querySelectorAll('.animate-shimmer');
      expect(shimmerDivs.length).toBeGreaterThan(0);
    });

    it('shows All/Posts/Pages filter tabs', async () => {
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Content')).toBeInTheDocument(); });
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Posts')).toBeInTheDocument();
      expect(screen.getByText('Pages')).toBeInTheDocument();
    });

    it('shows Post and Page buttons', async () => {
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Content')).toBeInTheDocument(); });
      expect(screen.getByText('Post')).toBeInTheDocument();
      expect(screen.getByText('Page')).toBeInTheDocument();
    });
  });

  // ── content list ───────────────────────────────────────────────────────

  describe('content list', () => {
    it('displays title, date, and slug', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ title: 'Welcome Post', slug: 'welcome' })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Welcome Post')).toBeInTheDocument(); });
      expect(screen.getByText(/welcome/)).toBeInTheDocument();
      expect(screen.getByText(/Created:/)).toBeInTheDocument();
    });

    it('shows content_type badge per item', async () => {
      mockGetContent.mockResolvedValue({
        content: [
          makeContent({ id: 'p1', title: 'Post Item', slug: 'post-item', content_type: 'post' }),
          makeContent({ id: 'p2', title: 'Page Item', slug: 'page-item', content_type: 'page' }),
        ],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Post Item')).toBeInTheDocument(); });
      const badges = document.querySelectorAll('span.badge');
      const badgeTexts = Array.from(badges).map(b => b.textContent?.trim());
      expect(badgeTexts).toContain('post');
      expect(badgeTexts).toContain('page');
    });

    it('shows "Hidden" badge for hidden items', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ id: 'h1', title: 'Hidden Post', slug: 'hidden', is_hidden: true })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Hidden Post')).toBeInTheDocument(); });
      expect(screen.getByText('Hidden')).toBeInTheDocument();
    });

    it('shows "Homepage" badge for homepage-pinned posts', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ id: 'hp', title: 'Homepage Post', slug: 'hp', show_on_homepage: true })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Homepage Post')).toBeInTheDocument(); });
      expect(screen.getByText('Homepage')).toBeInTheDocument();
    });

    it('shows "Info" badge for info-pinned posts', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ id: 'ip', title: 'Info Post', slug: 'ip', show_on_info: true })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Info Post')).toBeInTheDocument(); });
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('shows multiple badges when a post is both hidden and pinned', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ id: 'm', title: 'Multi', slug: 'multi', is_hidden: true, show_on_homepage: true })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Multi')).toBeInTheDocument(); });
      const badges = document.querySelectorAll('span.badge');
      const badgeTexts = Array.from(badges).map(b => b.textContent?.trim());
      expect(badgeTexts).toContain('Hidden');
      expect(badgeTexts).toContain('Homepage');
    });

    it('shows updated date when different from created', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ id: 'u', title: 'Updated Post', slug: 'updated', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-02-01T00:00:00.000Z' })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Updated Post')).toBeInTheDocument(); });
      expect(screen.getByText(/Updated:/)).toBeInTheDocument();
    });

    it('does not show updated date when unchanged', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ id: 'n', title: 'New Post', slug: 'new', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('New Post')).toBeInTheDocument(); });
      expect(screen.queryByText(/Updated:/)).toBeNull();
    });

    it('shows homepage pin button per post row', async () => {
      mockGetContent.mockResolvedValue({ content: [makeContent()] });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Test Post')).toBeInTheDocument(); });
      expect(screen.getByTitle('Toggle homepage pin')).toBeInTheDocument();
    });

    it('shows info pin button per post row', async () => {
      mockGetContent.mockResolvedValue({ content: [makeContent()] });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Test Post')).toBeInTheDocument(); });
      expect(screen.getByTitle('Toggle info pin')).toBeInTheDocument();
    });

    it('shows edit button per row', async () => {
      mockGetContent.mockResolvedValue({ content: [makeContent()] });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Test Post')).toBeInTheDocument(); });
      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      expect(editBtn).toBeInTheDocument();
      expect(editBtn.textContent).toBe('Edit');
    });

    it('shows delete button per row', async () => {
      mockGetContent.mockResolvedValue({ content: [makeContent()] });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Test Post')).toBeInTheDocument(); });
      const deleteBtn = document.querySelector('button.text-red-400');
      expect(deleteBtn).not.toBeNull();
    });

    it('shows empty state when no content', async () => {
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('No content.')).toBeInTheDocument(); });
    });

    it('shows total count', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent(), makeContent({ id: 'p2', slug: 'post-2', title: 'Post 2' })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Post 2')).toBeInTheDocument(); });
      expect(screen.getByText('2 total')).toBeInTheDocument();
    });
  });

  // ── filtering ───────────────────────────────────────────────────────────

  describe('filtering', () => {
    const threeContent = {
      content: [
        makeContent({ id: 'a', title: 'Alpha', slug: 'alpha', content_type: 'post' }),
        makeContent({ id: 'b', title: 'Bravo', slug: 'bravo', content_type: 'page' }),
        makeContent({ id: 'c', title: 'Charlie', slug: 'charlie', content_type: 'post', show_on_homepage: true }),
      ],
    };

    it('defaults to "All" filter showing all content', async () => {
      mockGetContent.mockResolvedValue(threeContent);
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Alpha')).toBeInTheDocument(); });
      expect(screen.getByText('Bravo')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('filters to posts when "Posts" tab clicked', async () => {
      mockGetContent.mockResolvedValue(threeContent);
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Alpha')).toBeInTheDocument(); });

      const postsBtn = screen.getByText('Posts');
      await fireEvent.click(postsBtn);

      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.queryByText('Bravo')).toBeNull();
    });

    it('filters to pages when "Pages" tab clicked', async () => {
      mockGetContent.mockResolvedValue(threeContent);
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Alpha')).toBeInTheDocument(); });

      const pagesBtn = screen.getByText('Pages');
      await fireEvent.click(pagesBtn);

      expect(screen.getByText('Bravo')).toBeInTheDocument();
      expect(screen.queryByText('Alpha')).toBeNull();
      expect(screen.queryByText('Charlie')).toBeNull();
    });

    it('shows empty state when filter has no results', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ id: 'x', title: 'X-Ray', slug: 'xray', content_type: 'post' })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('X-Ray')).toBeInTheDocument(); });

      const pagesBtn = screen.getByText('Pages');
      await fireEvent.click(pagesBtn);

      expect(screen.getByText('No content.')).toBeInTheDocument();
    });
  });

  // ── create content ─────────────────────────────────────────────────────

  describe('create content', () => {
    it('opens create form when "Post" is clicked', async () => {
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Content')).toBeInTheDocument(); });

      const postBtn = screen.getByText('Post');
      await fireEvent.click(postBtn);

      expect(screen.getByText('New Post')).toBeInTheDocument();
    });

    it('closes create form when Cancel is clicked', async () => {
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Content')).toBeInTheDocument(); });

      const postBtn = screen.getByText('Post');
      await fireEvent.click(postBtn);

      expect(screen.getByText('New Post')).toBeInTheDocument();

      const cancelBtns = screen.getAllByText('Cancel');
      await fireEvent.click(cancelBtns[0]);

      expect(screen.queryByText('New Post')).toBeNull();
    });

    it('calls createContent with correct data on submit', async () => {
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Content')).toBeInTheDocument(); });

      const postBtn = screen.getByText('Post');
      await fireEvent.click(postBtn);

      const titleInput = document.querySelector('.form-group input[type="text"]') as HTMLInputElement;
      await fireEvent.input(titleInput, { target: { value: 'My Post' } });

      const contentTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(contentTextarea, { target: { value: '# Hello World' } });

      const createBtn = screen.getByText('Create');
      await fireEvent.click(createBtn);

      expect(mockCreateContent).toHaveBeenCalledWith('masjid-1', expect.objectContaining({
        title: 'My Post',
        content_markdown: '# Hello World',
        content_type: 'post',
        show_on_homepage: false,
        show_on_info: false,
        is_hidden: false,
      }));
    });

    it('can create a post with homepage checkbox checked', async () => {
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Content')).toBeInTheDocument(); });

      const postBtn = screen.getByText('Post');
      await fireEvent.click(postBtn);

      const titleInput = document.querySelector('.form-group input[type="text"]') as HTMLInputElement;
      await fireEvent.input(titleInput, { target: { value: 'HP Post' } });

      const contentTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(contentTextarea, { target: { value: '# Content' } });

      const homepageCheckbox = screen.getByLabelText('Show on Homepage') as HTMLInputElement;
      await fireEvent.click(homepageCheckbox);

      const createBtn = screen.getByText('Create');
      await fireEvent.click(createBtn);

      expect(mockCreateContent).toHaveBeenCalledWith('masjid-1', expect.objectContaining({
        show_on_homepage: true,
      }));
    });

    it('can create a hidden post', async () => {
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Content')).toBeInTheDocument(); });

      const postBtn = screen.getByText('Post');
      await fireEvent.click(postBtn);

      const titleInput = document.querySelector('.form-group input[type="text"]') as HTMLInputElement;
      await fireEvent.input(titleInput, { target: { value: 'Draft' } });

      const contentTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(contentTextarea, { target: { value: '# Draft content' } });

      const hiddenCheckbox = screen.getByLabelText('Hidden') as HTMLInputElement;
      await fireEvent.click(hiddenCheckbox);

      const createBtn = screen.getByText('Create');
      await fireEvent.click(createBtn);

      expect(mockCreateContent).toHaveBeenCalledWith('masjid-1', expect.objectContaining({
        is_hidden: true,
      }));
    });

    it('closes form after successful create', async () => {
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Content')).toBeInTheDocument(); });

      const postBtn = screen.getByText('Post');
      await fireEvent.click(postBtn);

      const titleInput = document.querySelector('.form-group input[type="text"]') as HTMLInputElement;
      await fireEvent.input(titleInput, { target: { value: 'Test' } });

      const contentTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(contentTextarea, { target: { value: '# Test content' } });

      await fireEvent.click(screen.getByText('Create'));

      await waitFor(() => { expect(screen.queryByText('New Post')).toBeNull(); });
    });

    it('shows toast on create error', async () => {
      const { toast } = await import('svelte-sonner');
      mockCreateContent.mockRejectedValue(new Error('Server error'));

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Content')).toBeInTheDocument(); });

      const postBtn = screen.getByText('Post');
      await fireEvent.click(postBtn);

      const titleInput = document.querySelector('.form-group input[type="text"]') as HTMLInputElement;
      await fireEvent.input(titleInput, { target: { value: 'Test' } });

      const contentTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(contentTextarea, { target: { value: '# Test' } });

      await fireEvent.click(screen.getByText('Create'));

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Server error'); });
    });
  });

  // ── edit content ───────────────────────────────────────────────────────

  describe('edit content', () => {
    it('opens edit form with pre-populated data when edit is clicked', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({
          title: 'Editable Post',
          slug: 'editable',
          content_markdown: '# Original content',
          show_on_homepage: true,
          show_on_info: false,
          is_hidden: false,
        })],
      });
      render(ContentPage, { props: slugData });
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
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'some-post', title: 'A Post' })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('A Post')).toBeInTheDocument(); });

      const postBtn = screen.getByText('Post');
      await fireEvent.click(postBtn);

      expect(screen.getByText('New Post')).toBeInTheDocument();

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      expect(screen.queryByText('New Post')).toBeNull();
      expect(screen.getByText('Edit Post')).toBeInTheDocument();
    });

    it('calls updateContent with correct data on save', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'edit-me', title: 'Old Title', content_markdown: '# Old' })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Old Title')).toBeInTheDocument(); });

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      const titleInput = document.querySelectorAll('input[type="text"]')[0] as HTMLInputElement;
      await fireEvent.input(titleInput, { target: { value: 'New Title' } });

      await fireEvent.click(screen.getByText('Save'));

      expect(mockUpdateContent).toHaveBeenCalledWith('masjid-1', 'edit-me', expect.objectContaining({
        title: 'New Title',
      }));
    });

    it('closes form after successful update', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'update-me', title: 'To Update' })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('To Update')).toBeInTheDocument(); });

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      expect(screen.getByText('Edit Post')).toBeInTheDocument();

      await fireEvent.click(screen.getByText('Save'));

      await waitFor(() => { expect(screen.queryByText('Edit Post')).toBeNull(); });
    });

    it('closes form when Cancel is clicked', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'cancel-me', title: 'Cancel Edit' })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Cancel Edit')).toBeInTheDocument(); });

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      expect(screen.getByText('Edit Post')).toBeInTheDocument();

      const cancelBtns = screen.getAllByText('Cancel');
      const editCancelBtn = cancelBtns[cancelBtns.length - 1];
      await fireEvent.click(editCancelBtn);

      expect(screen.queryByText('Edit Post')).toBeNull();
    });

    it('shows toast on update error', async () => {
      const { toast } = await import('svelte-sonner');
      mockUpdateContent.mockRejectedValue(new Error('Update failed'));
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'fail', title: 'Fail' })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Fail')).toBeInTheDocument(); });

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      await fireEvent.click(screen.getByText('Save'));

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Update failed'); });
    });

    it('toggles edit form checkboxes', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'chk', title: 'Checkbox Post' })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Checkbox Post')).toBeInTheDocument(); });

      const editBtn = document.querySelector('button.btn-secondary.text-xs') as HTMLButtonElement;
      await fireEvent.click(editBtn);

      const infoCheckbox = screen.getByLabelText('Show on Info Page') as HTMLInputElement;
      await fireEvent.click(infoCheckbox);

      await fireEvent.click(screen.getByText('Save'));

      expect(mockUpdateContent).toHaveBeenCalledWith('masjid-1', 'chk', expect.objectContaining({
        show_on_info: true,
      }));
    });
  });

  // ── delete content ─────────────────────────────────────────────────────

  describe('delete content', () => {
    it('shows confirmation dialog when delete is clicked', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'del-me', title: 'Delete Me' })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Delete Me')).toBeInTheDocument(); });

      const deleteBtn = document.querySelector('button.text-red-400') as HTMLButtonElement;
      await fireEvent.click(deleteBtn);

      expect(screen.getByText('Delete Content')).toBeInTheDocument();
      expect(screen.getByText('This will permanently delete this item. This action cannot be undone.')).toBeInTheDocument();
    });

    it('calls deleteContent on confirmation', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'del-me', title: 'Delete Me' })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Delete Me')).toBeInTheDocument(); });

      const deleteBtn = document.querySelector('button.text-red-400') as HTMLButtonElement;
      await fireEvent.click(deleteBtn);

      const confirmBtn = screen.getByText('Confirm');
      await fireEvent.click(confirmBtn);

      expect(mockDeleteContent).toHaveBeenCalledWith('masjid-1', 'del-me');
    });

    it('closes dialog on Cancel', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'del-me', title: 'Delete Me' })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Delete Me')).toBeInTheDocument(); });

      const deleteBtn = document.querySelector('button.text-red-400') as HTMLButtonElement;
      await fireEvent.click(deleteBtn);

      const dialogCancel = screen.getByRole('dialog').querySelector('button.btn-secondary') as HTMLButtonElement;
      await fireEvent.click(dialogCancel);

      await waitFor(() => {
        expect(screen.queryByText('Delete Content')).toBeNull();
      });
    });

    it('closes dialog on backdrop click', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'del-me', title: 'Delete Me' })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Delete Me')).toBeInTheDocument(); });

      const deleteBtn = document.querySelector('button.text-red-400') as HTMLButtonElement;
      await fireEvent.click(deleteBtn);

      const dialog = screen.getByRole('dialog');
      await fireEvent.click(dialog);

      await waitFor(() => {
        expect(screen.queryByText('Delete Content')).toBeNull();
      });
    });

    it('shows toast on delete error', async () => {
      const { toast } = await import('svelte-sonner');
      mockDeleteContent.mockRejectedValue(new Error('Cannot delete'));
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'del-me', title: 'Delete Me' })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Delete Me')).toBeInTheDocument(); });

      const deleteBtn = document.querySelector('button.text-red-400') as HTMLButtonElement;
      await fireEvent.click(deleteBtn);

      const confirmBtn = screen.getByText('Confirm');
      await fireEvent.click(confirmBtn);

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Cannot delete'); });
    });

    it('does nothing if confirmDeleteSlug is null', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'safe', title: 'Safe' })],
      });
      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Safe')).toBeInTheDocument(); });

      expect(mockDeleteContent).not.toHaveBeenCalled();
    });
  });

  // ── pin toggles ─────────────────────────────────────────────────────────

  describe('pin toggles', () => {
    it('calls pinContentHomepage when homepage pin is clicked on an unpinned post', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'pin-me', title: 'Pin Me', show_on_homepage: false })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Pin Me')).toBeInTheDocument(); });

      const homepageBtn = screen.getByTitle('Toggle homepage pin');
      await fireEvent.click(homepageBtn);

      expect(mockPinContentHomepage).toHaveBeenCalledWith('masjid-1', 'pin-me');
    });

    it('calls pinContentHomepage when homepage pin is clicked on a pinned post', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'unpin-me', title: 'Unpin Me', show_on_homepage: true })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Unpin Me')).toBeInTheDocument(); });

      const homepageBtn = screen.getByTitle('Toggle homepage pin');
      await fireEvent.click(homepageBtn);

      expect(mockPinContentHomepage).toHaveBeenCalledWith('masjid-1', 'unpin-me');
    });

    it('calls pinContentInfo when info pin is clicked on an unpinned post', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'info-pin', title: 'Info Pin', show_on_info: false })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Info Pin')).toBeInTheDocument(); });

      const infoBtn = screen.getByTitle('Toggle info pin');
      await fireEvent.click(infoBtn);

      expect(mockPinContentInfo).toHaveBeenCalledWith('masjid-1', 'info-pin');
    });

    it('calls pinContentInfo when info pin is clicked on a pinned post', async () => {
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'info-unpin', title: 'Info Unpin', show_on_info: true })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Info Unpin')).toBeInTheDocument(); });

      const infoBtn = screen.getByTitle('Toggle info pin');
      await fireEvent.click(infoBtn);

      expect(mockPinContentInfo).toHaveBeenCalledWith('masjid-1', 'info-unpin');
    });

    it('shows toast on pin error', async () => {
      const { toast } = await import('svelte-sonner');
      mockPinContentHomepage.mockRejectedValue(new Error('Pin failed'));
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'err', title: 'Error Post' })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Error Post')).toBeInTheDocument(); });

      const homepageBtn = screen.getByTitle('Toggle homepage pin');
      await fireEvent.click(homepageBtn);

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Pin failed'); });
    });

    it('shows pin-specific success toast for homepage', async () => {
      const { toast } = await import('svelte-sonner');
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'fresh', title: 'Fresh', show_on_homepage: false })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('Fresh')).toBeInTheDocument(); });

      const homepageBtn = screen.getByTitle('Toggle homepage pin');
      await fireEvent.click(homepageBtn);

      await waitFor(() => { expect(toast.success).toHaveBeenCalledWith('Pinned to homepage'); });
    });

    it('shows pin-specific success toast for info', async () => {
      const { toast } = await import('svelte-sonner');
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'ifresh', title: 'IFresh', show_on_info: false })],
      });

      render(ContentPage, { props: slugData });
      await waitFor(() => { expect(screen.getByText('IFresh')).toBeInTheDocument(); });

      const infoBtn = screen.getByTitle('Toggle info pin');
      await fireEvent.click(infoBtn);

      await waitFor(() => { expect(toast.success).toHaveBeenCalledWith('Pinned to info page'); });
    });

    it('shows unpin-specific success toast for homepage', async () => {
      const { toast } = await import('svelte-sonner');
      mockGetContent.mockResolvedValue({
        content: [makeContent({ slug: 'remove', title: 'Remove', show_on_homepage: true })],
      });

      render(ContentPage, { props: slugData });
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
      mockGetContent.mockRejectedValue(new Error('Network error'));

      render(ContentPage, { props: slugData });

      await waitFor(() => { expect(toast.error).toHaveBeenCalledWith('Network error'); });
    });
  });
});