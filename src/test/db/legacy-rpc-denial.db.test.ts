// Title: Legacy RPC Denial DB Test
// Path: src/test/db/legacy-rpc-denial.db.test.ts
// Functionality: Ensures replaced legacy SECURITY DEFINER RPC signatures are not executable by normal authenticated clients.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, deleteUser, signedInClient } from './harness';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

describe.skipIf(!hasDbEnv())('legacy identity RPC denial', () => {
  const users: string[] = [];

  afterEach(async () => {
    while (users.length) {
      const id = users.pop();
      if (id) await deleteUser(id);
    }
  });

  it('does not allow authenticated admins to call replaced identity RPCs', async () => {
    const admin = await createAdmin();
    users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);

    const calls = [
      client.rpc('tx_update_profile_status', {
        p_target_id: ZERO_UUID,
        p_new_status: 'approved',
        p_reason: 'legacy-denial-test',
        p_actor_id: admin.id,
        p_payload: {},
        p_severity: 'info',
      }),
      client.rpc('tx_bulk_update_profile_status', {
        p_target_ids: [ZERO_UUID],
        p_new_status: 'approved',
        p_reason: 'legacy-denial-test',
        p_actor_id: admin.id,
        p_payload: {},
        p_severity: 'info',
      }),
      client.rpc('tx_approve_and_assign', {
        p_target_id: ZERO_UUID,
        p_apartment_id: ZERO_UUID,
        p_reason: 'legacy-denial-test',
        p_actor_id: admin.id,
        p_payload: {},
      }),
      client.rpc('tx_update_permissions', {
        p_target_id: ZERO_UUID,
        p_new_role: 'resident',
        p_is_manager: false,
        p_apartment_id: null,
        p_actor_id: admin.id,
        p_payload: {},
        p_severity: 'info',
      }),
      client.rpc('tx_bulk_update_permissions', {
        p_target_ids: [ZERO_UUID],
        p_new_role: 'resident',
        p_is_manager: false,
        p_actor_id: admin.id,
        p_payload: {},
        p_severity: 'info',
      }),
      client.rpc('tx_bulk_approve_and_assign_units', {
        p_targets: [{ targetUserId: ZERO_UUID, apartmentId: ZERO_UUID }],
        p_reason: 'legacy-denial-test',
        p_actor_id: admin.id,
      }),
      client.rpc('tx_update_apartment_status', {
        p_apartment_id: ZERO_UUID,
        p_new_status: 'vacant',
        p_actor_id: admin.id,
        p_payload: {},
        p_severity: 'info',
        p_workflow_status: 'closed',
      }),
      // Retired by 20260705000000 in favor of tx_bulk_block_and_relocate (F7).
      client.rpc('tx_bulk_block_spots', {
        p_zone: null,
        p_floor: null,
        p_reason: 'legacy-denial-test',
        p_blocked_until: null,
        p_actor_id: admin.id,
        p_payload: {},
      }),
    ];

    const results = await Promise.all(calls);

    for (const result of results) {
      expect(result.error).not.toBeNull();
      expect(['42501', 'PGRST202', '42883']).toContain(result.error?.code);
    }
  });
});
