// Title: Admin Notices Client Test
// Path: src/app/admin/notices/AdminNoticesClient.test.tsx
// Functionality: Component coverage for workspace composition and accessible audience selection.

/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { NoticeRow } from '@/actions/notices';
import { en } from '@/localization/en';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  sendNoticeAction: vi.fn(),
  updatePortalNoticeAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('@/actions/notices', () => ({
  sendNoticeAction: mocks.sendNoticeAction,
}));

vi.mock('@/actions/settings', () => ({
  updatePortalNoticeAction: mocks.updatePortalNoticeAction,
}));

import { AdminNoticesClient } from './AdminNoticesClient';

const messages = en.adminNotices;
const notices: NoticeRow[] = [
  {
    id: 'notice-1',
    batch_id: 'batch-1',
    recipient_id: 'resident-1',
    title: 'Garage update',
    body: '<p>Move by 8 AM.</p>',
    type: 'announcement',
    created_at: '2026-06-25T10:00:00.000Z',
    read_at: '2026-06-25T11:00:00.000Z',
  },
  {
    id: 'notice-2',
    batch_id: 'batch-1',
    recipient_id: 'resident-2',
    title: 'Garage update',
    body: '<p>Move by 8 AM.</p>',
    type: 'announcement',
    created_at: '2026-06-25T10:00:00.000Z',
    read_at: null,
  },
];

function renderClient() {
  return render(
    <AdminNoticesClient
      notices={notices}
      apartments={[{ id: 'apartment-1', apartment_number: '101' }]}
      residents={[{ id: 'resident-1', full_name: 'Erin Resident', email: 'erin@example.com', unit: '101' }]}
      portalNotice="Garage closes at 8 AM."
      settingsReady
    />,
  );
}

describe('AdminNoticesClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('composes banner, delivery form, and grouped history', () => {
    renderClient();

    expect(screen.getByRole('heading', { name: messages.pageTitle, level: 1 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: messages.portalBanner.title })).toBeTruthy();
    expect(screen.getByRole('heading', { name: messages.composeTitle })).toBeTruthy();
    expect(screen.getByRole('heading', { name: messages.sentTitle(1) })).toBeTruthy();
    expect(screen.getByText(messages.recipients(2))).toBeTruthy();
    expect(screen.getByText(messages.readCount(1, 2))).toBeTruthy();
  });

  it('exposes pressed audience state and the matching target control', () => {
    renderClient();

    const allButton = screen.getByRole('button', { name: messages.audiences.all });
    const apartmentButton = screen.getByRole('button', { name: messages.audiences.apartment });
    const residentButton = screen.getByRole('button', { name: messages.audiences.profile });

    expect(allButton.getAttribute('aria-pressed')).toBe('true');
    expect(apartmentButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(apartmentButton);
    expect(allButton.getAttribute('aria-pressed')).toBe('false');
    expect(apartmentButton.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText(messages.apartmentLabel)).toBeTruthy();

    fireEvent.click(residentButton);
    expect(residentButton.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText(messages.residentLabel)).toBeTruthy();
    expect(screen.queryByLabelText(messages.apartmentLabel)).toBeNull();
  });
});
