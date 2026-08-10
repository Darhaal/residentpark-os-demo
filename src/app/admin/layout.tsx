// Title: Admin Authorization Layout Guard
// Path: src/app/admin/layout.tsx
// Functionality: Server-side authorization boundary.
// Physically prevents non-admins from loading any nested admin routes.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isAdminRole, isApprovedStatus } from '@/config/domain';
import { ROUTES } from '@/config/routes';
import { logRequestWarn } from '@/lib/request-logger';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // 1. Check Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(ROUTES.login);
  }

  // 2. Check Server-Side Role + Account-Status Authorization
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .single();

  // 3. Strict Boundary: only approved admins and superadmins pass. A deactivated
  //    (suspended/rejected/pending) privileged account is kicked back to the resident zone.
  if (!profile || !isAdminRole(profile.role) || !isApprovedStatus(profile.approval_status)) {
    await logRequestWarn('Unauthorized admin access attempt', { userId: user.id });
    redirect(ROUTES.home); // Kick back to safe resident zone
  }

  return <>{children}</>;
}
