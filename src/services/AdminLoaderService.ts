// Title: Admin Loader Service
// Path: src/services/AdminLoaderService.ts
// Functionality: Typed adapters for admin read RPCs used by server data loaders.

import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, toDatabaseAppError } from '@/lib/errors';
import {
  PARKING_LAYOUT_SHAPE_KINDS,
  type ParkingLayoutShape,
  type ParkingLayoutShapeKind,
} from '@/config/parking-layout';
import {
  AUTHORIZED_VEHICLE_APPROVAL_STATUSES,
  isAuthorizedVehicleApprovalStatus,
} from '@/config/domain';

export interface ParkingMapState {
  spots: unknown[];
  unassigned_pool: unknown[];
  layout_shapes: ParkingLayoutShape[];
}

export interface ApartmentTimelineRow {
  id: string;
  created_at: string;
  content: string | null;
  author_name: string | null;
  author_role: string | null;
  action_type?: string | null;
}

export interface ApartmentIncidentRow {
  id?: string;
  entity_id?: string | null;
  created_at?: string | null;
  content?: string | null;
  severity?: string | null;
  workflow_status?: string | null;
  action_type?: string | null;
  assigned_to?: string | null;
}

export interface ApartmentAuthorizedVehicleRow {
  id: string;
  plate_number: string;
  make: string | null;
  color: string | null;
  approval_status: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isMissingLayoutSchemaError = (error: { code?: string } | null) => (
  !!error && ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error.code || '')
);

function normalizeSnapshotAt(targetDate: string) {
  const value = typeof targetDate === 'string' ? targetDate.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
}

function parseParkingMapState(data: unknown): Omit<ParkingMapState, 'layout_shapes'> {
  if (!isRecord(data) || !Array.isArray(data.spots) || !Array.isArray(data.unassigned_pool)) {
    throw new AppError('INTERNAL_ERROR', 'Parking map RPC returned an invalid shape.');
  }
  return {
    spots: data.spots,
    unassigned_pool: data.unassigned_pool,
  };
}

function parseParkingPositions(data: unknown): Map<string, { pos_x: number | null; pos_y: number | null; rotation: number | null }> {
  if (!Array.isArray(data)) throw new AppError('INTERNAL_ERROR', 'Parking positions returned an invalid shape.');

  const positions = new Map<string, { pos_x: number | null; pos_y: number | null; rotation: number | null }>();
  for (const value of data) {
    if (!isRecord(value) || typeof value.id !== 'string') {
      throw new AppError('INTERNAL_ERROR', 'Parking positions returned an invalid shape.');
    }
    const validCoordinate = (coordinate: unknown) => coordinate === null || Number.isInteger(coordinate);
    if (!validCoordinate(value.pos_x) || !validCoordinate(value.pos_y) || !validCoordinate(value.rotation)) {
      throw new AppError('INTERNAL_ERROR', 'Parking positions returned an invalid shape.');
    }
    positions.set(value.id, {
      pos_x: value.pos_x as number | null,
      pos_y: value.pos_y as number | null,
      rotation: value.rotation as number | null,
    });
  }
  return positions;
}

function parseParkingLayoutShapes(data: unknown): ParkingLayoutShape[] {
  if (!Array.isArray(data)) throw new AppError('INTERNAL_ERROR', 'Parking layout returned an invalid shape.');

  return data.map((value) => {
    if (
      !isRecord(value)
      || typeof value.id !== 'string'
      || typeof value.floor !== 'string'
      || typeof value.kind !== 'string'
      || !PARKING_LAYOUT_SHAPE_KINDS.includes(value.kind as ParkingLayoutShapeKind)
      || !Number.isInteger(value.x)
      || !Number.isInteger(value.y)
      || !Number.isInteger(value.w)
      || !Number.isInteger(value.h)
      || !Number.isInteger(value.rotation)
      || (value.label !== null && typeof value.label !== 'string')
    ) {
      throw new AppError('INTERNAL_ERROR', 'Parking layout returned an invalid shape.');
    }
    return value as unknown as ParkingLayoutShape;
  });
}

function parseArrayResult<T>(data: unknown, message: string): T[] {
  if (!Array.isArray(data)) throw new AppError('INTERNAL_ERROR', message);
  return data as T[];
}

export class AdminLoaderService {
  static async loadParkingMapState(supabase: SupabaseClient, targetDate: string): Promise<ParkingMapState> {
    const [stateResult, positionResult, shapeResult] = await Promise.all([
      supabase.rpc('get_parking_map_state', {
        p_target_date: normalizeSnapshotAt(targetDate),
      }),
      supabase.from('parking_spots').select('id, pos_x, pos_y, rotation'),
      supabase.from('parking_layout_shapes').select('id, floor, kind, x, y, w, h, rotation, label'),
    ]);

    if (stateResult.error) throw toDatabaseAppError(stateResult.error, { INTERNAL_ERROR: 'Failed to load parking map.' });
    if (positionResult.error && !isMissingLayoutSchemaError(positionResult.error)) {
      throw toDatabaseAppError(positionResult.error, { INTERNAL_ERROR: 'Failed to load parking positions.' });
    }
    if (shapeResult.error && !isMissingLayoutSchemaError(shapeResult.error)) {
      throw toDatabaseAppError(shapeResult.error, { INTERNAL_ERROR: 'Failed to load parking layout.' });
    }

    const state = parseParkingMapState(stateResult.data);
    const positions = positionResult.error ? new Map() : parseParkingPositions(positionResult.data);
    const spots = state.spots.map((spot) => {
      if (!isRecord(spot) || typeof spot.id !== 'string') return spot;
      return {
        ...spot,
        ...(positions.get(spot.id) || { pos_x: null, pos_y: null, rotation: 0 }),
      };
    });

    return {
      ...state,
      spots,
      layout_shapes: shapeResult.error ? [] : parseParkingLayoutShapes(shapeResult.data),
    };
  }

  static async loadApartmentTimeline(supabase: SupabaseClient, apartmentId: string): Promise<ApartmentTimelineRow[]> {
    const { data, error } = await supabase.rpc('get_apartment_timeline', {
      p_apartment_id: apartmentId,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Failed to load apartment timeline.' });
    return parseArrayResult<ApartmentTimelineRow>(data, 'Apartment timeline RPC returned an invalid shape.');
  }

  static async loadApartmentOpenIncidents(supabase: SupabaseClient, apartmentId: string): Promise<ApartmentIncidentRow[]> {
    const { data, error } = await supabase.rpc('get_apartment_open_incidents', {
      p_apartment_id: apartmentId,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Failed to load apartment incidents.' });
    return parseArrayResult<ApartmentIncidentRow>(data, 'Apartment incidents RPC returned an invalid shape.');
  }

  static async loadApartmentAuthorizedVehicles(
    supabase: SupabaseClient,
    apartmentId: string,
  ): Promise<ApartmentAuthorizedVehicleRow[]> {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate_number, make, color, approval_status')
      .eq('apartment_id', apartmentId)
      .in('approval_status', [...AUTHORIZED_VEHICLE_APPROVAL_STATUSES])
      .order('plate_number');

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Failed to load apartment vehicles.' });
    return parseArrayResult<ApartmentAuthorizedVehicleRow>(
      data,
      'Apartment vehicles query returned an invalid shape.',
    ).filter(vehicle => isAuthorizedVehicleApprovalStatus(vehicle.approval_status));
  }
}
