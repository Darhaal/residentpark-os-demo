// Title: User Edit Modal
// Path: src/app/admin/users/UserEditModal.tsx
// Functionality: Modal workflow for identity and role operations, validation, and feedback.

// Identity configuration modal: lifecycle (approve/reject/suspend/activate),
// apartment assignment, role, manager flag, and password-confirmed save.
// Presentational: all state and handlers are owned by UsersClient.

'use client';

import { Lock, Shield, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ACCOUNT_STATUS, USER_ROLES } from '@/config/domain';
import { cn } from '@/lib/utils';
import { en } from '@/localization/en';
import { ROLE_OPTIONS, type ApartmentOption, type LifecycleStatus, type Profile, type UserRole } from './users-types';

interface UserEditModalProps {
  user: Profile;
  apartments: ApartmentOption[];
  newRole: UserRole;
  setNewRole: (role: UserRole) => void;
  canAssignAdminRole: boolean;
  isManager: boolean;
  setIsManager: (value: boolean) => void;
  selectedApartmentId: string;
  setSelectedApartmentId: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  isSaving: boolean;
  onClose: () => void;
  onToggleStatus: (status: LifecycleStatus) => void;
  onShowSuspendConfirm: () => void;
  onSave: () => void;
}

const messages = en.adminUsers;

function getRoleLabel(role: UserRole) {
  return role === USER_ROLES.admin ? messages.adminRole : messages.residentRole;
}

export function UserEditModal({
  user,
  apartments,
  newRole,
  setNewRole,
  canAssignAdminRole,
  isManager,
  setIsManager,
  selectedApartmentId,
  setSelectedApartmentId,
  reason,
  setReason,
  confirmPassword,
  setConfirmPassword,
  isSaving,
  onClose,
  onToggleStatus,
  onShowSuspendConfirm,
  onSave,
}: UserEditModalProps) {
  // Only a superadmin may grant the admin role; a regular admin sees resident-scoped
  // controls only (functional guards already hold — this hides the promotion affordance).
  const roleOptions = canAssignAdminRole
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter(roleOption => roleOption !== USER_ROLES.admin);

  return (
    <Modal onClose={onClose} label={messages.identityConfigTitle} overlayClassName="z-50" className="max-w-2xl">
      <div className="flex max-h-[90vh] w-full animate-in flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-foreground">{messages.identityConfigTitle}</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={en.common.closeDialog}
            className="size-8 shrink-0 rounded-md border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          <section className="rounded-md border border-border bg-muted/20 p-4">
            <Label htmlFor="identity-reason" className="mb-3 block text-xs font-medium text-muted-foreground">
              {messages.lifecycleControl}
            </Label>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <Input
                id="identity-reason"
                value={reason}
                onChange={event => setReason(event.target.value)}
                placeholder={messages.operationalReasonPlaceholder}
                autoComplete="off"
                className="h-10 bg-background"
              />
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                {user.approval_status === ACCOUNT_STATUS.pendingApproval ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onToggleStatus(ACCOUNT_STATUS.approved)}
                      disabled={!reason.trim() || isSaving}
                      className="h-10 min-w-24 border-success/30 text-success hover:bg-success/10"
                    >
                      {messages.approve}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => onToggleStatus(ACCOUNT_STATUS.rejected)}
                      disabled={!reason.trim() || isSaving}
                      className="h-10 min-w-24"
                    >
                      {messages.reject}
                    </Button>
                  </>
                ) : user.approval_status === ACCOUNT_STATUS.suspended ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onToggleStatus(ACCOUNT_STATUS.approved)}
                    disabled={!reason.trim() || isSaving}
                    className="h-10 min-w-28 border-success/30 text-success hover:bg-success/10"
                  >
                    {messages.activate}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={onShowSuspendConfirm}
                    disabled={!reason.trim()}
                    className="h-10 min-w-28"
                  >
                    {messages.suspend}
                  </Button>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <Label htmlFor="identity-apartment" className="text-xs font-medium text-muted-foreground">
              {messages.unitAuthorization}
            </Label>
            <select
              id="identity-apartment"
              value={selectedApartmentId}
              onChange={event => setSelectedApartmentId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="">{messages.noUnitAssigned}</option>
              {apartments.map(apartment => <option key={apartment.id} value={apartment.id}>{messages.unitPrefix} {apartment.apartment_number}</option>)}
            </select>
          </section>

          <section className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground">{messages.systemPrivileges}</Label>
            <div className={cn('grid gap-3', roleOptions.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
              {roleOptions.map(roleOption => (
                <button
                  type="button"
                  key={roleOption}
                  onClick={() => setNewRole(roleOption)}
                  aria-pressed={newRole === roleOption}
                  className={cn(
                    'flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border bg-background p-4 text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    newRole === roleOption && 'border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20'
                  )}
                >
                  <Shield className="size-5" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase">{getRoleLabel(roleOption)}</span>
                </button>
              ))}
            </div>
            {newRole === USER_ROLES.resident && selectedApartmentId && user.approval_status === ACCOUNT_STATUS.approved && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
                <input
                  type="checkbox"
                  id="identity-manager"
                  checked={isManager}
                  onChange={event => setIsManager(event.target.checked)}
                  className="size-4 rounded border-input accent-primary"
                />
                <Label htmlFor="identity-manager" className="text-sm font-medium text-foreground">
                  {messages.assignManager}
                </Label>
              </div>
            )}
          </section>

          <section className="rounded-md border border-border bg-muted/20 p-4">
            <Label htmlFor="identity-admin-password" className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Lock className="size-4" aria-hidden="true" />
              {messages.securitySignatureRequired}
            </Label>
            <Input
              id="identity-admin-password"
              type="password"
              placeholder={messages.adminPasswordPlaceholder}
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              autoComplete="current-password"
              className="h-10 bg-background"
            />
          </section>
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="h-10 sm:min-w-28">
            {messages.cancel}
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving || !confirmPassword || !reason.trim()}
            className="h-10 sm:min-w-56"
          >
            {messages.applyIdentityChange}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
