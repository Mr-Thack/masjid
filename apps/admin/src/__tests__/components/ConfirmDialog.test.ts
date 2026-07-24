import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
import { fireEvent } from '@testing-library/svelte';

describe('ConfirmDialog', () => {
  it('does not render when open is false', () => {
    render(ConfirmDialog, {
      props: { open: false, onConfirm: () => {}, onCancel: () => {} },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, message, and buttons when open', () => {
    render(ConfirmDialog, {
      props: { open: true, title: 'Delete Item', message: 'This cannot be undone.', onConfirm: () => {}, onCancel: () => {} },
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(ConfirmDialog, {
      props: { open: true, onConfirm, onCancel },
    });
    const buttons = screen.getAllByText('Confirm');
    const confirmBtn = buttons.find(b => b.tagName === 'BUTTON')!;
    await fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(ConfirmDialog, {
      props: { open: true, onConfirm, onCancel },
    });
    await fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
