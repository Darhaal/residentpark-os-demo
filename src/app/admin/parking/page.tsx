// Title: Visual Parking Map
// Path: src/app/admin/parking/page.tsx
// Functionality: Server-loaded wrapper for the parking map.

import { Map as MapIcon } from 'lucide-react';
import { PageErrorState, PageShell } from '@/components/layout/PageShell';
import { loadParkingMapStateAction } from '@/actions/loaders';
import { en } from '@/localization/en';
import type { ParkingLayoutShape } from '@/config/parking-layout';
import { ParkingClient, type ParkingSpot, type Vehicle } from './ParkingClient';

export default async function ParkingManagerPage() {
  const todayStr = new Date().toISOString().split('T')[0];
  const res = await loadParkingMapStateAction(todayStr);

  const t = en.adminParking;

  if (!res.success) {
    return <PageErrorState navTitle={t.navTitle} icon={MapIcon} title={t.unavailableTitle} description={res.error || t.unavailableDescription} />;
  }

  const state = res.state as { spots: ParkingSpot[]; unassigned_pool: Vehicle[]; layout_shapes: ParkingLayoutShape[] };

  return (
    <PageShell title={t.navTitle} currentUser={res.currentUser}>
      <ParkingClient
        initialDate={todayStr}
        initialSpots={state.spots}
        initialPool={state.unassigned_pool || []}
        initialLayoutShapes={state.layout_shapes || []}
      />
    </PageShell>
  );
}
