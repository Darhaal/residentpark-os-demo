// Title: Resident Parking Workspace
// Path: src/app/parking/ResidentParkingWorkspace.tsx
// Functionality: Server-composed resident garage layout with mobile context, interactive map, and desktop sidebar.

import { ResidentParkingMap, type ResidentMapSpot } from '@/components/resident/ResidentParkingMap';
import type { ResidentParkingPassSpot } from '@/components/resident/ResidentParkingPass';
import type { ResidentVehicle } from '@/components/resident/ResidentVehicleList';
import type { ParkingLayoutShape } from '@/config/parking-layout';
import { ResidentParkingMobileBar } from './ResidentParkingMobileBar';
import { ResidentParkingSidebar } from './ResidentParkingSidebar';

export interface ResidentParkingWorkspaceProps {
  spots: ResidentMapSpot[];
  layoutShapes: ParkingLayoutShape[];
  apartmentNumber: string | null;
  fullName: string | null;
  displayRole: string;
  primarySpot: ResidentParkingPassSpot | null;
  vehicles: ResidentVehicle[];
}

export function ResidentParkingWorkspace({ spots, layoutShapes, apartmentNumber, fullName, displayRole, primarySpot, vehicles }: ResidentParkingWorkspaceProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <ResidentParkingMobileBar primarySpot={primarySpot} />
      {/* Sidebar renders before the map so it sits on the left on desktop (tester request). */}
      <ResidentParkingSidebar apartmentNumber={apartmentNumber} fullName={fullName} displayRole={displayRole} primarySpot={primarySpot} vehicles={vehicles} />
      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <ResidentParkingMap spots={spots} layoutShapes={layoutShapes} apartmentNumber={apartmentNumber} />
      </main>
    </div>
  );
}
