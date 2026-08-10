// Title: Identity Directory
// Path: src/app/admin/users/page.tsx
// Functionality: Server-loaded wrapper for the managed user registry.

import { Users } from 'lucide-react';
import { PageErrorState, PageShell } from '@/components/layout/PageShell';
import { loadUsersDirectoryAction } from '@/actions/loaders';
import { en as locale } from '@/localization/en';
import { FILTER_ALL, isSuperadminRole } from '@/config/domain';
import { PAGE_LIMITS } from '@/config/limits';
import { UsersClient, type ApartmentOption, type Profile } from './UsersClient';

type SearchParams = Record<string, string | string[] | undefined>;

const getParam = (params: SearchParams, key: string) => {
  const value = params[key];
  return Array.isArray(value) ? value[0] || '' : value || '';
};

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const messages = locale.adminUsers;
  const params = searchParams ? await searchParams : {};
  const initialFilters = {
    search: getParam(params, 'search'),
    role: getParam(params, 'role') || FILTER_ALL,
    status: getParam(params, 'status') || FILTER_ALL,
  };

  const res = await loadUsersDirectoryAction({
    limit: PAGE_LIMITS.users,
    search: initialFilters.search || null,
    roleFilter: initialFilters.role,
    statusFilter: initialFilters.status,
  });

  if (!res.success) {
    return (
      <PageErrorState
        navTitle={messages.pageTitle}
        icon={Users}
        title={messages.unavailableTitle}
        description={res.error || messages.unavailableDescription}
      />
    );
  }

  const users = (res.users || []) as unknown as Profile[];
  const apartments = (res.apartments || []) as ApartmentOption[];
  const clientKey = `${initialFilters.search}:${initialFilters.role}:${initialFilters.status}`;

  return (
    <PageShell title={messages.pageTitle} currentUser={res.currentUser} className="relative overflow-hidden pb-24">
      <UsersClient
        key={clientKey}
        initialProfiles={users}
        initialApartments={apartments}
        initialHasMore={res.hasMore}
        initialFilters={initialFilters}
        canCreateAdmins={isSuperadminRole(res.currentUser.role)}
      />
    </PageShell>
  );
}
