// Title: Create Account Modal
// Path: src/app/admin/users/CreateAccountModal.tsx
// Functionality: Modal workflow for identity and role operations, validation, and feedback.

'use client';

import { useState } from 'react';
import { Mail, Shield, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { USER_ROLES } from '@/config/domain';
import { cn } from '@/lib/utils';
import { en } from '@/localization/en';
import type { ApartmentOption, CreateAccountData, EditableRole } from './users-types';

interface CreateAccountModalProps {
  apartments: ApartmentOption[];
  canCreateAdmins: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (data: CreateAccountData) => void;
}

const messages = en.adminUsers;

export function CreateAccountModal({
  apartments,
  canCreateAdmins,
  isSaving,
  onCancel,
  onSubmit,
}: CreateAccountModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [role, setRole] = useState<EditableRole>(USER_ROLES.resident);
  const [apartmentId, setApartmentId] = useState('');

  const residentHasApartment = role !== USER_ROLES.resident || Boolean(apartmentId);
  const hasAdminConfirmation = role !== USER_ROLES.admin || Boolean(confirmAdminPassword);
  const canSubmit = Boolean(fullName.trim() && email.trim() && residentHasApartment && hasAdminConfirmation);

  const chooseRole = (nextRole: EditableRole) => {
    setRole(nextRole);
    if (nextRole === USER_ROLES.admin) setApartmentId('');
  };

  return (
    <Modal
      onClose={onCancel}
      label={messages.createAccount}
      overlayClassName="z-[80]"
      className="max-w-lg"
      dismissOnBackdrop={!isSaving}
    >
      <div className="flex max-h-[90vh] w-full animate-in flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-muted/30">
              <UserPlus className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <h2 id="create-account-title" className="truncate text-xl font-semibold text-foreground">
              {messages.createAccount}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={isSaving}
            aria-label={messages.closeCreateAccount}
            className="size-8 shrink-0 rounded-md border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </header>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={event => {
            event.preventDefault();
            if (!canSubmit || isSaving) return;
            onSubmit({
              fullName: fullName.trim(),
              email: email.trim(),
              confirmAdminPassword,
              role,
              apartmentId: role === USER_ROLES.resident ? apartmentId : null,
            });
          }}
        >
          <div className="space-y-5 overflow-y-auto px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="create-account-name">{messages.createFields.fullName}</Label>
                <Input
                  id="create-account-name"
                  name="name"
                  value={fullName}
                  onChange={event => setFullName(event.target.value)}
                  placeholder={messages.createFields.fullNamePlaceholder}
                  autoComplete="name"
                  autoFocus
                  required
                  disabled={isSaving}
                  className="h-10 bg-background"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="create-account-email">{messages.createFields.email}</Label>
                <Input
                  id="create-account-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder={messages.createFields.emailPlaceholder}
                  autoComplete="email"
                  required
                  disabled={isSaving}
                  className="h-10 bg-background"
                />
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-info/20 bg-info/5 px-4 py-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
              <p className="text-sm leading-5 text-muted-foreground">{messages.createFields.inviteDelivery}</p>
            </div>

            <div className="space-y-2">
              <Label>{messages.createFields.role}</Label>
              <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/20 p-1">
                <button
                  type="button"
                  onClick={() => chooseRole(USER_ROLES.resident)}
                  aria-pressed={role === USER_ROLES.resident}
                  className={cn(
                    'flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    role === USER_ROLES.resident && 'bg-background text-foreground shadow-sm ring-1 ring-border'
                  )}
                >
                  <UserPlus className="size-4" aria-hidden="true" /> {messages.residentRole}
                </button>
                <button
                  type="button"
                  onClick={() => chooseRole(USER_ROLES.admin)}
                  disabled={!canCreateAdmins}
                  aria-pressed={role === USER_ROLES.admin}
                  className={cn(
                    'flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40',
                    role === USER_ROLES.admin && 'bg-background text-foreground shadow-sm ring-1 ring-border'
                  )}
                >
                  <Shield className="size-4" aria-hidden="true" /> {messages.adminRole}
                </button>
              </div>
            </div>

            {role === USER_ROLES.resident && (
              <div className="space-y-2">
                <Label htmlFor="create-account-apartment">{messages.createFields.apartment}</Label>
                <select
                  id="create-account-apartment"
                  value={apartmentId}
                  onChange={event => setApartmentId(event.target.value)}
                  required
                  disabled={isSaving}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">{messages.createFields.selectApartment}</option>
                  {apartments.map(apartment => (
                    <option key={apartment.id} value={apartment.id}>
                      {messages.unitPrefix} {apartment.apartment_number}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {role === USER_ROLES.admin && (
              <div className="space-y-2 rounded-md border border-border bg-muted/20 p-4">
                <Label htmlFor="create-account-admin-password" className="text-muted-foreground">
                  {messages.createFields.adminConfirmation}
                </Label>
                <Input
                  id="create-account-admin-password"
                  name="current-password"
                  type="password"
                  value={confirmAdminPassword}
                  onChange={event => setConfirmAdminPassword(event.target.value)}
                  placeholder={messages.adminPasswordPlaceholder}
                  autoComplete="current-password"
                  required
                  disabled={isSaving}
                  className="h-10 bg-background"
                />
              </div>
            )}
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving} className="h-10 sm:min-w-28">
              {messages.cancel}
            </Button>
            <Button type="submit" disabled={!canSubmit || isSaving} className="h-10 sm:min-w-40">
              {isSaving ? <Spinner className="size-4" /> : <UserPlus className="size-4" aria-hidden="true" />}
              {isSaving ? messages.creatingAccount : messages.createAccount}
            </Button>
          </footer>
        </form>
      </div>
    </Modal>
  );
}
