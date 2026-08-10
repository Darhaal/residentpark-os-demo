// Title: Resident Parking Map View Model
// Path: src/components/resident/resident-parking-map-utils.ts
// Functionality: Applies privacy-safe states and groups resident-visible spots by floor and zone.

import { PARKING_ZONE_LABELS, parkingSpotStateOf, type ParkingSpotState } from '@/config/parking';
import { en } from '@/localization/en';
import type { ResidentMapSpot, ResidentParkingFloor } from './resident-parking-map-types';

const messages = en.residentParkingMap;
const defaultFloor = '1';
const defaultZone = 'residential';

export function residentSpotState(spot: ResidentMapSpot): ParkingSpotState {
  if (!spot.is_own && spot.is_occupied) return 'occupied';
  return parkingSpotStateOf(spot.status);
}

export function residentZoneLabel(zone: string | null) {
  if (!zone) return messages.defaultZone;
  if (PARKING_ZONE_LABELS[zone]) return PARKING_ZONE_LABELS[zone];

  const normalized = zone.replace(/[-_]/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function buildResidentParkingFloors(spots: ResidentMapSpot[]): ResidentParkingFloor[] {
  const floorKeys = Array.from(new Set(spots.map((spot) => spot.floor || defaultFloor))).sort();

  return floorKeys.map((floorKey) => {
    const floorSpots = spots.filter((spot) => (spot.floor || defaultFloor) === floorKey);
    const zoneKeys = Array.from(new Set(floorSpots.map((spot) => spot.zone || defaultZone))).sort();

    return {
      key: floorKey,
      label: floorKey === '0' || floorKey.toLowerCase() === 'street'
        ? messages.street
        : messages.floor(floorKey),
      zones: zoneKeys.map((zoneKey) => ({
        key: zoneKey,
        label: residentZoneLabel(zoneKey),
        spots: floorSpots.filter((spot) => (spot.zone || defaultZone) === zoneKey),
      })),
    };
  });
}
