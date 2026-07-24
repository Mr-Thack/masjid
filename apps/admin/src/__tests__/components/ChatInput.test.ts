import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ChatInput from '$lib/components/ChatInput.svelte';
import { fireEvent } from '@testing-library/svelte';

describe('ChatInput', () => {
  it('renders textarea and send button', () => {
    render(ChatInput, { props: { onSend: () => {} } });
    expect(screen.getByPlaceholderText(/Type a message/)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    render(ChatInput, { props: { onSend: () => {} } });
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('calls onSend with text when send button is clicked', async () => {
    const onSend = vi.fn();
    render(ChatInput, { props: { onSend } });
    const textarea = screen.getByPlaceholderText(/Type a message/);
    await fireEvent.input(textarea, { target: { value: 'Hello world' } });
    await fireEvent.click(screen.getByRole('button'));
    expect(onSend).toHaveBeenCalledWith('Hello world');
  });

  it('clears input after sending', async () => {
    const onSend = vi.fn();
    render(ChatInput, { props: { onSend } });
    const textarea = screen.getByPlaceholderText(/Type a message/) as HTMLTextAreaElement;
    await fireEvent.input(textarea, { target: { value: 'Hello' } });
    await fireEvent.click(screen.getByRole('button'));
    expect(textarea.value).toBe('');
  });

  it('calls onSend on Enter key press', async () => {
    const onSend = vi.fn();
    render(ChatInput, { props: { onSend } });
    const textarea = screen.getByPlaceholderText(/Type a message/);
    await fireEvent.input(textarea, { target: { value: 'Quick msg' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('Quick msg');
  });

  it('shows file button when onFile prop is provided', () => {
    render(ChatInput, { props: { onSend: () => {}, onFile: () => {} } });
    const buttons = screen.getAllByRole('button');
    // There should be two buttons: paperclip and send
    expect(buttons.length).toBe(2);
  });
});
