import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/svelte';

vi.mock('$lib/auth.svelte', () => ({
  auth: {
    admin: { id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' },
    token: 'test-token',
    loading: false,
    get isAuthenticated() { return true; },
    logout: vi.fn(),
  },
}));

const mockAgentChat = vi.fn();
const mockAgentConfirm = vi.fn();
const mockAgentCancel = vi.fn();

vi.mock('$lib/api', () => ({
  api: {
    agentChat: (...args: unknown[]) => mockAgentChat(...args),
    agentConfirm: (...args: unknown[]) => mockAgentConfirm(...args),
    agentCancel: (...args: unknown[]) => mockAgentCancel(...args),
  },
}));

import BotChat from '$lib/components/BotChat.svelte';

describe('BotChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state with prompt text when no messages', () => {
    render(BotChat, { props: { masjidId: 'm1' } });
    expect(screen.getByText('Ask the AI to configure your masjid')).toBeInTheDocument();
  });

  it('adds user message on send', async () => {
    mockAgentChat.mockResolvedValueOnce({ message: 'Done', diff: null });
    render(BotChat, { props: { masjidId: 'm1' } });
    const textarea = screen.getByPlaceholderText(/Type a message/);
    await fireEvent.input(textarea, { target: { value: 'Hello bot' } });
    await fireEvent.click(screen.getByRole('button'));
    // User message should appear (the component re-renders asynchronously)
    expect(await screen.findByText('Hello bot')).toBeInTheDocument();
  });

  it('calls agentChat API on send', async () => {
    mockAgentChat.mockResolvedValueOnce({ message: 'Done', diff: null });
    render(BotChat, { props: { masjidId: 'm1' } });
    const textarea = screen.getByPlaceholderText(/Type a message/);
    await fireEvent.input(textarea, { target: { value: 'Hello' } });
    await fireEvent.click(screen.getByRole('button'));
    expect(mockAgentChat).toHaveBeenCalledWith('m1', { message: 'Hello' });
  });

  it('shows bot response after send', async () => {
    mockAgentChat.mockResolvedValueOnce({ message: 'I updated the theme', diff: null });
    render(BotChat, { props: { masjidId: 'm1' } });
    const textarea = screen.getByPlaceholderText(/Type a message/);
    await fireEvent.input(textarea, { target: { value: 'Update theme' } });
    await fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('I updated the theme')).toBeInTheDocument();
  });

  it('shows DiffReceiptCard when response has diff data', async () => {
    mockAgentChat.mockResolvedValueOnce({
      message: 'Theme updated',
      diff: { THEME: [{ action: 'UPSERT', target: 'primary_color', summary: '#000' }] },
      branch_id: 'br1',
    });
    render(BotChat, { props: { masjidId: 'm1' } });
    const textarea = screen.getByPlaceholderText(/Type a message/);
    await fireEvent.input(textarea, { target: { value: 'Set theme dark' } });
    await fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('Config Changes')).toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    mockAgentChat.mockRejectedValueOnce(new Error('Network failure'));
    render(BotChat, { props: { masjidId: 'm1' } });
    const textarea = screen.getByPlaceholderText(/Type a message/);
    await fireEvent.input(textarea, { target: { value: 'Hi' } });
    await fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/Network failure/)).toBeInTheDocument();
  });

  it('shows active session bar with branch ID when branch is active', async () => {
    mockAgentChat.mockResolvedValueOnce({
      message: 'Changes proposed',
      diff: { THEME: [{ action: 'UPSERT', target: 'color', summary: '#fff' }] },
      branch_id: 'br12345678',
    });
    render(BotChat, { props: { masjidId: 'm1' } });
    const textarea = screen.getByPlaceholderText(/Type a message/);
    await fireEvent.input(textarea, { target: { value: 'Change color' } });
    await fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/Active session/)).toBeInTheDocument();
  });

  it('hides Confirm/Cancel buttons after confirming', async () => {
    mockAgentChat.mockResolvedValueOnce({
      message: 'Done',
      diff: { THEME: [{ action: 'UPSERT', target: 'color', summary: '#fff' }] },
      branch_id: 'br1',
    });
    mockAgentConfirm.mockResolvedValueOnce({ success: true });

    render(BotChat, { props: { masjidId: 'm1' } });
    const textarea = screen.getByPlaceholderText(/Type a message/);
    await fireEvent.input(textarea, { target: { value: 'Change color' } });
    await fireEvent.click(screen.getByRole('button'));
    
    const confirmBtn = await screen.findByText('Confirm');
    await fireEvent.click(confirmBtn);
    
    expect(mockAgentConfirm).toHaveBeenCalledWith('m1', 'br1');
  });
});
