// Title: Parking Layout Configuration
// Path: src/config/parking-layout.ts
// Functionality: Shared spatial-layout release flag, contracts, limits, and canvas sizing rules.

export const PARKING_LAYOUT_LIMITS = {
  coordinateMin: 0,
  coordinateMax: 5000,
  dimensionMin: 1,
  dimensionMax: 5000,
  floorMaxLength: 64,
  labelMaxLength: 160,
} as const;

export const PARKING_SPATIAL_LAYOUT = {
  spatialRenderEnabled: false,
  gridSize: 20,
  canvasPadding: 24,
  spotWidth: 112,
  spotHeight: 112,
  minCanvasWidth: 720,
  minCanvasHeight: 420,
} as const;

export const PARKING_LAYOUT_SHAPE_KINDS = ['wall', 'zone', 'lane', 'label'] as const;

export type ParkingLayoutShapeKind = (typeof PARKING_LAYOUT_SHAPE_KINDS)[number];

export interface ParkingLayoutShape {
  id: string;
  floor: string;
  kind: ParkingLayoutShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  label: string | null;
}

export interface ParkingPosition {
  pos_x: number | null;
  pos_y: number | null;
  rotation: number | null;
}

export function hasParkingPosition(spot: ParkingPosition): spot is ParkingPosition & { pos_x: number; pos_y: number } {
  return Number.isInteger(spot.pos_x) && Number.isInteger(spot.pos_y);
}

export function hasCompleteParkingCoordinates(spots: ParkingPosition[]): boolean {
  return spots.length > 0 && spots.every(hasParkingPosition);
}

export function floorHasSpatialLayout(
  spots: ParkingPosition[],
  spatialRenderEnabled: boolean = PARKING_SPATIAL_LAYOUT.spatialRenderEnabled,
): boolean {
  return spatialRenderEnabled && hasCompleteParkingCoordinates(spots);
}

export function parkingCanvasSize(spots: ParkingPosition[], shapes: ParkingLayoutShape[]) {
  const { canvasPadding, minCanvasHeight, minCanvasWidth, spotHeight, spotWidth } = PARKING_SPATIAL_LAYOUT;
  const spotRight = spots.reduce((max, spot) => (
    hasParkingPosition(spot) ? Math.max(max, spot.pos_x + spotWidth) : max
  ), 0);
  const spotBottom = spots.reduce((max, spot) => (
    hasParkingPosition(spot) ? Math.max(max, spot.pos_y + spotHeight) : max
  ), 0);
  const shapeRight = shapes.reduce((max, shape) => Math.max(max, shape.x + shape.w), 0);
  const shapeBottom = shapes.reduce((max, shape) => Math.max(max, shape.y + shape.h), 0);

  return {
    width: Math.max(minCanvasWidth, spotRight + canvasPadding, shapeRight + canvasPadding),
    height: Math.max(minCanvasHeight, spotBottom + canvasPadding, shapeBottom + canvasPadding),
  };
}
