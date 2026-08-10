// Title: Vehicles Types
// Path: src/app/admin/vehicles/vehicles-types.ts
// Functionality: Shared TypeScript types for vehicle screens, actions, and component contracts.

// Shared types for the admin Vehicles directory and its extracted modals.

export interface VehicleDirectoryVehicle {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  approval_status: string;
  created_at: string;
  owner_id: string | null;
  apartments: { apartment_number: string | null } | null;
  profiles?: { full_name: string | null } | null;
  assigned_spot?: {
    id: string;
    spot_number: string | null;
    floor: string | null;
    zone: string | null;
    status: string | null;
  } | null;
  last_action_note?: {
    action_type: string | null;
    reason: string | null;
    created_at: string | null;
  } | null;
}

export type SortField = 'plate_number' | 'make' | 'apartment' | 'owner' | 'status';
export type SortDirection = 'asc' | 'desc';
