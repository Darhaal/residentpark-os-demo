// Title: Apartment Service Test
// Path: src/services/ApartmentService.test.ts
// Functionality: Unit coverage for apartment service RPC adapter contracts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APARTMENT_STATUS, USER_ROLES } from '@/config/domain';
import { ApartmentService } from './ApartmentService';

const apartmentId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function supabaseWithRpc(rpc = vi.fn()) {
  return { rpc } as unknown as SupabaseClient;
}

function queryResult(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn().mockResolvedValue(result),
  };

  return query;
}

describe('ApartmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('changes apartment status through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(ApartmentService.changeStatus(
      supabase,
      apartmentId,
      APARTMENT_STATUS.problem,
      'Pipe repair',
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_apartment_update_status', {
      p_apartment_id: apartmentId,
      p_new_status: APARTMENT_STATUS.problem,
      p_reason: 'Pipe repair',
    });
  });

  it('adds apartment events through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(ApartmentService.reportIncident(
      supabase,
      apartmentId,
      'Water leak reported.',
      'warning',
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_add_apartment_event', {
      p_apartment_id: apartmentId,
      p_content: 'Water leak reported.',
      p_severity: 'warning',
    });
  });

  it('assigns an apartment admin through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const apartmentQuery = queryResult({
      data: { apartment_number: 'A-101', assigned_admin_id: null },
      error: null,
    });
    const adminQuery = queryResult({
      data: { role: USER_ROLES.admin, email: 'ops@example.com' },
      error: null,
    });
    const from = vi.fn((table: string) => (table === 'apartments' ? apartmentQuery : adminQuery));
    const supabase = { rpc, from } as unknown as SupabaseClient;

    await expect(ApartmentService.assignAdmin(supabase, apartmentId, adminId, actorId))
      .resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_assign_admin', {
      p_apartment_id: apartmentId,
      p_admin_id: adminId,
      p_actor_id: actorId,
      p_payload: {
        content: 'Assigned unit responsibility to ops@example.com',
        apartment_number: 'A-101',
        old_admin_id: null,
        new_admin_id: adminId,
        operation_type: 'manual',
      },
      p_severity: 'info',
    });
  });

  it('does not call the database transaction when the assigned admin is unchanged', async () => {
    const rpc = vi.fn();
    const apartmentQuery = queryResult({
      data: { apartment_number: 'A-101', assigned_admin_id: adminId },
      error: null,
    });
    const from = vi.fn(() => apartmentQuery);
    const supabase = { rpc, from } as unknown as SupabaseClient;

    await expect(ApartmentService.assignAdmin(supabase, apartmentId, adminId, actorId))
      .resolves.toBeUndefined();

    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects assigning a resident as apartment admin before calling the transaction', async () => {
    const rpc = vi.fn();
    const apartmentQuery = queryResult({
      data: { apartment_number: 'A-101', assigned_admin_id: null },
      error: null,
    });
    const residentQuery = queryResult({
      data: { role: USER_ROLES.resident, email: 'resident@example.com' },
      error: null,
    });
    const from = vi.fn((table: string) => (table === 'apartments' ? apartmentQuery : residentQuery));
    const supabase = { rpc, from } as unknown as SupabaseClient;

    await expect(ApartmentService.assignAdmin(supabase, apartmentId, adminId, actorId))
      .rejects.toMatchObject({
        code: 'RULE_VIOLATION',
        message: 'Only users with admin or superadmin roles can be assigned to an apartment.',
      });

    expect(rpc).not.toHaveBeenCalled();
  });
});
