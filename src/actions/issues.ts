// Title: Parking Issue Actions
// Path: src/actions/issues.ts
// Functionality: Admin workflow for resident-reported parking issues.

'use server';

import { requireAdmin } from '@/lib/auth';
import { toActionError, toDatabaseAppError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';
import { ADMIN_ISSUES_CONFIG } from '@/config/admin-clients';
import { en } from '@/localization/en';
import { ParkingIssueService, type ParkingIssueStatus } from '@/services/ParkingIssueService';

// NOTE: a 'use server' module may only export async functions, so the
// ParkingIssueStatus type is imported directly from ParkingIssueService by
// consumers rather than re-exported here.

export interface ParkingIssueRow {
  id: string;
  spot_id: string | null;
  reporter_id: string | null;
  issue_type: string;
  violating_plate: string | null;
  comment: string | null;
  status: ParkingIssueStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  spot_number: string | null;
  spot_status: string | null;
  floor: string | null;
  zone: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  unit: string | null;
  resolver_name: string | null;
}

interface IssueDbRow {
  id: string;
  spot_id: string | null;
  reporter_id: string | null;
  issue_type: string;
  violating_plate: string | null;
  comment: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
}

interface SpotRow {
  id: string;
  spot_number: string | null;
  status: string | null;
  floor: string | null;
  zone: string | null;
  assigned_apartment_id: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  apartment_id: string | null;
}

interface ApartmentRow {
  id: string;
  apartment_number: string | null;
}

const issueStatuses = ADMIN_ISSUES_CONFIG.statuses;
const issueMessages = en.adminIssues.actionErrors;

const asIssueStatus = (value: string): ParkingIssueStatus =>
  value === issueStatuses.inProgress || value === issueStatuses.resolved || value === issueStatuses.closed
    ? value
    : issueStatuses.open;

const unique = (values: (string | null | undefined)[]) =>
  Array.from(new Set(values.filter((v): v is string => Boolean(v))));

export async function loadAdminParkingIssuesAction() {
  try {
    const { supabase, ...currentUser } = await requireAdmin();

    const { data: issueData, error: issueError } = await supabase
      .from('parking_issues')
      .select('id, spot_id, reporter_id, issue_type, violating_plate, comment, status, created_at, resolved_at, resolved_by, resolution_note')
      .order('created_at', { ascending: false })
      .limit(300);

    if (issueError) throw toDatabaseAppError(issueError, { INTERNAL_ERROR: issueMessages.loadIssues });

    const issues = (issueData || []) as IssueDbRow[];
    const spotIds = unique(issues.map(i => i.spot_id));
    const profileIds = unique([...issues.map(i => i.reporter_id), ...issues.map(i => i.resolved_by)]);

    const [spotsRes, profilesRes] = await Promise.all([
      spotIds.length
        ? supabase.from('parking_spots').select('id, spot_number, status, floor, zone, assigned_apartment_id').in('id', spotIds)
        : Promise.resolve({ data: [], error: null }),
      profileIds.length
        ? supabase.from('profiles').select('id, full_name, email, apartment_id').in('id', profileIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (spotsRes.error) throw toDatabaseAppError(spotsRes.error, { INTERNAL_ERROR: issueMessages.loadSpots });
    if (profilesRes.error) throw toDatabaseAppError(profilesRes.error, { INTERNAL_ERROR: issueMessages.loadProfiles });

    const spots = (spotsRes.data || []) as SpotRow[];
    const profiles = (profilesRes.data || []) as ProfileRow[];
    const apartmentIds = unique([...spots.map(s => s.assigned_apartment_id), ...profiles.map(p => p.apartment_id)]);

    const apartmentsRes = apartmentIds.length
      ? await supabase.from('apartments').select('id, apartment_number').in('id', apartmentIds)
      : { data: [], error: null };

    if (apartmentsRes.error) throw toDatabaseAppError(apartmentsRes.error, { INTERNAL_ERROR: issueMessages.loadUnits });

    const spotById = new Map(spots.map(s => [s.id, s]));
    const profileById = new Map(profiles.map(p => [p.id, p]));
    const apartmentById = new Map(((apartmentsRes.data || []) as ApartmentRow[]).map(a => [a.id, a]));

    const mappedIssues: ParkingIssueRow[] = issues.map(issue => {
      const spot = issue.spot_id ? spotById.get(issue.spot_id) : null;
      const reporter = issue.reporter_id ? profileById.get(issue.reporter_id) : null;
      const resolver = issue.resolved_by ? profileById.get(issue.resolved_by) : null;
      const apartmentId = reporter?.apartment_id || spot?.assigned_apartment_id || null;
      const apartment = apartmentId ? apartmentById.get(apartmentId) : null;

      return {
        id: issue.id,
        spot_id: issue.spot_id,
        reporter_id: issue.reporter_id,
        issue_type: issue.issue_type,
        violating_plate: issue.violating_plate,
        comment: issue.comment,
        status: asIssueStatus(issue.status),
        created_at: issue.created_at,
        resolved_at: issue.resolved_at,
        resolved_by: issue.resolved_by,
        resolution_note: issue.resolution_note,
        spot_number: spot?.spot_number ?? null,
        spot_status: spot?.status ?? null,
        floor: spot?.floor ?? null,
        zone: spot?.zone ?? null,
        reporter_name: reporter?.full_name ?? null,
        reporter_email: reporter?.email ?? null,
        unit: apartment?.apartment_number ?? null,
        resolver_name: resolver?.full_name ?? null,
      };
    });

    return { success: true as const, currentUser, issues: mappedIssues };
  } catch (err) {
    await logActionError('loadAdminParkingIssuesAction failed', err);
    return toActionError(err);
  }
}

export async function updateParkingIssueStatusAction(issueId: string, status: ParkingIssueStatus, note: string) {
  try {
    const { supabase, userId } = await requireAdmin();
    await ParkingIssueService.updateStatus(supabase, { issueId, status, note, actorId: userId });
    return { success: true as const };
  } catch (err) {
    await logActionError('updateParkingIssueStatusAction failed', err);
    return toActionError(err);
  }
}
