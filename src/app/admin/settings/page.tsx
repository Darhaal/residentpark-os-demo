// Title: Account Settings (Admin)
// Path: src/app/admin/settings/page.tsx
// Functionality: Staff account settings (name, password, email) inside the admin shell.
// Replaces the retired Operational Policies page — building policies are fixed in code
// (see PD-010), so a policies screen is redundant.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { PageShell } from '@/components/layout/PageShell';
import { ProfileClient } from '@/app/profile/ProfileClient';
import { en } from '@/localization/en';

export default async function AdminAccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.login);

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, role, approval_status')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <PageShell title={en.navigation.adminTabs.settings} currentUser={profile}>
      <main className="flex-1 mx-auto w-full max-w-xl p-4 sm:p-8">
        <ProfileClient
          email={user.email ?? ''}
          fullName={profile?.full_name ?? ''}
          phone={profile?.phone ?? ''}
        />
      </main>
    </PageShell>
  );
}
