// Title: Operational Reports
// Path: src/actions/reports.ts
// Functionality: Read-only admin reports computed from existing tables (no new schema).
// Powers /admin/reports. CSV export is built client-side from these datasets.

'use server';

import { requireAdmin } from '@/lib/auth';
import { toActionError, toDatabaseAppError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';
import { ACCOUNT_STATUS, PARKING_ISSUE_STATUS, USER_ROLES, VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import {
  parkingSpotStateCountsAsOccupied,
  parkingSpotStateOf,
  type ParkingSpotState,
} from '@/config/parking';
import { en } from '@/localization/en';

export interface ReportsData {
  occupancy: { total: number; available: number; occupied: number; blocked: number; conflict: number; reserved: number; percent: number };
  pendingAccounts: number;
  pendingVehicles: number;
  openIssues: number;
  vehiclesWithoutSpot: { id: string; plate_number: string; make: string; model: string | null; unit: string | null; owner: string | null }[];
  unitsWithoutVehicle: { id: string; apartment_number: string; status: string; residents: number }[];
}

type MaybeArray<T> = T | T[] | null | undefined;
type OccupancyBucket = ParkingSpotState;

interface SpotReportRow {
  id: string;
  assigned_vehicle_id: string | null;
  status: string;
}

interface VehicleReportRow {
  id: string;
  plate_number: string;
  make: string;
  model: string | null;
  approval_status: string;
  apartment_id: string | null;
  apartments?: MaybeArray<{ apartment_number: string | null }>;
  profiles?: MaybeArray<{ full_name: string | null }>;
}

interface ApartmentReportRow {
  id: string;
  apartment_number: string;
  status: string;
}

interface ProfileReportRow {
  id: string;
  apartment_id: string | null;
  role: string;
  approval_status: string;
}

const bucket = (status: string): OccupancyBucket => parkingSpotStateOf(status);
const reportMessages = en.adminReports.actionErrors;
const residentCountsForOccupancy = (profile: ProfileReportRow) =>
  profile.role === USER_ROLES.resident && profile.approval_status !== ACCOUNT_STATUS.rejected;
const vehicleCountsForRegistration = (vehicle: VehicleReportRow) =>
  vehicle.approval_status !== VEHICLE_APPROVAL_STATUS.archived &&
  vehicle.approval_status !== VEHICLE_APPROVAL_STATUS.rejected;

export async function loadReportsAction() {
  try {
    const { supabase, ...currentUser } = await requireAdmin();

    const [spotsRes, vehiclesRes, aptsRes, profilesRes, pendAcc, pendVeh, openIss] = await Promise.all([
      supabase.from('parking_spots').select('id, assigned_vehicle_id, status'),
      supabase.from('vehicles').select('id, plate_number, make, model, approval_status, apartment_id, apartments(apartment_number), profiles:profiles!vehicles_owner_id_fkey(full_name)'),
      supabase.from('apartments').select('id, apartment_number, status'),
      supabase.from('profiles').select('id, apartment_id, role, approval_status'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('approval_status', ACCOUNT_STATUS.pendingApproval),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('approval_status', VEHICLE_APPROVAL_STATUS.pendingApproval),
      supabase.from('parking_issues').select('id', { count: 'exact', head: true }).in('status', [PARKING_ISSUE_STATUS.open, PARKING_ISSUE_STATUS.inProgress]),
    ]);

    if (spotsRes.error) throw toDatabaseAppError(spotsRes.error, { INTERNAL_ERROR: reportMessages.loadSpots });
    if (vehiclesRes.error) throw toDatabaseAppError(vehiclesRes.error, { INTERNAL_ERROR: reportMessages.loadVehicles });
    if (aptsRes.error) throw toDatabaseAppError(aptsRes.error, { INTERNAL_ERROR: reportMessages.loadUnits });
    if (profilesRes.error) throw toDatabaseAppError(profilesRes.error, { INTERNAL_ERROR: reportMessages.loadProfiles });

    if (pendAcc.error) throw toDatabaseAppError(pendAcc.error, { INTERNAL_ERROR: reportMessages.loadPendingAccounts });
    if (pendVeh.error) throw toDatabaseAppError(pendVeh.error, { INTERNAL_ERROR: reportMessages.loadPendingVehicles });
    if (openIss.error) throw toDatabaseAppError(openIss.error, { INTERNAL_ERROR: reportMessages.loadIssueCount });

    const spots = (spotsRes.data || []) as SpotReportRow[];
    const occ = { total: spots.length, available: 0, occupied: 0, blocked: 0, conflict: 0, reserved: 0 };
    spots.forEach(s => {
      const state = bucket(s.status);
      occ[state]++;
      if (state !== 'occupied' && parkingSpotStateCountsAsOccupied(state)) occ.occupied++;
    });
    const occupancy = { ...occ, percent: occ.total ? Math.round((occ.occupied / occ.total) * 100) : 0 };

    const pick = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
    const parkedIds = new Set(spots.map(s => s.assigned_vehicle_id).filter((id): id is string => Boolean(id)));

    const vehicles = (vehiclesRes.data || []) as VehicleReportRow[];
    const vehiclesWithoutSpot = vehicles
      .filter(v => v.approval_status === VEHICLE_APPROVAL_STATUS.approved && !parkedIds.has(v.id))
      .map(v => ({
        id: v.id, plate_number: v.plate_number, make: v.make, model: v.model,
        unit: pick(v.apartments)?.apartment_number ?? null, owner: pick(v.profiles)?.full_name ?? null,
      }));

    const profiles = (profilesRes.data || []) as ProfileReportRow[];
    const residentsByApartment = new Map<string, number>();
    profiles.filter(residentCountsForOccupancy).forEach(profile => {
      if (!profile.apartment_id) return;
      residentsByApartment.set(profile.apartment_id, (residentsByApartment.get(profile.apartment_id) || 0) + 1);
    });

    const registeredVehiclesByApartment = new Map<string, number>();
    vehicles.filter(vehicleCountsForRegistration).forEach(vehicle => {
      if (!vehicle.apartment_id) return;
      registeredVehiclesByApartment.set(
        vehicle.apartment_id,
        (registeredVehiclesByApartment.get(vehicle.apartment_id) || 0) + 1
      );
    });

    const apartments = (aptsRes.data || []) as ApartmentReportRow[];
    const unitsWithoutVehicle = apartments
      .map(a => ({
        id: a.id,
        apartment_number: a.apartment_number,
        status: a.status,
        residents: residentsByApartment.get(a.id) || 0,
        vehicleCount: registeredVehiclesByApartment.get(a.id) || 0,
      }))
      .filter(a => a.vehicleCount === 0)
      .map(a => ({
        id: a.id,
        apartment_number: a.apartment_number,
        status: a.status,
        residents: a.residents,
      }));

    const data: ReportsData = {
      occupancy,
      pendingAccounts: pendAcc.count || 0,
      pendingVehicles: pendVeh.count || 0,
      openIssues: openIss.count || 0,
      vehiclesWithoutSpot,
      unitsWithoutVehicle,
    };

    return { success: true as const, currentUser, data };
  } catch (err) {
    await logActionError('loadReportsAction failed', err);
    return toActionError(err);
  }
}
