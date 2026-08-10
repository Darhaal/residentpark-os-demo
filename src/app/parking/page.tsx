// Title: Resident Parking Page
// Path: src/app/parking/page.tsx
// Functionality: Loads approved resident parking data and renders the garage workspace or restricted account state.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/components/TopNav';
import { ResidentAccountStates } from '@/components/resident/ResidentAccountStates';
import type { ResidentMapSpot } from '@/components/resident/ResidentParkingMap';
import type { ResidentParkingPassSpot } from '@/components/resident/ResidentParkingPass';
import type { ResidentVehicle } from '@/components/resident/ResidentVehicleList';
import { ResidentParkingWorkspace } from './ResidentParkingWorkspace';
import { ACCOUNT_STATUS, VEHICLE_APPROVAL_STATUS, isAdminRole } from '@/config/domain';
import { ROUTES } from '@/config/routes';
import { en } from '@/localization/en';
import { logRequestError, logRequestWarn } from '@/lib/request-logger';
import type { ParkingLayoutShape } from '@/config/parking-layout';

interface ResidentSpot {
  id: string;
  spot_number: string;
  floor: string | null;
  zone: string | null;
  status: string;
}

export default async function ResidentParkingPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect(ROUTES.login);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name, email, is_apartment_manager, approval_status, apartment_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    await logRequestError('Failed to load profile on parking page', profileError, { userId: user.id });
  }

  let apartmentNumber: string | null = null;
  if (profile?.apartment_id) {
    const { data: aptData } = await supabase
      .from('apartments')
      .select('apartment_number')
      .eq('id', profile.apartment_id)
      .single();
    if (aptData) apartmentNumber = aptData.apartment_number;
  }

  const isMissingProfile = !!profileError || !profile;
  const isPendingApproval = profile?.approval_status === ACCOUNT_STATUS.pendingApproval;
  const isSuspended = profile?.approval_status === ACCOUNT_STATUS.suspended;
  const isRejected = profile?.approval_status === ACCOUNT_STATUS.rejected;
  const isApproved = profile?.approval_status === ACCOUNT_STATUS.approved;

  let vehicles: ResidentVehicle[] = [];
  let parkingSpots: ResidentSpot[] = [];
  let residentMapSpots: ResidentMapSpot[] = [];
  let layoutShapes: ParkingLayoutShape[] = [];

  if (profile?.apartment_id && isApproved) {
    const [vehRes, spotRes, mapRes, layoutRes] = await Promise.all([
      supabase
        .from('vehicles')
        .select('*')
        .eq('apartment_id', profile.apartment_id)
        .neq('approval_status', VEHICLE_APPROVAL_STATUS.archived),
      supabase
        .from('parking_spots')
        .select('id, spot_number, floor, zone, status')
        .eq('assigned_apartment_id', profile.apartment_id),
      supabase.rpc('get_resident_parking_map'),
      supabase
        .from('parking_layout_shapes')
        .select('id, floor, kind, x, y, w, h, rotation, label'),
    ]);

    if (vehRes.error) await logRequestError('Failed to load vehicles on parking page', vehRes.error, { userId: user.id });
    if (spotRes.error) await logRequestError('Failed to load spots on parking page', spotRes.error, { userId: user.id });
    if (mapRes.error) await logRequestWarn('Resident map unavailable on parking page', { userId: user.id, error: mapRes.error.message });
    if (layoutRes.error) await logRequestWarn('Resident parking layout unavailable', { userId: user.id, error: layoutRes.error.message });

    if (vehRes.data) vehicles = vehRes.data as ResidentVehicle[];
    if (spotRes.data) parkingSpots = spotRes.data as ResidentSpot[];
    if (mapRes.data) residentMapSpots = mapRes.data as ResidentMapSpot[];
    if (layoutRes.data) layoutShapes = layoutRes.data as ParkingLayoutShape[];
  }

  const primarySpot: ResidentParkingPassSpot | null = parkingSpots[0]
    ? { spot_number: parkingSpots[0].spot_number, floor: parkingSpots[0].floor, zone: parkingSpots[0].zone }
    : null;

  const displayRole = (profile?.is_apartment_manager || isAdminRole(profile?.role))
    ? en.residentDashboard.primaryTenant
    : en.residentDashboard.residentRole;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 font-sans text-foreground selection:bg-primary/20">
      <TopNav currentUser={profile} />

      {!isApproved ? (
        <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
          <ResidentAccountStates
            isMissingProfile={isMissingProfile}
            isPendingApproval={isPendingApproval}
            isSuspended={isSuspended}
            isRejected={isRejected}
          />
        </main>
      ) : (
        <ResidentParkingWorkspace
          spots={residentMapSpots}
          layoutShapes={layoutShapes}
          apartmentNumber={apartmentNumber}
          fullName={profile?.full_name ?? null}
          displayRole={displayRole}
          primarySpot={primarySpot}
          vehicles={vehicles}
        />
      )}
    </div>
  );
}
