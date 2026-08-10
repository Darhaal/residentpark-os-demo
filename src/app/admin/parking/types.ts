// Title: Types
// Path: src/app/admin/parking/types.ts
// Functionality: Shared TypeScript types for parking screens, actions, and component contracts.

// Shared types for the admin Parking Map client and its extracted subcomponents.

export interface Vehicle {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  color: string | null;
  year?: number | null;
  owner_id?: string | null;
  apartment_id: string;
  approval_status?: string | null;
  apartments?: { apartment_number: string | null } | null;
  profiles?: { full_name: string | null } | null;
}

export interface ParkingSpot {
  id: string;
  spot_number: string;
  zone: string | null;
  floor: string | null;
  status: string;
  type: string | null;
  assigned_apartment_id: string | null;
  assigned_vehicle_id: string | null;
  pos_x: number | null;
  pos_y: number | null;
  rotation: number | null;
  apartments?: { apartment_number: string | null } | null;
  vehicles?: Vehicle | null;
}

// Drawer interaction mode. `null` shows the action menu.
export type SpotMode = null | 'assign' | 'move' | 'block' | 'revoke' | 'status';

export interface ParkingClientProps {
  initialDate: string;
  initialSpots: ParkingSpot[];
  initialPool: Vehicle[];
  initialLayoutShapes: import('@/config/parking-layout').ParkingLayoutShape[];
}

export interface ParkingStats {
  total: number;
  available: number;
  occupied: number;
  blocked: number;
  conflict: number;
  occupancy: number;
}

export interface DragPayload {
  vehicleId: string;
  plate: string;
  apartment_id: string;
  fromSpotId: string | null;
}
