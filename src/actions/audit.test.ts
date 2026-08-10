// Title: Audit Actions Test
// Path: src/actions/audit.test.ts
// Functionality: Unit coverage for audit-log export rate-limit wiring and normal load behavior.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { PAGE_LIMITS } from '@/config/limits';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  logActionError: vi.fn(),
  requireSuperadmin: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/action-logger', () => ({
  logActionError: mocks.logActionError,
}));

vi.mock('@/lib/auth', () => ({
  requireSuperadmin: mocks.requireSuperadmin,
}));

import { loadAuditLogsAction } from './audit';
import type { AuditLog } from '@/services/AuditService';

const superadminId = '11111111-1111-4111-8111-111111111111';

function makeAuditRow(id: string): AuditLog {
  return {
    id,
    admin_id: superadminId,
    action_type: 'TEST_EVENT',
    description: 'Test event',
    created_at: '2026-06-22T00:00:00.000Z',
    entity_type: 'system',
    entity_id: null,
    old_data: null,
    new_data: null,
    ip_address: null,
    user_agent: null,
    request_id: null,
    actor_email_snapshot: 'root@example.com',
    actor_role_snapshot: 'superadmin',
    admin_full_name: 'Root Admin',
    admin_email: 'root@example.com',
  };
}

function makeProfileQuery() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn().mockResolvedValue({ data: { full_name: 'Root Admin', role: 'superadmin' }, error: null }),
  };
  return query;
}

function setupSuperadmin(options: {
  logs?: AuditLog[];
  exportAuditError?: unknown;
} = {}) {
  const profileQuery = makeProfileQuery();
  const from = vi.fn(() => profileQuery);
  const rpc = vi.fn((name: string) => {
    if (name === 'get_audit_logs') {
      return Promise.resolve({ data: options.logs ?? [], error: null });
    }
    if (name === 'tx_create_manual_event') {
      return Promise.resolve({ data: '22222222-2222-4222-8222-222222222222', error: options.exportAuditError ?? null });
    }
    return Promise.resolve({ data: null, error: null });
  });
  const supabase = { from, rpc };
  mocks.requireSuperadmin.mockResolvedValue({
    supabase,
    userId: superadminId,
    email: 'root@example.com',
    role: 'superadmin',
  });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.logActionError.mockResolvedValue(undefined);
  return { from, rpc, supabase };
}

describe('audit actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not apply the audit-export rate limit to normal audit page loads', async () => {
    const { rpc } = setupSuperadmin();

    await expect(loadAuditLogsAction({ limit: PAGE_LIMITS.auditLogs }))
      .resolves.toMatchObject({
        success: true,
        logs: [],
        hasMore: false,
      });

    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('get_audit_logs', expect.objectContaining({
      limit_count: PAGE_LIMITS.auditLogs + 1,
    }));
    expect(rpc).not.toHaveBeenCalledWith('tx_create_manual_event', expect.anything());
  });

  it('enforces the audit-export rate limit and records an audit event before returning export rows', async () => {
    const rows = [
      makeAuditRow('33333333-3333-4333-8333-333333333331'),
      makeAuditRow('33333333-3333-4333-8333-333333333332'),
    ];
    const { rpc, supabase } = setupSuperadmin({ logs: rows });

    await expect(loadAuditLogsAction({ limit: PAGE_LIMITS.auditLogsExport }))
      .resolves.toMatchObject({
        success: true,
        logs: rows,
        hasMore: false,
      });

    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(supabase, 'audit_export');
    expect(rpc).toHaveBeenCalledWith('get_audit_logs', expect.objectContaining({
      limit_count: PAGE_LIMITS.auditLogsExport + 1,
    }));
    expect(rpc).toHaveBeenCalledWith('tx_create_manual_event', expect.objectContaining({
      p_domain: 'system',
      p_action_type: 'AUDIT_LOG_EXPORT',
      p_severity: 'warning',
      p_description: expect.stringContaining('rows=2'),
    }));
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[0],
    );
    const getAuditCallOrder = rpc.mock.invocationCallOrder[0];
    const createEventCallOrder = rpc.mock.invocationCallOrder[1];
    expect(getAuditCallOrder).toBeLessThan(createEventCallOrder);
  });

  it('does not load audit rows when the audit-export rate limit is hit', async () => {
    const { from, rpc } = setupSuperadmin();
    mocks.enforceRateLimit.mockRejectedValue(new AppError('RATE_LIMITED', 'Please wait before exporting audit logs again.'));

    await expect(loadAuditLogsAction({ limit: PAGE_LIMITS.auditLogsExport }))
      .resolves.toEqual({
        success: false,
        error: 'Please wait before exporting audit logs again.',
        code: 'RATE_LIMITED',
      });

    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not return export rows when the export audit event cannot be recorded', async () => {
    const { rpc } = setupSuperadmin({
      logs: [makeAuditRow('33333333-3333-4333-8333-333333333333')],
      exportAuditError: { message: 'function failed' },
    });

    await expect(loadAuditLogsAction({ limit: PAGE_LIMITS.auditLogsExport }))
      .resolves.toEqual({
        success: false,
        error: 'Failed to record audit export event.',
        code: 'INTERNAL_ERROR',
      });

    expect(rpc).toHaveBeenCalledWith('get_audit_logs', expect.anything());
    expect(rpc).toHaveBeenCalledWith('tx_create_manual_event', expect.anything());
  });
});
