// Title: Notification Bell Actions
// Path: src/actions/notification-bell.ts
// Functionality: Lightweight preview data for the notification bell dropdown.

'use server';

import { requireAdmin, requireApprovedUser } from '@/lib/auth';
import { toActionError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';
import { ACCOUNT_STATUS, PARKING_ISSUE_STATUS, VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { PAGE_LIMITS } from '@/config/limits';

export interface AdminNotifAccount {
  id: string;
  full_name: string | null;
  unit: string | null;
}

export interface AdminNotifVehicle {
  id: string;
  plate_number: string;
  make: string | null;
  unit: string | null;
}

export interface AdminNotifIssue {
  id: string;
  issue_type: string;
}

export interface ResidentNotifItem {
  id: string;
  title: string;
  body: string;
  type: string;
  created_at: string;
  read_at: string | null;
}

type AptShape = { apartment_number: string | null };

function aptUnit(apt: AptShape | AptShape[] | null | undefined): string | null {
  if (!apt) return null;
  return (Array.isArray(apt) ? apt[0] : apt)?.apartment_number ?? null;
}

export async function loadAdminNotifItemsAction() {
  try {
    const { supabase } = await requireAdmin();

    const [accountsRes, vehiclesRes, issuesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, apartments!profiles_apartment_id_fkey(apartment_number)')
        .eq('approval_status', ACCOUNT_STATUS.pendingApproval)
        .order('created_at', { ascending: true })
        .limit(PAGE_LIMITS.notificationAccounts),
      supabase
        .from('vehicles')
        .select('id, plate_number, make, apartments(apartment_number)')
        .eq('approval_status', VEHICLE_APPROVAL_STATUS.pendingApproval)
        .order('created_at', { ascending: true })
        .limit(PAGE_LIMITS.notificationVehicles),
      supabase
        .from('parking_issues')
        .select('id, issue_type')
        .in('status', [PARKING_ISSUE_STATUS.open, PARKING_ISSUE_STATUS.inProgress])
        .order('created_at', { ascending: true })
        .limit(PAGE_LIMITS.notificationIssues),
    ]);

    const accounts: AdminNotifAccount[] = ((accountsRes.data ?? []) as Array<{
      id: string; full_name: string | null;
      apartments: AptShape | AptShape[] | null;
    }>).map((r) => ({ id: r.id, full_name: r.full_name, unit: aptUnit(r.apartments) }));

    const vehicles: AdminNotifVehicle[] = ((vehiclesRes.data ?? []) as Array<{
      id: string; plate_number: string; make: string | null;
      apartments: AptShape | AptShape[] | null;
    }>).map((r) => ({ id: r.id, plate_number: r.plate_number, make: r.make, unit: aptUnit(r.apartments) }));

    const issues: AdminNotifIssue[] = (issuesRes.error ? [] : (issuesRes.data ?? [])).map((r) => ({
      id: r.id as string,
      issue_type: r.issue_type as string,
    }));

    return { success: true as const, accounts, vehicles, issues };
  } catch (err) {
    await logActionError('loadAdminNotifItemsAction failed', err);
    return toActionError(err);
  }
}

export async function loadResidentNotifAction() {
  try {
    const { supabase } = await requireApprovedUser();
    const { data, error } = await supabase
      .from('notices')
      .select('id, title, body, type, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(PAGE_LIMITS.residentNotifications);
    if (error) throw error;
    return { success: true as const, notices: (data ?? []) as ResidentNotifItem[] };
  } catch (err) {
    await logActionError('loadResidentNotifAction failed', err);
    return toActionError(err);
  }
}
