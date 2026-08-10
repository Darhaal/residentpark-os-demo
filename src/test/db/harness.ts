// Title: Harness DB Test Helper
// Path: src/test/db/harness.ts
// Functionality: Shared database test harness support for Supabase authorization checks.

// Test-DB clients + helpers for RLS / RPC authorization tests.
// Service-role client bypasses RLS (setup/teardown); anon + signed-in clients
// exercise the policies the way the real app does.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { dbEnv } from './env';

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function serviceClient(): SupabaseClient {
  const e = dbEnv();
  return createClient(e.url, e.serviceKey, clientOptions);
}

export function anonClient(): SupabaseClient {
  const e = dbEnv();
  return createClient(e.url, e.anonKey, clientOptions);
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

let counter = 0;

export async function createResident(options: { approve?: boolean; apartmentId?: string } = {}): Promise<TestUser> {
  const admin = serviceClient();
  const email = `rls-test-${Date.now()}-${counter++}@example.test`;
  const password = 'Test-Passw0rd!';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'RLS Test User' },
  });
  if (error || !data.user) {
    throw new Error(`createUser failed: ${error?.message ?? 'no user returned'}`);
  }
  const patch: Record<string, unknown> = {};
  if (options.approve) patch.approval_status = 'approved';
  if (options.apartmentId) patch.apartment_id = options.apartmentId;
  if (Object.keys(patch).length > 0) {
    const { error: patchError } = await admin.from('profiles').update(patch).eq('id', data.user.id);
    if (patchError) throw new Error(`profile patch failed: ${patchError.message}`);
  }
  return { id: data.user.id, email, password };
}

// Creates an approved admin (or superadmin). Role elevation goes through the service
// client, whose updates run with auth.uid() = null (the trusted-maintenance path the
// privilege-boundary trigger allows).
export async function createAdmin(options: { superadmin?: boolean } = {}): Promise<TestUser> {
  const user = await createResident();
  const role = options.superadmin ? 'superadmin' : 'admin';
  const { error } = await serviceClient()
    .from('profiles')
    .update({ role, approval_status: 'approved' })
    .eq('id', user.id);
  if (error) throw new Error(`createAdmin failed: ${error.message}`);
  return user;
}

export async function createApartment(): Promise<{ id: string; number: string }> {
  const number = `T-${Date.now()}-${counter++}`;
  const { data, error } = await serviceClient()
    .from('apartments')
    .insert({ apartment_number: number })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createApartment failed: ${error?.message ?? 'no row'}`);
  return { id: data.id as string, number };
}

export async function deleteUser(id: string): Promise<void> {
  await serviceClient().auth.admin.deleteUser(id);
}

export async function deleteApartment(id: string): Promise<void> {
  await serviceClient().from('apartments').delete().eq('id', id);
}

export async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn failed: ${error.message}`);
  return client;
}
