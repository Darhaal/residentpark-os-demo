// Title: Parking Map Views
// Path: src/app/admin/parking/ParkingMap.tsx
// Functionality: Structural layout for the parking map — the realistic "lanes" view
//   (aisles with a drive lane divider) and the classic auto-fill "grid" view. Each zone
//   is a section; individual tiles are rendered by the renderSpot callback owned by the
//   parent so all interaction/state stays in useParkingMap.

'use client';

import { type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ParkingSpatialCanvas, parkingSpatialSpotStyle } from '@/components/parking/ParkingSpatialCanvas';
import { floorHasSpatialLayout, type ParkingLayoutShape } from '@/config/parking-layout';
import { PARKING_LAYOUT, PARKING_ZONE_LABELS } from '@/config/parking';
import { en } from '@/localization/en';
import type { ParkingSpot } from './types';

type Side = 'left' | 'right' | 'grid' | 'spatial';
type RenderSpot = (spot: ParkingSpot, side: Side) => ReactNode;

function makeAisles(spots: ParkingSpot[], n: number): { left: ParkingSpot[]; right: ParkingSpot[] }[] {
  const out: { left: ParkingSpot[]; right: ParkingSpot[] }[] = [];
  for (let i = 0; i < spots.length; i += n * 2) {
    out.push({ left: spots.slice(i, i + n), right: spots.slice(i + n, i + n * 2) });
  }
  return out;
}

function ZoneHeading({ zone, count }: { zone: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{PARKING_ZONE_LABELS[zone] || zone}</h2>
      <Badge variant="secondary" className="tabular-nums">{count}</Badge>
      <div className="h-px bg-zinc-200 flex-1" />
    </div>
  );
}

interface ParkingMapProps {
  byZone: [string, ParkingSpot[]][];
  spots: ParkingSpot[];
  layoutShapes: ParkingLayoutShape[];
  spatialFloorKeys: string[];
  spatialRenderEnabled?: boolean;
  viewMode: 'lanes' | 'grid';
  renderSpot: RenderSpot;
}

interface FallbackParkingMapProps {
  byZone: [string, ParkingSpot[]][];
  viewMode: 'lanes' | 'grid';
  renderSpot: RenderSpot;
}

function groupSpotsByZone(spots: ParkingSpot[]): [string, ParkingSpot[]][] {
  const groups: Record<string, ParkingSpot[]> = {};
  for (const spot of spots) {
    const zone = spot.zone || 'residential';
    (groups[zone] ||= []).push(spot);
  }
  return Object.entries(groups);
}

function FallbackParkingMap({ byZone, viewMode, renderSpot }: FallbackParkingMapProps) {
  const t = en.adminParking;

  if (viewMode === 'grid') {
    return (
      <div className="space-y-8">
        {byZone.map(([zone, list]) => (
          <section key={zone}>
            <ZoneHeading zone={zone} count={list.length} />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
              {list.map(spot => renderSpot(spot, 'grid'))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {byZone.map(([zone, list]) => {
        const aisles = makeAisles(list, PARKING_LAYOUT.spotsPerAisleSide);
        return (
          <section key={zone}>
            <ZoneHeading zone={zone} count={list.length} />
            <div className="space-y-3">
              {aisles.map((aisle, ai) => (
                <div key={ai} className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 overflow-x-auto">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-3 select-none">
                    {t.aisleLabel} {ai + 1}
                  </div>
                  <div className="flex items-center min-w-fit">
                    {/* Left side — spots face the drive lane on the right */}
                    <div className="flex gap-2">
                      {aisle.left.map(spot => renderSpot(spot, 'left'))}
                    </div>

                    {/* Drive lane divider */}
                    <div className="w-10 shrink-0 mx-3 self-stretch flex flex-col items-center py-1 gap-1">
                      <div className="h-px w-5 bg-zinc-300" />
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                      <div className="flex-1 border-l-2 border-dashed border-zinc-200" />
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                      <div className="h-px w-5 bg-zinc-300" />
                    </div>

                    {/* Right side — spots face the drive lane on the left */}
                    <div className="flex gap-2">
                      {aisle.right.map(spot => renderSpot(spot, 'right'))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function ParkingMap({
  byZone,
  spots,
  layoutShapes,
  spatialFloorKeys,
  spatialRenderEnabled,
  viewMode,
  renderSpot,
}: ParkingMapProps) {
  const t = en.adminParking;
  const floorKeys = Array.from(new Set(spots.map((spot) => spot.floor || '1'))).sort();
  const floorGroups = floorKeys.map((floor) => ({
    floor,
    spots: spots.filter((spot) => (spot.floor || '1') === floor),
  }));
  const hasSpatialFloor = floorGroups.some((group) => (
    spatialFloorKeys.includes(group.floor)
    && floorHasSpatialLayout(group.spots, spatialRenderEnabled)
  ));

  if (!hasSpatialFloor) {
    return <FallbackParkingMap byZone={byZone} viewMode={viewMode} renderSpot={renderSpot} />;
  }

  return (
    <div className="space-y-8">
      {floorGroups.map((group) => {
        const spatial = spatialFloorKeys.includes(group.floor)
          && floorHasSpatialLayout(group.spots, spatialRenderEnabled);
        const floorShapes = layoutShapes.filter((shape) => shape.floor === group.floor);

        return (
          <section key={group.floor} className="space-y-4" aria-labelledby={`admin-parking-floor-${group.floor}`}>
            <div className="flex items-center gap-3">
              <h2 id={`admin-parking-floor-${group.floor}`} className="text-sm font-semibold text-foreground">
                {group.floor === '0' || group.floor.toLowerCase() === 'street'
                  ? t.streetFloor
                  : t.floorLabel(group.floor)}
              </h2>
              <Badge variant="secondary" className="tabular-nums">{group.spots.length}</Badge>
              <div className="h-px flex-1 bg-border" aria-hidden="true" />
            </div>

            {spatial ? (
              <ParkingSpatialCanvas floor={group.floor} spots={group.spots} shapes={floorShapes}>
                {group.spots.map((spot) => (
                  <div key={spot.id} className="absolute z-10" style={parkingSpatialSpotStyle(spot)}>
                    {renderSpot(spot, 'spatial')}
                  </div>
                ))}
              </ParkingSpatialCanvas>
            ) : (
              <FallbackParkingMap
                byZone={groupSpotsByZone(group.spots)}
                viewMode={viewMode}
                renderSpot={renderSpot}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
