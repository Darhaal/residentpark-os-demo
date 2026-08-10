// @vitest-environment jsdom
// Title: Suspend Confirm Modal Accessibility Test
// Path: src/app/admin/users/SuspendConfirmModal.test.tsx
// Functionality: A representative destructive-modal a11y check — confirms the modal
//   composes the shared Modal primitive (dialog semantics + Escape) and wires its
//   cancel/confirm actions correctly.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { SuspendConfirmModal } from './SuspendConfirmModal';
import { en } from '@/localization/en';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

const props = () => ({ email: 'resident@example.test', isSaving: false, onCancel: vi.fn(), onConfirm: vi.fn() });

describe('SuspendConfirmModal accessibility', () => {
  it('renders an accessible destructive dialog', () => {
    render(<SuspendConfirmModal {...props()} />);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(dialog!.getAttribute('aria-label')).toBe(en.adminUsers.revokeTitle);
  });

  it('cancels on Escape', () => {
    const p = props();
    render(<SuspendConfirmModal {...p} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(p.onCancel).toHaveBeenCalledTimes(1);
  });

  it('confirms via the destructive action button', () => {
    const p = props();
    const { getByRole } = render(<SuspendConfirmModal {...p} />);
    fireEvent.click(getByRole('button', { name: en.adminUsers.confirmRevocation }));
    expect(p.onConfirm).toHaveBeenCalledTimes(1);
  });
});
