// Title: Admin Data Loaders
// Path: src/actions/loaders.ts
// Functionality: Centralized admin data loaders.

'use server';

import { AppError, toDatabaseAppError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';
import { ACCOUNT_STATUS, FILTER_ALL, VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { PAGE_LIMITS } from '@/config/limits';
import { requireAdmin, type AuthContext } from '@/lib/auth';
import { resolveCursor, resolvePageLimit, validateUuid } from '@/lib/action-validation';
import { AdminLoaderService } from '@/services/AdminLoaderService';

function toLoaderError(err: unknown, fallback = 'Failed to load data.') {
  if (AppError.isAppError(err)) {
    return { success: false as const, error: err.message, code: err.code };
  }
  return { success: false as const, error: fallback, code: 'INTERNAL_ERROR' as const };
}

function sanitizePostgrestSearch(value: string) {
  return value.replace(/[,()*%\\]/g, ' ').trim();
}

function toCurrentUser(auth: AuthContext) {
  return { full_name: auth.fullName, role: auth.role };
}

interface VehicleDirectoryRow {
  id: string;
  approval_status: string;
}

interface AssignedVehicleSpotRow {
  id: string;
  spot_number: string | null;
  floor: string | null;
  zone: string | null;
  status: string | null;
  assigned_vehicle_id: string | null;
}

interface VehicleActionEventRow {
  entity_id: string | null;
  action_type: string | null;
  created_at: string | null;
  payload: unknown;
}

const vehicleActionTypes = ['VEHICLE_STATUS_CHANGED', 'VEHICLE_REMOVED'] as const;

function getEventReason(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const reason = (payload as Record<string, unknown>).reason;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
}

export async function loadParkingMapStateAction(targetDate: string) {
  try {
    const auth = await requireAdmin();
    const { supabase } = auth;
    const currentUser = toCurrentUser(auth);

    const state = await AdminLoaderService.loadParkingMapState(supabase, targetDate);

    return { success: true as const, currentUser, state };
  } catch (err) {
    await logActionError('loadParkingMapStateAction failed', err);
    return toLoaderError(err, 'Failed to load parking map.');
  }
}

export async function loadVehiclesDirectoryAction(filterStatus: string) {
  try {
    const auth = await requireAdmin();
    const { supabase } = auth;
    const currentUser = toCurrentUser(auth);

    let query = supabase.from('vehicles')
      .select('*, apartments(apartment_number), profiles!vehicles_owner_id_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (filterStatus !== FILTER_ALL) query = query.eq('approval_status', filterStatus);
    else query = query.neq('approval_status', VEHICLE_APPROVAL_STATUS.archived);

    const [vehiclesRes, aptsRes] = await Promise.all([
      query,
      supabase.from('apartments').select('id, apartment_number, profiles!profiles_apartment_id_fkey(id, full_name)').order('apartment_number')
    ]);

    if (vehiclesRes.error) throw toDatabaseAppError(vehiclesRes.error, { INTERNAL_ERROR: 'Failed to load vehicles.' });
    if (aptsRes.error) throw toDatabaseAppError(aptsRes.error, { INTERNAL_ERROR: 'Failed to load apartments.' });

    const vehicleRows = (vehiclesRes.data || []) as VehicleDirectoryRow[];
    const vehicleIds = vehicleRows.map(vehicle => vehicle.id);
    const [spotsRes, eventsRes] = vehicleIds.length
      ? await Promise.all([
          supabase
            .from('parking_spots')
            .select('id, spot_number, floor, zone, status, assigned_vehicle_id')
            .in('assigned_vehicle_id', vehicleIds),
          supabase
            .from('events')
            .select('entity_id, action_type, payload, created_at')
            .eq('entity_type', 'vehicle')
            .in('entity_id', vehicleIds)
            .in('action_type', [...vehicleActionTypes])
            .order('created_at', { ascending: false }),
        ])
      : [
          { data: [] as AssignedVehicleSpotRow[], error: null },
          { data: [] as VehicleActionEventRow[], error: null },
        ];

    if (spotsRes.error) throw toDatabaseAppError(spotsRes.error, { INTERNAL_ERROR: 'Failed to load vehicle assignments.' });
    if (eventsRes.error) throw toDatabaseAppError(eventsRes.error, { INTERNAL_ERROR: 'Failed to load vehicle action history.' });

    const spotByVehicleId = new Map<string, Omit<AssignedVehicleSpotRow, 'assigned_vehicle_id'>>();
    for (const spot of (spotsRes.data || []) as AssignedVehicleSpotRow[]) {
      if (!spot.assigned_vehicle_id) continue;
      spotByVehicleId.set(spot.assigned_vehicle_id, {
        id: spot.id,
        spot_number: spot.spot_number,
        floor: spot.floor,
        zone: spot.zone,
        status: spot.status,
      });
    }

    const latestActionByVehicleId = new Map<string, { action_type: string | null; reason: string | null; created_at: string | null }>();
    for (const event of (eventsRes.data || []) as VehicleActionEventRow[]) {
      if (!event.entity_id || latestActionByVehicleId.has(event.entity_id)) continue;
      latestActionByVehicleId.set(event.entity_id, {
        action_type: event.action_type,
        reason: getEventReason(event.payload),
        created_at: event.created_at,
      });
    }

    const vehicles = vehicleRows.map(vehicle => ({
      ...vehicle,
      assigned_spot: spotByVehicleId.get(vehicle.id) ?? null,
      last_action_note: latestActionByVehicleId.get(vehicle.id) ?? null,
    }));

    return { success: true as const, currentUser, vehicles, apartments: aptsRes.data };
  } catch (err) {
    await logActionError('loadVehiclesDirectoryAction failed', err);
    return toLoaderError(err, 'Failed to load vehicles.');
  }
}

export async function loadPendingApprovalsAction() {
  try {
    const auth = await requireAdmin();
    const { supabase } = auth;
    const currentUser = toCurrentUser(auth);

    const [aptsRes, accountsRes, vehiclesRes] = await Promise.all([
      supabase.from('apartments').select('id, apartment_number, profiles!profiles_apartment_id_fkey(id, full_name)').order('apartment_number'),
      supabase.from('profiles').select('id, email, full_name, created_at, apartments!profiles_apartment_id_fkey(apartment_number)').eq('approval_status', ACCOUNT_STATUS.pendingApproval).order('created_at', { ascending: true }),
      supabase.from('vehicles').select('*, apartments(apartment_number), profiles!vehicles_owner_id_fkey(full_name)').eq('approval_status', VEHICLE_APPROVAL_STATUS.pendingApproval).order('created_at', { ascending: true })
    ]);

    if (aptsRes.error) throw toDatabaseAppError(aptsRes.error, { INTERNAL_ERROR: 'Failed to load apartments.' });
    if (accountsRes.error) throw toDatabaseAppError(accountsRes.error, { INTERNAL_ERROR: 'Failed to load pending accounts.' });
    if (vehiclesRes.error) throw toDatabaseAppError(vehiclesRes.error, { INTERNAL_ERROR: 'Failed to load pending vehicles.' });

    return { success: true as const, currentUser, apartments: aptsRes.data, pendingAccounts: accountsRes.data, pendingVehicles: vehiclesRes.data };
  } catch (err) {
    await logActionError('loadPendingApprovalsAction failed', err);
    return toLoaderError(err, 'Failed to load approvals queue.');
  }
}

interface UserDirectoryRow {
  apartments?: { id: string | null; apartment_number: string | null } | null;
}

export async function loadUsersDirectoryAction(params: {
  cursorCreatedAt?: string | null;
  cursorId?: string | null;
  limit: number;
  search?: string | null;
  roleFilter?: string;
  statusFilter?: string;
}) {
  try {
    const auth = await requireAdmin();
    const { supabase } = auth;
    const currentUser = toCurrentUser(auth);
    const limit = resolvePageLimit(params.limit, PAGE_LIMITS.users, PAGE_LIMITS.users);
    const cursor = resolveCursor(params);

    let query = supabase
      .from('profiles')
      .select('*, apartments:apartments!profiles_apartment_id_fkey(id, apartment_number)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    const cleanSearch = params.search ? sanitizePostgrestSearch(params.search) : '';
    if (cleanSearch) query = query.or(`full_name.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%`);
    if (params.roleFilter && params.roleFilter !== 'ALL') query = query.eq('role', params.roleFilter);
    if (params.statusFilter && params.statusFilter !== 'ALL') query = query.eq('approval_status', params.statusFilter);
    if (cursor) {
      query = query.or(
        `created_at.lt.${cursor.cursorCreatedAt},and(created_at.eq.${cursor.cursorCreatedAt},id.lt.${cursor.cursorId})`,
      );
    }

    const [usersRes, aptsRes] = await Promise.all([
      query,
      supabase.from('apartments').select('id, apartment_number').order('apartment_number')
    ]);

    if (usersRes.error) throw toDatabaseAppError(usersRes.error, { INTERNAL_ERROR: 'Failed to load users.' });
    if (aptsRes.error) throw toDatabaseAppError(aptsRes.error, { INTERNAL_ERROR: 'Failed to load apartments.' });

    const hasMore = usersRes.data.length > limit;
    const pageRows = usersRes.data.slice(0, limit);
    const formattedUsers = pageRows.map((u: UserDirectoryRow) => ({
      ...u, apartment_number: u.apartments?.apartment_number || null, apartment_id: u.apartments?.id || null
    }));

    return { success: true as const, currentUser, users: formattedUsers, apartments: aptsRes.data, hasMore };
  } catch (err) {
    await logActionError('loadUsersDirectoryAction failed', err);
    return toLoaderError(err, 'Identity Database unreachable.');
  }
}

export async function loadApartmentsDirectoryAction() {
  try {
    const auth = await requireAdmin();
    const { supabase } = auth;
    const currentUser = toCurrentUser(auth);

    const { data, error } = await supabase.from('apartments').select(`id, apartment_number, status, profiles!profiles_apartment_id_fkey(count), vehicles(count)`);
    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Failed to load apartments.' });

    return { success: true as const, currentUser, apartments: data };
  } catch (err) {
    await logActionError('loadApartmentsDirectoryAction failed', err);
    return toLoaderError(err, 'Failed to load apartments.');
  }
}

export async function loadApartmentDetailsAction(apartmentId: string) {
  try {
    const auth = await requireAdmin();
    const { supabase } = auth;
    const currentUser = toCurrentUser(auth);
    const cleanApartmentId = validateUuid(apartmentId, 'apartment ID');

    const [aptRes, vehicles, timelineRes, spotsRes, incidentsRes] = await Promise.all([
      supabase.from('apartments').select('*, profiles!profiles_apartment_id_fkey(*)').eq('id', cleanApartmentId).single(),
      AdminLoaderService.loadApartmentAuthorizedVehicles(supabase, cleanApartmentId),
      AdminLoaderService.loadApartmentTimeline(supabase, cleanApartmentId),
      supabase.from('parking_spots').select('*').eq('assigned_apartment_id', cleanApartmentId),
      AdminLoaderService.loadApartmentOpenIncidents(supabase, cleanApartmentId),
    ]);

    if (aptRes.error) throw toDatabaseAppError(aptRes.error, { INTERNAL_ERROR: 'Failed to load apartment details.' });
    if (spotsRes.error) throw toDatabaseAppError(spotsRes.error, { INTERNAL_ERROR: 'Failed to load apartment parking spots.' });

    return {
      success: true as const,
      currentUser,
      details: {
        ...aptRes.data,
        vehicles,
        timeline: timelineRes,
        parking_spots: spotsRes.data || [],
        active_incidents: incidentsRes,
      }
    };
  } catch (err) {
    await logActionError('loadApartmentDetailsAction failed', err);
    return toLoaderError(err, 'Failed to load apartment details.');
  }
}
