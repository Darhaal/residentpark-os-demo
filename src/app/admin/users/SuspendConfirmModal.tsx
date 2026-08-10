// Title: Suspend Confirm Modal
// Path: src/app/admin/users/SuspendConfirmModal.tsx
// Functionality: Modal workflow for identity and role operations, validation, and feedback.

// Suspend confirmation dialog for an active account.

'use client';

import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { en } from '@/localization/en';

interface SuspendConfirmModalProps {
  email: string | null;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const messages = en.adminUsers;

export function SuspendConfirmModal({ email, isSaving, onCancel, onConfirm }: SuspendConfirmModalProps) {
  return (
    <Modal onClose={onCancel} label={messages.revokeTitle} overlayClassName="z-[160]" className="max-w-sm">
      <div className="w-full animate-in overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95">
        <header className="border-b border-border px-5 py-4">
          <div className="mb-2 flex items-center gap-3 text-destructive">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-destructive/20 bg-destructive/10">
              <ShieldAlert className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold text-foreground">{messages.revokeTitle}</h2>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{messages.revokeDescription(email)}</p>
        </header>
        <footer className="flex flex-col-reverse gap-2 bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} className="h-10 sm:min-w-28">
            {messages.cancel}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isSaving} className="h-10 sm:min-w-40">
            {messages.confirmRevocation}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
