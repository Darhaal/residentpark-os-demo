// Title: Parking Filters
// Path: src/app/admin/parking/ParkingFilters.tsx
// Functionality: Search box, zone/status dropdowns and the multi-select floor tabs for
//   the parking map. Presentational: all values and setters come from useParkingMap.

'use client';

import { type MouseEvent as ReactMouseEvent } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PARKING_STATUS_OPTIONS, PARKING_ZONE_LABELS } from '@/config/parking';
import { FILTER_ALL } from '@/config/domain';
import { en } from '@/localization/en';

interface ParkingFiltersProps {
  search: string;
  setSearch: (value: string) => void;
  zoneFilter: string;
  setZoneFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  zonesOnFloor: string[];
  floors: string[];
  selectedFloors: string[];
  setSelectedFloors: (floors: string[]) => void;
  setFloorAnchor: (floor: string | null) => void;
  allFloorsSelected: boolean;
  onFloorTabClick: (floor: string, event: ReactMouseEvent) => void;
}

export function ParkingFilters({
  search,
  setSearch,
  zoneFilter,
  setZoneFilter,
  statusFilter,
  setStatusFilter,
  zonesOnFloor,
  floors,
  selectedFloors,
  setSelectedFloors,
  setFloorAnchor,
  allFloorsSelected,
  onFloorTabClick,
}: ParkingFiltersProps) {
  const t = en.adminParking;

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            aria-label={t.searchAriaLabel}
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white"
          />
        </div>
        <select aria-label={t.filterZoneAriaLabel} value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} className="h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm font-medium shadow-sm">
          <option value={FILTER_ALL}>{t.allZones}</option>
          {zonesOnFloor.map(z => <option key={z} value={z}>{PARKING_ZONE_LABELS[z] || z}</option>)}
        </select>
        <select aria-label={t.filterStatusAriaLabel} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm font-medium shadow-sm">
          <option value={FILTER_ALL}>{t.allStatuses}</option>
          {PARKING_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      {floors.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex gap-1 border-b border-zinc-200 overflow-x-auto" role="tablist" aria-label={t.floorsAriaLabel}>
            <button
              type="button"
              role="tab"
              aria-selected={allFloorsSelected}
              onClick={() => { setSelectedFloors(floors); setFloorAnchor(null); }}
              className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition-colors -mb-px border-b-2 ${
                allFloorsSelected ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {t.allFloors}
            </button>
            {floors.map(floor => {
              const active = !allFloorsSelected && selectedFloors.includes(floor);
              return (
                <button
                  key={floor}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={(e) => onFloorTabClick(floor, e)}
                  className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition-colors -mb-px border-b-2 ${
                    active ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  {floor === '0' || floor.toLowerCase() === 'street' ? t.streetFloor : t.floorLabel(floor)}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-zinc-400">{t.floorMultiHint}</p>
        </div>
      )}
    </>
  );
}
