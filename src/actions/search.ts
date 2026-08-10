// Title: Global Search Action
// Path: src/actions/search.ts
// Functionality: Cross-entity admin search (vehicles, residents, apartments, spots).
// Read-only; admin-gated. Powers the Cmd+K command palette.

'use server';

import { requireAdmin } from '@/lib/auth';
import { toActionError, toDatabaseAppError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';
import { enforceRateLimit } from '@/lib/rate-limit';
import { VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { PAGE_LIMITS, UI_TIMING } from '@/config/limits';

export interface SearchResults {
  vehicles: { id: string; plate_number: string; make: string; model: string | null; approval_status: string; unit: string | null; owner: string | null }[];
  residents: { id: string; full_name: string | null; email: string | null; role: string; approval_status: string; unit: string | null }[];
  apartments: { id: string; apartment_number: string; status: string }[];
  spots: { id: string; spot_number: string; status: string; zone: string; floor: string; unit: string | null; plate: string | null }[];
}

const EMPTY: SearchResults = { vehicles: [], residents: [], apartments: [], spots: [] };

type MaybeArray<T> = T | T[] | null | undefined;

interface VehicleSearchRow {
  id: string;
  plate_number: string;
  make: string;
  model: string | null;
  approval_status: string;
  apartments?: MaybeArray<{ apartment_number: string | null }>;
  profiles?: MaybeArray<{ full_name: string | null }>;
}

interface ResidentSearchRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  approval_status: string;
  apartments?: MaybeArray<{ apartment_number: string | null }>;
}

interface ApartmentSearchRow {
  id: string;
  apartment_number: string;
  status: string;
}

interface SpotSearchRow {
  id: string;
  spot_number: string;
  status: string;
  zone: string;
  floor: string;
  apartments?: MaybeArray<{ apartment_number: string | null }>;
  vehicles?: MaybeArray<{ plate_number: string | null }>;
}

export async function globalSearchAction(query: string) {
  try {
    const { supabase } = await requireAdmin();

    // Sanitize: PostgREST .or() is sensitive to , ( ) and we use the term inside ilike.
    const term = (query || '').replace(/[,()*%\\]/g, ' ').trim();
    if (term.length < UI_TIMING.minimumSearchChars) return { success: true as const, results: EMPTY };
    await enforceRateLimit(supabase, 'global_search');
    const like = `%${term}%`;

    const [veh, res, apt, spot] = await Promise.all([
      supabase.from('vehicles')
        .select('id, plate_number, make, model, approval_status, apartments(apartment_number), profiles:profiles!vehicles_owner_id_fkey(full_name)')
        .or(`plate_number.ilike.${like},make.ilike.${like},model.ilike.${like}`)
        .neq('approval_status', VEHICLE_APPROVAL_STATUS.archived)
        .limit(PAGE_LIMITS.globalSearchResults),
      supabase.from('profiles')
        .select('id, full_name, email, role, approval_status, apartments:apartments!profiles_apartment_id_fkey(apartment_number)')
        .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
        .limit(PAGE_LIMITS.globalSearchResults),
      supabase.from('apartments')
        .select('id, apartment_number, status')
        .ilike('apartment_number', like)
        .limit(PAGE_LIMITS.globalSearchResults),
      supabase.from('parking_spots')
        .select('id, spot_number, status, zone, floor, apartments(apartment_number), vehicles(plate_number)')
        .ilike('spot_number', like)
        .limit(PAGE_LIMITS.globalSearchResults),
    ]);

    if (veh.error) throw toDatabaseAppError(veh.error, { INTERNAL_ERROR: 'Failed to search vehicles.' });
    if (res.error) throw toDatabaseAppError(res.error, { INTERNAL_ERROR: 'Failed to search residents.' });
    if (apt.error) throw toDatabaseAppError(apt.error, { INTERNAL_ERROR: 'Failed to search units.' });
    if (spot.error) throw toDatabaseAppError(spot.error, { INTERNAL_ERROR: 'Failed to search parking spots.' });

    const pick = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

    const vehicles = (veh.data || []) as VehicleSearchRow[];
    const residents = (res.data || []) as ResidentSearchRow[];
    const apartments = (apt.data || []) as ApartmentSearchRow[];
    const spots = (spot.data || []) as SpotSearchRow[];

    const results: SearchResults = {
      vehicles: vehicles.map(v => ({
        id: v.id, plate_number: v.plate_number, make: v.make, model: v.model, approval_status: v.approval_status,
        unit: pick(v.apartments)?.apartment_number ?? null, owner: pick(v.profiles)?.full_name ?? null,
      })),
      residents: residents.map(r => ({
        id: r.id, full_name: r.full_name, email: r.email, role: r.role, approval_status: r.approval_status,
        unit: pick(r.apartments)?.apartment_number ?? null,
      })),
      apartments: apartments.map(a => ({ id: a.id, apartment_number: a.apartment_number, status: a.status })),
      spots: spots.map(s => ({
        id: s.id, spot_number: s.spot_number, status: s.status, zone: s.zone, floor: s.floor,
        unit: pick(s.apartments)?.apartment_number ?? null, plate: pick(s.vehicles)?.plate_number ?? null,
      })),
    };

    return { success: true as const, results };
  } catch (err) {
    await logActionError('globalSearchAction failed', err);
    return toActionError(err);
  }
}
