// Title: Parking Spatial Canvas
// Path: src/components/parking/ParkingSpatialCanvas.tsx
// Functionality: Renders shared garage shapes and positioned spot content on a stable canvas.

import type { CSSProperties, ReactNode } from 'react';
import {
  PARKING_SPATIAL_LAYOUT,
  parkingCanvasSize,
  type ParkingLayoutShape,
  type ParkingPosition,
} from '@/config/parking-layout';

interface ParkingSpatialCanvasProps {
  floor: string;
  spots: ParkingPosition[];
  shapes: ParkingLayoutShape[];
  children: ReactNode;
}

const shapeClassName: Record<ParkingLayoutShape['kind'], string> = {
  wall: 'bg-foreground/70',
  zone: 'border border-info/30 bg-info/5 text-info',
  lane: 'border border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground',
  label: 'flex items-center text-xs font-semibold text-muted-foreground',
};

function shapeStyle(shape: ParkingLayoutShape): CSSProperties {
  return {
    left: shape.x,
    top: shape.y,
    width: shape.w,
    height: shape.h,
    transform: `rotate(${shape.rotation}deg)`,
    transformOrigin: 'center',
  };
}

export function parkingSpatialSpotStyle(spot: ParkingPosition): CSSProperties {
  return {
    left: spot.pos_x ?? 0,
    top: spot.pos_y ?? 0,
    width: PARKING_SPATIAL_LAYOUT.spotWidth,
    height: PARKING_SPATIAL_LAYOUT.spotHeight,
    transform: `rotate(${spot.rotation ?? 0}deg)`,
    transformOrigin: 'center',
  };
}

export function ParkingSpatialCanvas({ floor, spots, shapes, children }: ParkingSpatialCanvasProps) {
  const size = parkingCanvasSize(spots, shapes);

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card shadow-sm">
      <div
        className="relative bg-muted/20"
        data-parking-layout="spatial"
        data-parking-floor={floor}
        style={{ width: size.width, height: size.height }}
      >
        {shapes.map((shape) => (
          <div
            key={shape.id}
            aria-hidden="true"
            className={`absolute overflow-hidden rounded-sm p-2 ${shapeClassName[shape.kind]}`}
            data-layout-shape={shape.kind}
            style={shapeStyle(shape)}
          >
            {shape.label}
          </div>
        ))}
        {children}
      </div>
    </div>
  );
}
