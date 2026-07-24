import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ErrorCard from '$lib/components/ErrorCard.svelte';
import { fireEvent } from '@testing-library/svelte';

describe('ErrorCard', () => {
  it('renders the error message', () => {
    render(ErrorCard, { props: { message: 'Server error occurred' } });
    expect(screen.getByText('Server error occurred')).toBeInTheDocument();
  });

  it('shows retry button when onRetry prop is provided', () => {
    render(ErrorCard, { props: { message: 'Error', onRetry: () => {} } });
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('hides retry button when onRetry is not provided', () => {
    render(ErrorCard, { props: { message: 'Error' } });
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('renders default message when no message prop', () => {
    render(ErrorCard);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const onRetry = vi.fn();
    render(ErrorCard, { props: { message: 'Failed', onRetry } });
    await fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalled();
  });
});
