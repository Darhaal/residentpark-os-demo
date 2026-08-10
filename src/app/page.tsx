// Title: Resident Dashboard
// Path: src/app/page.tsx
// Functionality: Server-loaded resident dashboard — account overview, parking
//   allocation, and registered vehicles in a clean card layout.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/components/TopNav';
import { ResidentAccountStates } from '@/components/resident/ResidentAccountStates';
import { ResidentDashboard } from '@/components/resident/ResidentDashboard';

import { en } from '@/localization/en';
import { ACCOUNT_STATUS, VEHICLE_APPROVAL_STATUS, isAdminRole } from '@/config/domain';
import { ROUTES } from '@/config/routes';
import { logRequestError, logRequestWarn } from '@/lib/request-logger';

interface ResidentVehicle {
  id: string;
  plate_number: string;
  make: string;
  model: string | null;
  color: string | null;
  year: number | null;
  approval_status: string;
}

interface ResidentSpot {
  id: string;
  spot_number: string;
  floor: string | null;
  zone: string | null;
  status: string;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect(ROUTES.login);

  // 1. SAFE QUERY: Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name, email, is_apartment_manager, approval_status, apartment_id')
    .eq('id', user.id)
    .single();

  // PGRST116 ("no rows") is the expected missing-profile state handled below — don't
  // log it as an error. Only surface genuinely unexpected profile-load failures.
  if (profileError && profileError.code !== 'PGRST116') {
    await logRequestError('Failed to load user profile on dashboard', profileError, { userId: user.id });
  }

  // 2. SAFE QUERY: Fetch apartment details
  let apartmentNumber = null;
  if (profile?.apartment_id) {
    const { data: aptData } = await supabase
      .from('apartments')
      .select('apartment_number')
      .eq('id', profile.apartment_id)
      .single();

    if (aptData) apartmentNumber = aptData.apartment_number;
  }

  // Staff admins who are not residents (no apartment) belong in the admin console,
  // not the resident dashboard. Only approved admins are sent there — a deactivated
  // admin would otherwise bounce between here and the admin layout guard.
  if (profile && isAdminRole(profile.role) && profile.approval_status === ACCOUNT_STATUS.approved && !profile.apartment_id) {
    redirect(ROUTES.admin.root);
  }

  // Treat ANY profile fetch failure (not just PGRST116 "no rows") as missing profile.
  // "Cannot coerce the result to a single JSON object" and similar PostgREST/PG errors
  // should all land the user on the "Sign out and try again" screen, not a blank page.
  const isMissingProfile = !!profileError || !profile;
  const isPendingApproval = profile?.approval_status === ACCOUNT_STATUS.pendingApproval;
  const isSuspended = profile?.approval_status === ACCOUNT_STATUS.suspended;
  const isRejected = profile?.approval_status === ACCOUNT_STATUS.rejected;
  const isApproved = profile?.approval_status === ACCOUNT_STATUS.approved;

  // 3. Fetch Vehicles and Parking — approved accounts only (RLS enforces the same).
  let vehicles: ResidentVehicle[] = [];
  let parkingSpots: ResidentSpot[] = [];
  let residentPortalNotice = '';

  if (profile?.apartment_id && isApproved) {
    const [vehRes, spotRes, settingsRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('apartment_id', profile.apartment_id).neq('approval_status', VEHICLE_APPROVAL_STATUS.archived),
      supabase.from('parking_spots').select('*').eq('assigned_apartment_id', profile.apartment_id),
      supabase.from('building_settings').select('resident_portal_notice').limit(1).maybeSingle(),
    ]);

    if (vehRes.error) await logRequestError('Failed to load resident vehicles', vehRes.error, { userId: user.id });
    if (spotRes.error) await logRequestError('Failed to load resident parking spots', spotRes.error, { userId: user.id });
    if (settingsRes.error) await logRequestWarn('Resident portal notice unavailable', { userId: user.id, error: settingsRes.error.message });

    if (vehRes.data) vehicles = vehRes.data as ResidentVehicle[];
    if (spotRes.data) parkingSpots = spotRes.data as ResidentSpot[];
    residentPortalNotice = settingsRes.data?.resident_portal_notice?.trim() || '';
  }

  const primarySpot = parkingSpots[0];
  const firstName = profile?.full_name?.split(' ')[0] || 'Resident';
  const displayRole = (profile?.is_apartment_manager || isAdminRole(profile?.role))
    ? en.residentDashboard.primaryTenant
    : en.residentDashboard.residentRole;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 font-sans selection:bg-muted">
      <TopNav currentUser={profile} />

      <main className="flex h-full flex-1 flex-col overflow-y-auto pb-16 sm:pb-0">
        <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
          <ResidentAccountStates
            isMissingProfile={isMissingProfile}
            isPendingApproval={isPendingApproval}
            isSuspended={isSuspended}
            isRejected={isRejected}
          />

          {profile && isApproved && (
            <ResidentDashboard
              firstName={firstName}
              fullName={profile.full_name}
              apartmentNumber={apartmentNumber}
              displayRole={displayRole}
              primarySpot={primarySpot}
              vehicles={vehicles}
              hasApartment={Boolean(profile.apartment_id)}
              residentPortalNotice={residentPortalNotice}
            />
          )}
        </div>
      </main>
    </div>
  );
}
