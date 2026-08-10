// Title: Profile Page
// Path: src/app/profile/page.tsx
// Functionality: Next.js route page for profile workflows and screen composition.

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { TopNav } from '@/components/TopNav';
import { ProfileClient } from './ProfileClient';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.login);

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, role, approval_status')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <TopNav currentUser={profile} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <ProfileClient
          email={user.email ?? ''}
          fullName={profile?.full_name ?? ''}
          phone={profile?.phone ?? ''}
        />
      </main>
    </div>
  );
}
