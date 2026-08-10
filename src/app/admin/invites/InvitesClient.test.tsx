// Title: Invitations Client Test
// Path: src/app/admin/invites/InvitesClient.test.tsx
// Functionality: Component coverage for import parsing, tab semantics, directory loading, and preserved drafts.

/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { InvitationDirectoryRow } from '@/actions/invites';
import { en } from '@/localization/en';

const mocks = vi.hoisted(() => ({
  loadInvitesDirectoryAction: vi.fn(),
  processBulkInvites: vi.fn(),
  resendInviteAction: vi.fn(),
  revokeInviteAction: vi.fn(),
}));

vi.mock('@/actions/invites', () => ({
  loadInvitesDirectoryAction: mocks.loadInvitesDirectoryAction,
  processBulkInvites: mocks.processBulkInvites,
  resendInviteAction: mocks.resendInviteAction,
  revokeInviteAction: mocks.revokeInviteAction,
}));

import { InvitesClient } from './InvitesClient';

const messages = en.invitations;

function invitation(overrides: Partial<InvitationDirectoryRow> = {}): InvitationDirectoryRow {
  return {
    id: 'invite-1',
    email: 'erin@example.com',
    role: 'resident',
    status: 'pending',
    created_at: '2026-06-26T10:00:00.000Z',
    expires_at: '2026-07-03T10:00:00.000Z',
    token: 'token-1',
    apartments: { apartment_number: '101' },
    ...overrides,
  };
}

describe('InvitesClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadInvitesDirectoryAction.mockResolvedValue({
      success: true,
      invitations: [invitation()],
      hasMore: false,
    });
    mocks.processBulkInvites.mockResolvedValue({
      success: true,
      totalProcessed: 1,
      successful: 1,
      failed: [],
    });
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('links tabs to panels, supports arrow navigation, and preserves the import draft', async () => {
    render(<InvitesClient initialInvitations={[invitation()]} initialHasMore={false} />);

    const importTab = screen.getByRole('tab', { name: new RegExp(messages.tabs.import, 'i') });
    const directoryTab = screen.getByRole('tab', { name: new RegExp(messages.tabs.directory, 'i') });
    const input = screen.getByLabelText(messages.importInputAria) as HTMLTextAreaElement;

    expect(importTab.getAttribute('aria-selected')).toBe('true');
    expect(importTab.getAttribute('aria-controls')).toBe('invitations-import-panel');
    fireEvent.change(input, { target: { value: 'draft@example.com, 101' } });
    fireEvent.keyDown(importTab, { key: 'ArrowRight' });

    await waitFor(() => expect(directoryTab.getAttribute('aria-selected')).toBe('true'));
    await waitFor(() => expect(mocks.loadInvitesDirectoryAction).toHaveBeenCalledTimes(1));
    expect(directoryTab.getAttribute('aria-controls')).toBe('invitations-directory-panel');

    fireEvent.click(importTab);
    expect(input.value).toBe('draft@example.com, 101');
  });

  it('submits valid rows and includes local parsing failures in the report', async () => {
    render(<InvitesClient initialInvitations={[]} initialHasMore={false} />);

    fireEvent.change(screen.getByLabelText(messages.importInputAria), {
      target: { value: 'valid@example.com, 101\nmissing-unit@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: messages.sendButton }));

    await waitFor(() => {
      expect(mocks.processBulkInvites).toHaveBeenCalledWith([
        { email: 'valid@example.com', apartmentNumber: '101', role: 'resident' },
      ]);
    });

    const report = await screen.findByRole('region', { name: messages.reportTitle });
    expect(within(report).getByText('Row 2')).toBeTruthy();
    expect(report.textContent).toContain(messages.missingColumns);
  });
});
