// Title: Identity Directory Client
// Path: src/app/admin/users/UsersClient.tsx
// Functionality: Composition root for the admin identity directory. State and mutations
//   live in useUsersDirectory; this file wires the header, filters, table, bulk bar and
//   the edit / suspend / create-account modals together.

'use client';

import { Button } from '@/components/ui/button';
import { Building2, CheckSquare, UserPlus, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import { ACCOUNT_STATUS } from '@/config/domain';
import { en as locale } from '@/localization/en';
import { roleChangeIntent } from './users-types';
import { UsersBulkBar } from './UsersBulkBar';
import { UsersBulkModal } from './UsersBulkModal';
import { UserEditModal } from './UserEditModal';
import { SuspendConfirmModal } from './SuspendConfirmModal';
import { CreateAccountModal } from './CreateAccountModal';
import { UsersFilters } from './UsersFilters';
import { UsersTable } from './UsersTable';
import { useUsersDirectory, type UsersClientProps } from './use-users-directory';

export type { Profile, ApartmentOption } from './users-types';

const messages = locale.adminUsers;

export function UsersClient(props: UsersClientProps) {
  const m = useUsersDirectory(props);

  return (
    <>
      <FeedbackToasts successMsg={m.successMsg} errorMsg={m.errorMsg} onClear={m.clearFeedback} />

      <main className="flex-1 overflow-y-auto bg-muted/30 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <header className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
                <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{messages.pageTitle}</h1>
                <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{messages.pageDescription}</p>
              </div>
            </div>
            <Button onClick={() => m.setCreateAccountVisible(true)} className="w-full md:w-auto">
              <UserPlus className="size-4" aria-hidden="true" /> {messages.createAccount}
            </Button>
          </header>

          <section className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border shadow-sm sm:grid-cols-3" aria-label={messages.summaryAria}>
            <DirectoryMetric icon={Users} label={messages.summary.loaded} value={m.profiles.length} />
            <DirectoryMetric icon={CheckSquare} label={messages.summary.selected} value={m.selectedIds.size} />
            <DirectoryMetric icon={Building2} label={messages.summary.units} value={m.allApartments.length} />
          </section>

          <UsersFilters
            searchQuery={m.searchQuery}
            setSearchQuery={m.setSearchQuery}
            filterRole={m.filterRole}
            setFilterRole={m.setFilterRole}
            filterStatus={m.filterStatus}
            setFilterStatus={m.setFilterStatus}
          />

          <UsersTable
            profiles={m.profiles}
            selectedIds={m.selectedIds}
            toggleAll={m.toggleAll}
            toggleRow={m.toggleRow}
            onEdit={m.openEditModal}
            hasMore={m.hasMore}
            isLoadingMore={m.isLoadingMore}
            onLoadMore={() => m.fetchUsers(true)}
          />
        </div>
      </main>

      {m.selectedIds.size > 0 && !m.bulkIntent && (
        <UsersBulkBar
          count={m.selectedIds.size}
          onApprove={() => m.setBulkIntent(ACCOUNT_STATUS.approved)}
          onSuspend={() => m.setBulkIntent(ACCOUNT_STATUS.suspended)}
          onRoleChange={() => m.setBulkIntent(roleChangeIntent)}
          onClear={m.clearSelection}
        />
      )}

      {m.bulkIntent && (
        <UsersBulkModal
          intent={m.bulkIntent}
          selectedCount={m.selectedIds.size}
          bulkRole={m.bulkRole}
          setBulkRole={m.setBulkRole}
          canAssignAdminRole={props.canCreateAdmins}
          reason={m.actionReason}
          setReason={m.setActionReason}
          isSaving={m.isSaving}
          onCancel={m.clearBulkModal}
          onCommit={m.handleBulkCommit}
        />
      )}

      {m.selectedUser && !m.suspendConfirmVisible && (
        <UserEditModal
          user={m.selectedUser}
          apartments={m.allApartments}
          newRole={m.newRole}
          setNewRole={m.setNewRole}
          canAssignAdminRole={props.canCreateAdmins}
          isManager={m.isManager}
          setIsManager={m.setIsManager}
          selectedApartmentId={m.selectedApartmentId}
          setSelectedApartmentId={m.setSelectedApartmentId}
          reason={m.actionReason}
          setReason={m.setActionReason}
          confirmPassword={m.confirmPassword}
          setConfirmPassword={m.setConfirmPassword}
          isSaving={m.isSaving}
          onClose={() => m.setSelectedUser(null)}
          onToggleStatus={m.handleToggleStatus}
          onShowSuspendConfirm={() => m.setSuspendConfirmVisible(true)}
          onSave={m.handleSaveProfile}
        />
      )}

      {m.suspendConfirmVisible && m.selectedUser && (
        <SuspendConfirmModal
          email={m.selectedUser.email}
          isSaving={m.isSaving}
          onCancel={() => m.setSuspendConfirmVisible(false)}
          onConfirm={() => m.handleToggleStatus(ACCOUNT_STATUS.suspended)}
        />
      )}

      {m.createAccountVisible && (
        <CreateAccountModal
          apartments={m.allApartments}
          canCreateAdmins={props.canCreateAdmins}
          isSaving={m.isSaving}
          onCancel={() => m.setCreateAccountVisible(false)}
          onSubmit={m.handleCreateAccount}
        />
      )}
    </>
  );
}

function DirectoryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 bg-card p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
