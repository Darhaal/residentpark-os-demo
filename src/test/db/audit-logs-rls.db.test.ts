// Title: Audit Logs RLS DB Test
// Path: src/test/db/audit-logs-rls.db.test.ts
// Functionality: Database authorization and RLS coverage for audit log visibility.

// the audit log (get_audit_logs) is superadmin-only: residents and even regular
// admins must be refused (0003 restricts it to is_superadmin()).

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, createResident, deleteUser, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('get_audit_logs — read restriction', () => {
  const created: string[] = [];

  afterEach(async () => {
    while (created.length) {
      const id = created.pop();
      if (id) await deleteUser(id);
    }
  });

  it('refuses a resident', async () => {
    const user = await createResident({ approve: true });
    created.push(user.id);
    const client = await signedInClient(user.email, user.password);
    const { error } = await client.rpc('get_audit_logs', {});
    expect(error?.message ?? '').toMatch(/FORBIDDEN|superadmin/i);
  });

  it('refuses a regular admin', async () => {
    const user = await createAdmin();
    created.push(user.id);
    const client = await signedInClient(user.email, user.password);
    const { error } = await client.rpc('get_audit_logs', {});
    expect(error?.message ?? '').toMatch(/FORBIDDEN|superadmin/i);
  });

  it('allows a superadmin', async () => {
    const user = await createAdmin({ superadmin: true });
    created.push(user.id);
    const client = await signedInClient(user.email, user.password);
    const { error } = await client.rpc('get_audit_logs', {});
    expect(error).toBeNull();
  });
});
