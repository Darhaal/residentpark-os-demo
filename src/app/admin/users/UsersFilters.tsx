// Title: Users Filters
// Path: src/app/admin/users/UsersFilters.tsx
// Functionality: Search box plus role and status dropdowns for the identity directory.

'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ACCOUNT_STATUS, FILTER_ALL, USER_ROLES } from '@/config/domain';
import { en as locale } from '@/localization/en';

const messages = locale.adminUsers;

interface UsersFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filterRole: string;
  setFilterRole: (value: string) => void;
  filterStatus: string;
  setFilterStatus: (value: string) => void;
}

export function UsersFilters({
  searchQuery,
  setSearchQuery,
  filterRole,
  setFilterRole,
  filterStatus,
  setFilterStatus,
}: UsersFiltersProps) {
  return (
    <section className="grid grid-cols-1 gap-3 rounded-md border border-border bg-card p-3 shadow-sm md:grid-cols-3">
      <div className="relative md:col-span-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="text" aria-label={messages.searchAria} placeholder={messages.searchPlaceholder} value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="h-9 bg-background pl-9 shadow-none" />
      </div>
      <select aria-label={messages.filterRoleAria} value={filterRole} onChange={event => setFilterRole(event.target.value)} className="h-9 rounded-md border border-border bg-background px-2.5 text-sm font-medium text-foreground shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
        <option value={FILTER_ALL}>{messages.filters.allRoles}</option>
        <option value={USER_ROLES.resident}>{messages.filters.residents}</option>
        <option value={USER_ROLES.admin}>{messages.filters.admins}</option>
      </select>
      <select aria-label={messages.filterStatusAria} value={filterStatus} onChange={event => setFilterStatus(event.target.value)} className="h-9 rounded-md border border-border bg-background px-2.5 text-sm font-medium text-foreground shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
        <option value={FILTER_ALL}>{messages.filters.allStatuses}</option>
        <option value={ACCOUNT_STATUS.approved}>{messages.filters.active}</option>
        <option value={ACCOUNT_STATUS.pendingApproval}>{messages.filters.pending}</option>
        <option value={ACCOUNT_STATUS.suspended}>{messages.filters.suspended}</option>
      </select>
    </section>
  );
}
