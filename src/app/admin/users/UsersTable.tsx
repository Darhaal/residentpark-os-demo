// Title: Users Table
// Path: src/app/admin/users/UsersTable.tsx
// Functionality: The identity directory table — select-all/row checkboxes, identity,
//   assignment, role/status badges, per-row edit action and the "load more" footer.
//   Presentational: data and handlers come from useUsersDirectory.

'use client';

import { Lock, MapPin, Smartphone, UserCog, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ACCOUNT_STATUS, USER_ROLES } from '@/config/domain';
import { approvalStatusBadgeVariant } from '@/config/status-ui';
import { en as locale } from '@/localization/en';
import type { Profile } from './users-types';

const messages = locale.adminUsers;

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={approvalStatusBadgeVariant(status)} className="text-xs font-medium">
      {messages.statusLabel(status)}
    </Badge>
  );
}

interface UsersTableProps {
  profiles: Profile[];
  selectedIds: Set<string>;
  toggleAll: () => void;
  toggleRow: (id: string) => void;
  onEdit: (user: Profile) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

export function UsersTable({
  profiles,
  selectedIds,
  toggleAll,
  toggleRow,
  onEdit,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: UsersTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm animate-in fade-in">
      <div className="overflow-x-auto">
        <table className="min-w-[820px] w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="w-12 px-4 py-3 text-center">
                <input type="checkbox" aria-label={messages.selectAllRows} checked={profiles.length > 0 && selectedIds.size === profiles.length} onChange={toggleAll} className="size-4 cursor-pointer rounded border-border accent-primary" />
              </th>
              <th className="px-4 py-3">{messages.headers.identity}</th>
              <th className="px-4 py-3">{messages.headers.assignment}</th>
              <th className="px-4 py-3">{messages.headers.levelStatus}</th>
              <th className="px-4 py-3 text-right">{messages.headers.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {profiles.map(user => (
              <tr key={user.id} className={`transition-colors ${user.approval_status === ACCOUNT_STATUS.suspended ? 'opacity-70' : ''} ${selectedIds.has(user.id) ? 'bg-muted/40' : 'hover:bg-muted/25'}`}>
                <td className="px-4 py-3 text-center">
                  <input type="checkbox" aria-label={messages.selectUser(user.full_name || user.email || messages.userFallback)} checked={selectedIds.has(user.id)} onChange={() => toggleRow(user.id)} className="size-4 cursor-pointer rounded border-border accent-primary" />
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-foreground">{user.full_name || messages.noName}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{user.email}</div>
                  {user.phone && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Smartphone className="size-3" aria-hidden="true" /> {user.phone}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {user.apartment_number ? (
                    <div className="flex w-fit items-center gap-2 rounded-md border border-border bg-muted/50 px-2 py-1 text-sm font-medium text-foreground">
                      <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" /> {messages.unitPrefix} {user.apartment_number}
                    </div>
                  ) : <span className="text-xs text-muted-foreground">{messages.unassigned}</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline" className="capitalize text-xs font-medium">{user.role}</Badge>
                    {user.is_apartment_manager && <Badge variant="success" className="text-xs font-medium">{messages.manager}</Badge>}
                  </div>
                  <StatusBadge status={user.approval_status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {user.role === USER_ROLES.superadmin ? (
                    <Lock className="ml-auto size-4 text-muted-foreground" />
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => onEdit(user)} className="bg-background font-medium">
                      <UserCog className="size-3.5" aria-hidden="true" /> {messages.settings}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    icon={Users}
                    title={messages.emptyTitle}
                    description={messages.emptyDescription}
                    className="rounded-none border-0 bg-transparent"
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="flex justify-center border-t border-border bg-muted/20 p-3">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoadingMore} className="bg-background">
            {isLoadingMore ? <><Spinner className="mr-2 size-4" /> {messages.querying}</> : messages.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}
