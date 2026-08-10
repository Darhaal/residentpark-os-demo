// Title: Vehicles Directory
// Path: src/app/admin/vehicles/page.tsx
// Functionality: Server-loaded wrapper for the vehicle directory.

import { Car } from 'lucide-react';
import { PageErrorState, PageShell } from '@/components/layout/PageShell';
import { loadVehiclesDirectoryAction } from '@/actions/loaders';
import { type ExtendedApartmentObj } from '@/components/shared/VehicleForm';
import { en as locale } from '@/localization/en';
import { FILTER_ALL } from '@/config/domain';
import { VehiclesClient, type VehicleDirectoryVehicle } from './VehiclesClient';

export default async function VehiclesManagerPage() {
  const messages = locale.adminVehicles;
  const res = await loadVehiclesDirectoryAction(FILTER_ALL);

  if (!res.success) {
    return <PageErrorState navTitle={messages.pageTitle} icon={Car} title={messages.unavailableTitle} description={res.error || messages.unavailableDescription} />;
  }

  return (
    <PageShell title={messages.pageTitle} currentUser={res.currentUser} className="relative overflow-hidden">
      <VehiclesClient
        initialVehicles={res.vehicles as VehicleDirectoryVehicle[]}
        initialApartments={res.apartments as ExtendedApartmentObj[]}
      />
    </PageShell>
  );
}
