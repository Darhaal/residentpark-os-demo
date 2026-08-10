// Title: User Service Test
// Path: src/services/UserService.test.ts
// Functionality: Unit coverage for identity service RPC adapter contracts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_STATUS, USER_ROLES } from '@/config/domain';
import { UserService } from './UserService';

const targetUserId = '11111111-1111-4111-8111-111111111111';
const apartmentId = '22222222-2222-4222-8222-222222222222';
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function supabaseWithRpc(rpc = vi.fn()) {
  return { rpc } as unknown as SupabaseClient;
}

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provisions resident accounts through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(UserService.provisionCreatedAccount(
      supabase,
      targetUserId,
      USER_ROLES.resident,
      apartmentId,
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_provision_pending_account', {
      p_target_id: targetUserId,
      p_role: USER_ROLES.resident,
      p_apartment_id: apartmentId,
      p_actor_id: actorId,
    });
  });

  it('requires an apartment when provisioning a resident account', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(UserService.provisionCreatedAccount(
      supabase,
      targetUserId,
      USER_ROLES.resident,
      null,
      actorId,
    )).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'A resident account requires an apartment.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('changes account status through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(UserService.changeAccountStatus(
      supabase,
      targetUserId,
      ACCOUNT_STATUS.suspended,
      'Policy violation',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_identity_update_status', {
      p_target_id: targetUserId,
      p_new_status: ACCOUNT_STATUS.suspended,
      p_reason: 'Policy violation',
    });
  });

  it('blocks self account-status changes before calling the database', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(UserService.changeAccountStatus(
      supabase,
      actorId,
      ACCOUNT_STATUS.suspended,
      'Self change',
      actorId,
    )).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'You cannot change your own account status.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('bulk changes account status through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);
    const targetUserIds = [targetUserId, '33333333-3333-4333-8333-333333333333'];

    await expect(UserService.bulkChangeAccountStatus(
      supabase,
      targetUserIds,
      ACCOUNT_STATUS.rejected,
      'Bulk rejection',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_identity_bulk_update_status', {
      p_target_ids: targetUserIds,
      p_new_status: ACCOUNT_STATUS.rejected,
      p_reason: 'Bulk rejection',
    });
  });

  it('approves and assigns through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(UserService.approveAndAssign(
      supabase,
      targetUserId,
      apartmentId,
      'Approved by staff',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_identity_approve_and_assign', {
      p_target_id: targetUserId,
      p_apartment_id: apartmentId,
      p_reason: 'Approved by staff',
    });
  });

  it('bulk approves and assigns accounts through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);
    const targets = [
      { targetUserId, apartmentId },
      { targetUserId: '33333333-3333-4333-8333-333333333333', apartmentId: null },
    ];

    await expect(UserService.bulkApproveAndAssign(supabase, targets, 'Bulk approval'))
      .resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_identity_bulk_approve_and_assign', {
      p_targets: targets,
      p_reason: 'Bulk approval',
    });
  });

  it('does not call the database for an empty bulk approve set', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(UserService.bulkApproveAndAssign(supabase, [], 'No-op'))
      .resolves.toBeUndefined();

    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps bulk approval RPC failures to safe errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'transaction failed' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(UserService.bulkApproveAndAssign(supabase, [{ targetUserId, apartmentId }], 'Bulk approval'))
      .rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'Bulk approval transaction failed.',
      });
  });

  it('updates permissions through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(UserService.updatePermissions(
      supabase,
      targetUserId,
      USER_ROLES.resident,
      true,
      apartmentId,
      'Promoted to unit manager',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_identity_update_permissions', {
      p_target_id: targetUserId,
      p_new_role: USER_ROLES.resident,
      p_is_manager: true,
      p_apartment_id: apartmentId,
      p_reason: 'Promoted to unit manager',
    });
  });

  it('does not send manager=true when the target role is admin', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(UserService.updatePermissions(
      supabase,
      targetUserId,
      USER_ROLES.admin,
      true,
      null,
      'Staff assignment',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_identity_update_permissions', {
      p_target_id: targetUserId,
      p_new_role: USER_ROLES.admin,
      p_is_manager: false,
      p_apartment_id: null,
      p_reason: 'Staff assignment',
    });
  });

  it('blocks self permission changes before calling the database', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(UserService.updatePermissions(
      supabase,
      actorId,
      USER_ROLES.admin,
      false,
      null,
      'Self grant',
      actorId,
    )).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'You cannot modify your own privileges.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('bulk updates permissions through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);
    const targetUserIds = [targetUserId, '33333333-3333-4333-8333-333333333333'];

    await expect(UserService.bulkUpdatePermissions(
      supabase,
      targetUserIds,
      USER_ROLES.admin,
      'Bulk role change',
      actorId,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_identity_bulk_update_permissions', {
      p_target_ids: targetUserIds,
      p_new_role: USER_ROLES.admin,
      p_reason: 'Bulk role change',
    });
  });

  it('maps account-status RPC failures to safe errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(UserService.changeAccountStatus(
      supabase,
      targetUserId,
      ACCOUNT_STATUS.suspended,
      'Policy violation',
      actorId,
    )).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
    });
  });
});
