// Title: Global Search Component Test
// Path: src/components/GlobalSearch.test.tsx
// Functionality: Component coverage for command palette error feedback.

/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  globalSearchAction: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/actions/search', () => ({
  globalSearchAction: mocks.globalSearchAction,
}));

import { GlobalSearch } from './GlobalSearch';

describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a safe returned action error instead of a false empty state', async () => {
    mocks.globalSearchAction.mockResolvedValue({
      success: false,
      error: 'Please wait before searching again.',
      code: 'RATE_LIMITED',
    });

    render(<GlobalSearch />);
    fireEvent.click(screen.getByRole('button', { name: /open search/i }));
    fireEvent.change(screen.getByLabelText('Search query'), { target: { value: 'ABC' } });

    await waitFor(() => {
      expect(mocks.globalSearchAction).toHaveBeenCalledWith('ABC');
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Please wait before searching again.');
    });
    expect(screen.queryByText('No results for "ABC".')).toBeNull();
  });
});
