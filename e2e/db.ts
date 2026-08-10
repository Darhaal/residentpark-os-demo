// Title: E2E DB Setup Helper
// Path: e2e/db.ts
// Functionality: Service-role Supabase access for E2E setup/teardown and authoritative
//   state assertions. Reads the app env (.env.local) — the same Supabase the dev server
//   under test talks to — and is guarded so invitation specs only run against a local
//   stack, never a real project.

import { existsSync, readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The dev server (npm run dev) auto-loads .env.local; the Playwright runner process does
// not, so load it here for the service-role client. CI writes .env.local from the local
// Supabase stack before running E2E (see .github/workflows/ci.yml).
function loadEnvLocal(path = '.env.local'): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// Invitation specs do service-role writes (create apartments/invitations, delete users).
// Only run them against a LOCAL Supabase so a dev machine pointed at a real project never
// accumulates junk identities. CI's `supabase status` URL is http://127.0.0.1:54321.
export function canRunInvitationE2E(): boolean {
  if (!SUPABASE_URL || !SERVICE_KEY) return false;
  try {
    const host = new URL(SUPABASE_URL).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host.endsWith('.local');
  } catch {
    return false;
  }
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, clientOptions);
}

export async function createApartment(): Promise<{ id: string; number: string }> {
  const number = `E2E-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const { data, error } = await serviceClient()
    .from('apartments')
    .insert({ apartment_number: number })
    .select('id')
    .single();
  if (error || !data) throw new Error(`createApartment failed: ${error?.message ?? 'no row'}`);
  return { id: data.id as string, number };
}

// expires_at is intentionally omitted — the invitations table defaults it to a future
// timestamp (the committed DB suite relies on the same default).
export async function createInvitation(email: string, apartmentId: string, token: string): Promise<void> {
  const { error } = await serviceClient()
    .from('invitations')
    .insert({ email, role: 'resident', apartment_id: apartmentId, status: 'pending', token });
  if (error) throw new Error(`createInvitation failed: ${error.message}`);
}

export interface ProfileState {
  id: string;
  approval_status: string;
  apartment_id: string | null;
}

export async function getProfileByEmail(email: string): Promise<ProfileState | null> {
  const { data } = await serviceClient()
    .from('profiles')
    .select('id, approval_status, apartment_id')
    .eq('email', email)
    .maybeSingle();
  return (data as ProfileState | null) ?? null;
}

export async function getInvitationStatus(token: string): Promise<string | null> {
  const { data } = await serviceClient()
    .from('invitations')
    .select('status')
    .eq('token', token)
    .maybeSingle();
  return (data?.status as string | undefined) ?? null;
}

export async function deleteUserByEmail(email: string): Promise<void> {
  const profile = await getProfileByEmail(email);
  if (profile?.id) await serviceClient().auth.admin.deleteUser(profile.id);
}

export async function deleteApartment(id: string): Promise<void> {
  await serviceClient().from('apartments').delete().eq('id', id);
}

export async function deleteInvitation(token: string): Promise<void> {
  await serviceClient().from('invitations').delete().eq('token', token);
}
