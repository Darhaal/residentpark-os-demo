// Title: User Actions
// Path: src/actions/users.ts
// Functionality: Next.js Server Actions connecting the UI to the Identity Domain Service.
//
// Every action starts with a role guard from '@/lib/auth', so only authorized staff can
// modify other accounts.

'use server';

import { createClient as createStatelessClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { logActionError, logActionWarn } from '@/lib/action-logger';
import { UserService } from '@/services/UserService';
import { AppError, toActionError, toDatabaseAppError } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/auth';
import { ACCOUNT_STATUS, USER_ROLES, isSuperadminRole } from '@/config/domain';
import { BULK_ACTION_LIMITS } from '@/config/limits';
import { ROUTES } from '@/config/routes';
import { validateUuid, validateUuidList } from '@/lib/action-validation';
import { en } from '@/localization/en';

type EditableAccountStatus = typeof ACCOUNT_STATUS.approved | typeof ACCOUNT_STATUS.suspended | typeof ACCOUNT_STATUS.rejected;
type EditableUserRole = typeof USER_ROLES.resident | typeof USER_ROLES.admin | typeof USER_ROLES.superadmin;
type BulkEditableUserRole = typeof USER_ROLES.resident | typeof USER_ROLES.admin;
type ProvisionableUserRole = typeof USER_ROLES.resident | typeof USER_ROLES.admin;

export async function createUserAccountAction(input: {
  fullName: string;
  email: string;
  confirmAdminPassword: string;
  role: ProvisionableUserRole;
  apartmentId: string | null;
}) {
  let createdUserId: string | null = null;
  let adminClient: ReturnType<typeof createStatelessClient> | null = null;

  try {
    const auth = await requireAdmin();
    await enforceRateLimit(auth.supabase, 'account_create');
    if (
      !input ||
      typeof input.fullName !== 'string' ||
      typeof input.email !== 'string' ||
      typeof input.confirmAdminPassword !== 'string'
    ) {
      throw new AppError('VALIDATION_ERROR', 'Account details are incomplete.');
    }
    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    const apartmentId = typeof input.apartmentId === 'string' && input.apartmentId.trim()
      ? validateUuid(input.apartmentId, 'apartment ID')
      : null;

    if (!fullName || fullName.length > 255) {
      throw new AppError('VALIDATION_ERROR', 'Enter a valid full name.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('VALIDATION_ERROR', 'Enter a valid email address.');
    }
    if (input.role !== USER_ROLES.resident && input.role !== USER_ROLES.admin) {
      throw new AppError('VALIDATION_ERROR', 'Unsupported account role.');
    }
    if (input.role === USER_ROLES.admin && !isSuperadminRole(auth.role)) {
      throw new AppError('FORBIDDEN', 'Only a superadmin can create an admin account.');
    }
    if (input.role === USER_ROLES.resident && !apartmentId) {
      throw new AppError('VALIDATION_ERROR', 'Select an apartment for the resident.');
    }

    if (apartmentId) {
      const { data: apartment, error: apartmentError } = await auth.supabase
        .from('apartments')
        .select('id')
        .eq('id', apartmentId)
        .maybeSingle();
      if (apartmentError) throw toDatabaseAppError(apartmentError, { INTERNAL_ERROR: 'Could not validate the apartment.' });
      if (!apartment) throw new AppError('NOT_FOUND', 'The selected apartment no longer exists.');
    }

    if (input.role === USER_ROLES.admin) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey || !auth.email) {
        throw new AppError('INTERNAL_ERROR', 'Administrator verification is not configured.');
      }
      const verificationClient = createStatelessClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { error: verificationError } = await verificationClient.auth.signInWithPassword({
        email: auth.email,
        password: input.confirmAdminPassword,
      });
      if (verificationError) {
        throw new AppError('FORBIDDEN', 'Verification failed: incorrect administrator password.');
      }
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRoleKey || !supabaseUrl) {
      throw new AppError('INTERNAL_ERROR', 'Account provisioning is not configured on this server.');
    }

    adminClient = createStatelessClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const requestOrigin = (await headers()).get('origin');
    if (!requestOrigin) {
      throw new AppError('INTERNAL_ERROR', 'Invitation delivery origin is unavailable.');
    }
    let redirectOrigin: string;
    try {
      const parsedOrigin = new URL(requestOrigin);
      if (parsedOrigin.protocol !== 'https:' && parsedOrigin.protocol !== 'http:') throw new Error('Invalid protocol');
      redirectOrigin = parsedOrigin.origin;
    } catch {
      throw new AppError('INTERNAL_ERROR', 'Invitation delivery origin is invalid.');
    }

    const { data, error: createError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${redirectOrigin}${ROUTES.resetPassword}`,
    });

    if (createError || !data.user) {
      const duplicate = createError?.message.toLowerCase().includes('already') || createError?.status === 422;
      throw new AppError(
        duplicate ? 'CONFLICT' : 'INTERNAL_ERROR',
        duplicate ? 'An account with this email already exists.' : 'The invitation could not be sent.',
        createError,
      );
    }

    createdUserId = data.user.id;
    await UserService.provisionCreatedAccount(
      auth.supabase,
      createdUserId,
      input.role,
      input.role === USER_ROLES.resident ? apartmentId : null,
      auth.userId,
    );

    return { success: true as const, userId: createdUserId };
  } catch (error) {
    if (createdUserId && adminClient) {
      const { error: rollbackError } = await adminClient.auth.admin.deleteUser(createdUserId);
      if (rollbackError) {
        await logActionError('createUserAccountAction rollback failed', rollbackError, { createdUserId });
      }
    }
    await logActionError('Action: createUserAccountAction failed', error, { createdUserId });
    return toActionError(error);
  }
}

export async function updateUserPermissionsAction({
  targetUserId, newRole, isManager, newApartmentId, reason, confirmPassword
}: {
  targetUserId: string;
  newRole: EditableUserRole;
  isManager: boolean;
  newApartmentId: string | null;
  reason: string;
  confirmPassword: string;
}) {
  try {
    // AuthZ: must already be an admin to manage anyone's permissions.
    const { supabase, userId, email, role } = await requireAdmin();
    if (!reason.trim()) {
      throw new AppError('VALIDATION_ERROR', en.adminUsers.auditReasonRequired);
    }

    // AuthZ hardening: granting an elevated role (admin/superadmin) is superadmin-only.
    // This blocks an admin from minting more admins (horizontal escalation).
    // If your org wants admins to appoint other admins, relax this to allow 'admin'.
    if ((newRole === USER_ROLES.admin || newRole === USER_ROLES.superadmin) && !isSuperadminRole(role)) {
      throw new AppError('FORBIDDEN', 'Only a superadmin can grant admin or superadmin roles.');
    }

    // Step-up auth: re-verify the actor's password before a high-impact change.
    // NOTE: this proves IDENTITY, not authorization — the role guard above is what
    // actually authorizes the operation.
    if (!email) throw new AppError('UNAUTHORIZED', 'Session is missing an email identity.');
    const statelessSupabase = createStatelessClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { error: reauthError } = await statelessSupabase.auth.signInWithPassword({
      email,
      password: confirmPassword
    });

    if (reauthError) {
      await logActionWarn('Permission update failed: Invalid signature', { adminId: userId });
      return { success: false, error: 'Verification failed: Incorrect password.', code: 'FORBIDDEN' as const };
    }

    await UserService.updatePermissions(
      supabase,
      validateUuid(targetUserId, 'user ID'),
      newRole,
      isManager,
      newApartmentId ? validateUuid(newApartmentId, 'apartment ID') : null,
      reason,
      userId,
    );
    return { success: true as const };
  } catch (error) {
    await logActionError('Action: updateUserPermissionsAction failed', error);
    return toActionError(error);
  }
}

export async function updateUserStatusAction(targetUserId: string, newStatus: EditableAccountStatus, reason: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    await UserService.changeAccountStatus(supabase, validateUuid(targetUserId, 'user ID'), newStatus, reason, userId);
    return { success: true as const };
  } catch (error) {
    await logActionError('Action: updateUserStatusAction failed', error);
    return toActionError(error);
  }
}

export async function bulkUpdateUserStatusAction(targetUserIds: string[], newStatus: EditableAccountStatus, reason: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    await enforceRateLimit(supabase, 'user_bulk');
    const ids = validateUuidList(targetUserIds, BULK_ACTION_LIMITS.selectedRecords, 'user ID');
    await UserService.bulkChangeAccountStatus(supabase, ids, newStatus, reason, userId);
    return { success: true as const };
  } catch (error) {
    await logActionError('Action: bulkUpdateUserStatusAction failed', error);
    return toActionError(error);
  }
}

export async function bulkUpdatePermissionsAction(
  targetUserIds: string[],
  newRole: BulkEditableUserRole,
  reason: string
) {
  try {
    // AuthZ hardening: bulk-granting 'admin' is superadmin-only (same rationale as above).
    const { supabase, userId, role } = await requireAdmin();
    await enforceRateLimit(supabase, 'user_bulk');
    if (newRole === USER_ROLES.admin && !isSuperadminRole(role)) {
      throw new AppError('FORBIDDEN', 'Only a superadmin can grant admin roles in bulk.');
    }
    const ids = validateUuidList(targetUserIds, BULK_ACTION_LIMITS.selectedRecords, 'user ID');
    await UserService.bulkUpdatePermissions(supabase, ids, newRole, reason, userId);
    return { success: true as const };
  } catch (error) {
    await logActionError('Action: bulkUpdatePermissionsAction failed', error);
    return toActionError(error);
  }
}
