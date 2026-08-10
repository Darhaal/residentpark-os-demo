// Title: Resident Parking Map Types
// Path: src/components/resident/resident-parking-map-types.ts
// Functionality: Shared privacy-safe spot and grouped garage view-model contracts.

export interface ResidentMapSpot {
  id: string;
  spot_number: string;
  floor: string | null;
  zone: string | null;
  status: string;
  pos_x: number | null;
  pos_y: number | null;
  rotation: number | null;
  is_own: boolean;
  is_occupied: boolean;
  plate_number: string | null;
  make: string | null;
  model: string | null;
  relocation_status: string | null;
  original_spot_number: string | null;
  temporary_spot_number: string | null;
  disruption_title: string | null;
}

export interface ResidentParkingZone {
  key: string;
  label: string;
  spots: ResidentMapSpot[];
}

export interface ResidentParkingFloor {
  key: string;
  label: string;
  zones: ResidentParkingZone[];
}
