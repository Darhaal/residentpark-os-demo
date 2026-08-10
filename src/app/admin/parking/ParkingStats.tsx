// Title: Parking Stats
// Path: src/app/admin/parking/ParkingStats.tsx
// Functionality: Stat-card row plus the occupancy progress bar for the selected floors.

'use client';

import { StatCard } from '@/components/ui/stat-card';
import { en } from '@/localization/en';
import type { ParkingStats as ParkingStatsData } from './types';

export function ParkingStats({ stats }: { stats: ParkingStatsData }) {
  const t = en.adminParking;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label={t.statTotal}     value={stats.total} />
        <StatCard label={t.statAvailable} value={stats.available} tone="success" />
        <StatCard label={t.statOccupied}  value={stats.occupied} />
        <StatCard label={t.statBlocked}   value={stats.blocked} tone="destructive" />
        <StatCard label={t.statConflicts} value={stats.conflict} tone="warning" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-zinc-200 overflow-hidden">
          <div className="h-full bg-zinc-900 rounded-full transition-all" style={{ width: `${stats.occupancy}%` }} />
        </div>
        <span className="text-xs font-bold text-zinc-600 tabular-nums">{t.occupancyLabel(stats.occupancy)}</span>
      </div>
    </>
  );
}
