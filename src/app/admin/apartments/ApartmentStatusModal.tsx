// Title: Apartment Status Modal
// Path: src/app/admin/apartments/ApartmentStatusModal.tsx
// Functionality: Modal workflow for apartment and occupancy operations, validation, and feedback.

// Confirmation modal for an apartment status override (requires an operational reason).

'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { en } from '@/localization/en';
import type { ApartmentStatus } from './apartments-types';

const messages = en.adminApartments;

interface ApartmentStatusModalProps {
  pendingStatus: ApartmentStatus | null;
  reason: string;
  setReason: (value: string) => void;
  isUpdating: boolean;
  reasonMinLength: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ApartmentStatusModal({
  pendingStatus,
  reason,
  setReason,
  isUpdating,
  reasonMinLength,
  onCancel,
  onConfirm,
}: ApartmentStatusModalProps) {
  return (
    <Modal onClose={onCancel} label={messages.updateStatusTitle} overlayClassName="z-[200]" className="max-w-sm">
      <div className="w-full animate-in overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95">
        <header className="border-b border-border px-5 py-4">
          <div className="mb-2 flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-warning/20 bg-warning/10">
              <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold text-foreground">{messages.updateStatusTitle}</h2>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{messages.updateStatusDescription(pendingStatus)}</p>
        </header>
        <div className="space-y-4 px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="apartment-status-reason" className="text-xs font-medium text-muted-foreground">
              {messages.operationalReason}
            </Label>
            <Input
              id="apartment-status-reason"
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder={messages.statusReasonPlaceholder}
              className="h-10 bg-background"
              autoFocus
            />
          </div>
        </div>
        <footer className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} className="h-10 sm:min-w-28" disabled={isUpdating}>
            {messages.cancel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isUpdating || reason.trim().length < reasonMinLength}
            className="h-10 sm:min-w-40"
          >
            {isUpdating ? <Spinner className="size-4 text-current" /> : messages.confirmChange}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
