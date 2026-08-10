// Title: Audit Service Test
// Path: src/services/AuditService.test.ts
// Functionality: Unit coverage for typed audit RPC adapters and runtime result validation.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService, type AuditLog } from './AuditService';

const auditRow: AuditLog = {
  id: '11111111-1111-4111-8111-111111111111',
  admin_id: '22222222-2222-4222-8222-222222222222',
  action_type: 'TEST_EVENT',
  description: 'Test event',
  created_at: '2026-06-23T00:00:00.000Z',
  entity_type: 'system',
  entity_id: null,
  old_data: { before: 'a' },
  new_data: { after: 'b' },
  ip_address: null,
  user_agent: null,
  request_id: null,
  actor_email_snapshot: 'root@example.test',
  actor_role_snapshot: 'superadmin',
  admin_full_name: 'Root Admin',
  admin_email: 'root@example.test',
};

function supabaseWithRpc(rpc = vi.fn()) {
  return { rpc } as unknown as SupabaseClient;
}

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a manual audit event through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(AuditService.createManualEvent(supabase, {
      domain: ' system ',
      actionType: ' admin_manual_note ',
      severity: 'info',
      description: '  Operator note  ',
    })).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_create_manual_event', {
      p_domain: 'system',
      p_action_type: 'ADMIN_MANUAL_NOTE',
      p_severity: 'info',
      p_description: 'Operator note',
    });
  });

  it('rejects an empty manual event before calling the database', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(AuditService.createManualEvent(supabase, {
      domain: 'system',
      actionType: 'ADMIN_MANUAL_NOTE',
      severity: 'info',
      description: '   ',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Audit event description is required.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('loads and validates audit-log rows returned by the RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [auditRow], error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(AuditService.loadLogs(supabase, {
      cursorCreatedAt: null,
      cursorId: null,
      limitCount: 26,
      searchQuery: null,
      actionFilter: 'ALL',
      dateFrom: null,
      dateTo: null,
    })).resolves.toEqual([auditRow]);

    expect(rpc).toHaveBeenCalledWith('get_audit_logs', {
      cursor_created_at: null,
      cursor_id: null,
      limit_count: 26,
      search_query: null,
      action_filter: 'ALL',
      date_from: null,
      date_to: null,
    });
  });

  it('rejects invalid audit-log RPC result shapes', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ ...auditRow, id: 123 }], error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(AuditService.loadLogs(supabase, {
      cursorCreatedAt: null,
      cursorId: null,
      limitCount: 1,
      searchQuery: null,
      actionFilter: 'ALL',
      dateFrom: null,
      dateTo: null,
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Audit log row is missing required fields.',
    });
  });

  it('maps audit RPC failures to safe errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(AuditService.createManualEvent(supabase, {
      domain: 'system',
      actionType: 'ADMIN_MANUAL_NOTE',
      severity: 'info',
      description: 'Operator note',
    })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
    });
  });
});
