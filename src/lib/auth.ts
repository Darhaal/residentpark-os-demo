// Title: Authorization Helpers
// Path: src/lib/auth.ts
// Functionality: Role and account-state guards for server actions, routes, and protected layouts.

// Centralized Server Action identity and role checks.
// Every action authorizes with auth.getUser(); UI visibility is not security.

import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors';
import { ACCOUNT_STATUS, USER_ROLES, isAdminRole, isApprovedStatus, isSuperadminRole } from '@/config/domain';

export type AppRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export interface AuthContext {
  supabase: SupabaseClient;
  userId: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  apartmentId: string | null;
  approvalStatus: string;
  isApartmentManager: boolean;
}

async function loadContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, role, apartment_id, approval_status, is_apartment_manager')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new AppError('NOT_FOUND', 'Profile not found for current session.');
  }

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    fullName: profile.full_name ?? null,
    role: profile.role as AppRole,
    apartmentId: profile.apartment_id ?? null,
    approvalStatus: profile.approval_status,
    isApartmentManager: profile.is_apartment_manager ?? false,
  };
}

/** Any authenticated user with a profile row. Most actions need a stricter guard. */
export async function requireUser(): Promise<AuthContext> {
  return loadContext();
}

/** Any approved account. Pending, suspended, and rejected accounts are denied. */
export async function requireApprovedUser(): Promise<AuthContext> {
  const context = await loadContext();
  if (context.approvalStatus !== ACCOUNT_STATUS.approved) {
    throw new AppError('FORBIDDEN', 'Account is pending approval or suspended.');
  }
  return context;
}

/** Approved admin or superadmin. A deactivated privileged account is denied. */
export async function requireAdmin(): Promise<AuthContext> {
  const context = await loadContext();
  if (!isAdminRole(context.role) || !isApprovedStatus(context.approvalStatus)) {
    throw new AppError('FORBIDDEN', 'Administrator privileges required.');
  }
  return context;
}

/** Approved superadmin only. A deactivated superadmin is denied. */
export async function requireSuperadmin(): Promise<AuthContext> {
  const context = await loadContext();
  if (!isSuperadminRole(context.role) || !isApprovedStatus(context.approvalStatus)) {
    throw new AppError('FORBIDDEN', 'Superadmin privileges required.');
  }
  return context;
}
