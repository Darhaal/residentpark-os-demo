// Title: Resident Parking Grid
// Path: src/components/resident/ResidentParkingGrid.tsx
// Functionality: Renders the privacy-safe grid and the release-flagged spatial floor branch.

import { ParkingSpatialCanvas, parkingSpatialSpotStyle } from '@/components/parking/ParkingSpatialCanvas';
import { floorHasSpatialLayout, type ParkingLayoutShape } from '@/config/parking-layout';
import type { ResidentMapSpot, ResidentParkingFloor } from './resident-parking-map-types';
import { ResidentParkingSpotTile } from './ResidentParkingSpotTile';

interface ResidentParkingGridProps {
  floors: ResidentParkingFloor[];
  layoutShapes: ParkingLayoutShape[];
  onReportIssue: (spot: ResidentMapSpot) => void;
  spatialRenderEnabled?: boolean;
}

function ResidentParkingFloorLayout({
  floor,
  layoutShapes,
  onReportIssue,
  spatialRenderEnabled,
}: {
  floor: ResidentParkingFloor;
  layoutShapes: ParkingLayoutShape[];
  onReportIssue: (spot: ResidentMapSpot) => void;
  spatialRenderEnabled?: boolean;
}) {
  const spots = floor.zones.flatMap((zone) => zone.spots);

  if (floorHasSpatialLayout(spots, spatialRenderEnabled)) {
    return (
      <ParkingSpatialCanvas
        floor={floor.key}
        spots={spots}
        shapes={layoutShapes.filter((shape) => shape.floor === floor.key)}
      >
        {spots.map((spot) => (
          <div key={spot.id} className="absolute z-10" style={parkingSpatialSpotStyle(spot)}>
            <ResidentParkingSpotTile spot={spot} onReportIssue={onReportIssue} className="h-full" />
          </div>
        ))}
      </ParkingSpatialCanvas>
    );
  }

  return floor.zones.map((zone) => (
    <div key={`${floor.key}-${zone.key}`} className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground">{zone.label}</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 rounded-md border border-border bg-muted/30 p-3">
        {zone.spots.map((spot) => (
          <ResidentParkingSpotTile key={spot.id} spot={spot} onReportIssue={onReportIssue} />
        ))}
      </div>
    </div>
  ));
}

export function ResidentParkingGrid({ floors, layoutShapes, onReportIssue, spatialRenderEnabled }: ResidentParkingGridProps) {
  return (
    <div className="space-y-7 p-4 sm:p-6">
      {floors.map((floor) => (
        <section key={floor.key} className="space-y-4" aria-labelledby={`parking-floor-${floor.key}`}>
          <div className="flex items-center gap-3">
            <h2 id={`parking-floor-${floor.key}`} className="text-xs font-semibold text-muted-foreground">{floor.label}</h2>
            <div className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>

          <ResidentParkingFloorLayout
            floor={floor}
            layoutShapes={layoutShapes}
            onReportIssue={onReportIssue}
            spatialRenderEnabled={spatialRenderEnabled}
          />
        </section>
      ))}
    </div>
  );
}
