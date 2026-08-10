// Title: Unassigned Vehicle Pool
// Path: src/app/admin/parking/UnassignedPool.tsx
// Functionality: Sticky bottom strip of approved vehicles with no spot. Each chip is a
//   drag source for assigning a vehicle onto an available spot on the map.

'use client';

import { Building, Car } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { VehicleTopDownIcon } from '@/components/parking/VehicleTopDownIcon';
import { en } from '@/localization/en';
import type { Vehicle } from './types';

interface UnassignedPoolProps {
  pool: Vehicle[];
  onDragStart: (vehicle: Vehicle) => void;
  onDragEnd: () => void;
}

export function UnassignedPool({ pool, onDragStart, onDragEnd }: UnassignedPoolProps) {
  const t = en.adminParking;

  return (
    <div className="border-t border-zinc-200 bg-white px-4 sm:px-8 py-3 shrink-0">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Badge variant="success" className="shrink-0 gap-1"><Car className="h-3 w-3" /> {t.unassignedBadge(pool.length)}</Badge>
          <span className="text-xs text-zinc-500">{t.poolHint}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {pool.map(vehicle => (
            <div
              key={vehicle.id}
              draggable
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(vehicle); }}
              onDragEnd={onDragEnd}
              className="shrink-0 border border-zinc-200 rounded-xl px-3 py-2.5 flex items-center gap-3 cursor-grab active:cursor-grabbing bg-white hover:border-zinc-400 hover:shadow-md transition-all select-none"
            >
              <VehicleTopDownIcon color={vehicle.color} make={vehicle.make} model={vehicle.model} className="h-10 w-7 shrink-0" />
              <div>
                <div className="font-mono font-bold text-sm text-zinc-900">{vehicle.plate_number}</div>
                <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Building className="h-2.5 w-2.5" /> {t.unitPrefix} {vehicle.apartments?.apartment_number || '-'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
