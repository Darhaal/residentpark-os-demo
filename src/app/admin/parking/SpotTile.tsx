// Title: Parking Spot Tile
// Path: src/app/admin/parking/SpotTile.tsx
// Functionality: A single parking-spot tile rendered in both the lane and grid views.
//   Presentational: derives its look from the spot status plus drag/selection flags and
//   forwards interaction to handlers owned by useParkingMap.

'use client';

import { AlertTriangle, Building, Car, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { VehicleTopDownIcon } from '@/components/parking/VehicleTopDownIcon';
import { PARKING_SPOT_STATE_UI, parkingSpotStateOf } from '@/config/parking';
import { en } from '@/localization/en';
import type { ParkingSpot } from './types';

interface SpotTileProps {
  spot: ParkingSpot;
  side?: 'left' | 'right' | 'grid' | 'spatial';
  selected: boolean;
  hasDrag: boolean;
  isOver: boolean;
  isViewingHistory: boolean;
  searchActive: boolean;
  matches: boolean;
  onOpen: (id: string) => void;
  onKeyDown: (event: React.KeyboardEvent, spotId: string) => void;
  setRef: (id: string, el: HTMLButtonElement | null) => void;
  onDragStartSpot: (spot: ParkingSpot) => void;
  onDragEnd: () => void;
  setDragOver: (id: string | null) => void;
  onDrop: (event: React.DragEvent, spot: ParkingSpot) => void;
}

export function SpotTile({
  spot,
  side = 'grid',
  selected,
  hasDrag,
  isOver,
  isViewingHistory,
  searchActive,
  matches,
  onOpen,
  onKeyDown,
  setRef,
  onDragStartSpot,
  onDragEnd,
  setDragOver,
  onDrop,
}: SpotTileProps) {
  const t = en.adminParking;
  const state = parkingSpotStateOf(spot.status);
  const ui = PARKING_SPOT_STATE_UI[state];
  const canDrop = hasDrag && state === 'available' && !isViewingHistory;
  const isDraggable = state === 'occupied' && !!spot.vehicles && !isViewingHistory;
  const dim = searchActive && !matches;
  const hit = searchActive && matches;

  return (
    <button
      ref={(el) => setRef(spot.id, el)}
      tabIndex={0}
      onClick={() => onOpen(spot.id)}
      onKeyDown={(e) => onKeyDown(e, spot.id)}
      draggable={isDraggable}
      onDragStart={(e) => { if (isDraggable) { e.dataTransfer.effectAllowed = 'move'; onDragStartSpot(spot); } }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { if (canDrop) { e.preventDefault(); setDragOver(spot.id); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Element)) setDragOver(null); }}
      onDrop={(e) => onDrop(e, spot)}
      aria-label={`Spot ${spot.spot_number}, ${ui.label}${spot.vehicles ? `, ${spot.vehicles.plate_number}` : ''}`}
      className={[
        'relative text-left rounded-xl border p-3 h-28 flex flex-col transition-all outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring/50',
        side === 'left' || side === 'right' ? 'w-28 shrink-0' : '',
        side === 'spatial' ? 'h-full w-full' : '',
        ui.tile,
        dim ? 'opacity-30' : '',
        hit ? 'ring-2 ring-ring/50' : '',
        selected ? 'ring-2 ring-zinc-900' : '',
        isOver && canDrop ? 'ring-2 ring-info/50 bg-info/10 border-info/40 scale-[1.03]' : '',
        canDrop && !isOver ? 'ring-1 ring-dashed ring-zinc-400' : '',
        isDraggable ? 'cursor-grab active:cursor-grabbing' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-zinc-500">{spot.spot_number}</span>
        {state === 'blocked'  && <Lock className="h-3.5 w-3.5 text-destructive" />}
        {state === 'conflict' && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
        {state === 'available' && !canDrop  && <span className="h-2 w-2 rounded-full bg-success" />}
        {canDrop && !isOver && <Car className="h-3.5 w-3.5 text-zinc-400 animate-pulse" />}
        {isOver             && <Car className="h-3.5 w-3.5 text-info" />}
      </div>
      {spot.vehicles ? (
        <div className="mt-auto">
          <div className="flex items-center gap-2">
            <VehicleTopDownIcon color={spot.vehicles.color} make={spot.vehicles.make} model={spot.vehicles.model} className="h-10 w-7 shrink-0" />
            <span className="font-mono text-sm font-semibold text-zinc-900 truncate">{spot.vehicles.plate_number}</span>
          </div>
          <div className="text-[11px] text-zinc-500 font-medium mt-0.5 flex items-center gap-1">
            <Building className="h-3 w-3" /> {t.unitPrefix} {spot.apartments?.apartment_number || '-'}
          </div>
        </div>
      ) : (
        <div className="mt-auto">
          {isOver
            ? <div className="text-xs font-bold text-info">{t.dropHere}</div>
            : <Badge variant={ui.badge} className="text-[10px] font-bold uppercase tracking-wider">{ui.label}</Badge>}
        </div>
      )}
    </button>
  );
}
