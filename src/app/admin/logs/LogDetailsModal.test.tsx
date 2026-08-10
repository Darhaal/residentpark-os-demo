// @vitest-environment jsdom
// Title: Log Details Modal Test
// Path: src/app/admin/logs/LogDetailsModal.test.tsx
// Functionality: Component coverage for long audit diff values in the inspect modal.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LogDetailsModal } from './LogDetailsModal';
import type { AuditLog } from '@/services/AuditService';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

const baseLog = (oldValue: string, newValue: string): AuditLog => ({
  id: '11111111-1111-4111-8111-111111111111',
  admin_id: '22222222-2222-4222-8222-222222222222',
  action_type: 'TEST_EVENT',
  description: 'Changed a long value',
  created_at: '2026-06-22T00:00:00.000Z',
  entity_type: 'system',
  entity_id: null,
  old_data: { payload: { token: oldValue } },
  new_data: { payload: { token: newValue } },
  ip_address: null,
  user_agent: null,
  request_id: null,
  actor_email_snapshot: 'root@example.com',
  actor_role_snapshot: 'superadmin',
  admin_full_name: 'Root Admin',
  admin_email: 'root@example.com',
});

describe('LogDetailsModal', () => {
  it('wraps long diff values inside the modal instead of forcing horizontal overflow', () => {
    const oldToken = `old-${'a'.repeat(96)}`;
    const newToken = `new-${'b'.repeat(96)}`;

    render(<LogDetailsModal log={baseLog(oldToken, newToken)} onClose={vi.fn()} />);

    const oldValue = screen.getByText(JSON.stringify(oldToken));
    const newValue = screen.getByText(JSON.stringify(newToken));

    expect(oldValue.className).toContain('max-w-full');
    expect(oldValue.className).toContain('whitespace-pre-wrap');
    expect(oldValue.className).toContain('[overflow-wrap:anywhere]');
    expect(newValue.className).toContain('max-w-full');
    expect(newValue.className).toContain('whitespace-pre-wrap');
    expect(newValue.className).toContain('[overflow-wrap:anywhere]');
  });
});
