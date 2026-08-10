// @vitest-environment jsdom
// Title: Top Navigation Test
// Path: src/components/TopNav.test.tsx
// Functionality: Component coverage for the global navigation back-button guard.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { en } from '@/localization/en';

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  pathname: '/',
  signOut: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ back: mocks.back }),
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mocks.signOut } }),
}));

vi.mock('@/components/GlobalSearch', () => ({
  GlobalSearch: () => <div data-testid="global-search" />,
}));

vi.mock('@/components/HelpButton', () => ({
  HelpButton: () => <button type="button">Help</button>,
}));

vi.mock('@/components/MobileNav', () => ({
  MobileNav: () => <nav aria-label="Mobile nav" />,
}));

vi.mock('@/components/NotificationBell', () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}));

import { TopNav } from './TopNav';

const messages = en.navigation;
const currentUser = {
  full_name: 'Erin Resident',
  role: 'resident',
  approval_status: 'approved',
};

describe('TopNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = '/';
    window.history.pushState({}, '', '/');
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it('hides the contextual back button on direct page entry', () => {
    window.history.pushState({}, '', '/admin/reports');
    mocks.pathname = '/admin/reports';

    render(<TopNav showBackButton currentUser={currentUser} />);

    expect(screen.queryByRole('button', { name: messages.back })).toBeNull();
  });

  it('shows the contextual back button after internal navigation and calls router.back', async () => {
    const view = render(<TopNav showBackButton currentUser={currentUser} />);
    expect(screen.queryByRole('button', { name: messages.back })).toBeNull();

    window.history.pushState({}, '', '/notices');
    mocks.pathname = '/notices';
    view.rerender(<TopNav showBackButton currentUser={currentUser} />);

    const backButton = await screen.findByRole('button', { name: messages.back });
    fireEvent.click(backButton);

    expect(mocks.back).toHaveBeenCalledTimes(1);
  });

  it('does not keep the back button when the page opts out', async () => {
    window.sessionStorage.setItem('resident-park-os:navigation-stack', JSON.stringify(['/', '/notices']));
    window.history.pushState({}, '', '/notices');
    mocks.pathname = '/notices';

    render(<TopNav showBackButton={false} currentUser={currentUser} />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: messages.back })).toBeNull();
    });
  });

  it('clears the stored navigation stack when the document is left', () => {
    window.sessionStorage.setItem('resident-park-os:navigation-stack', JSON.stringify(['/', '/notices']));

    render(<TopNav showBackButton currentUser={currentUser} />);
    window.dispatchEvent(new Event('pagehide'));

    expect(window.sessionStorage.getItem('resident-park-os:navigation-stack')).toBeNull();
  });
});
