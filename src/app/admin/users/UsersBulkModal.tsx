// Title: Users Bulk Modal
// Path: src/app/admin/users/UsersBulkModal.tsx
// Functionality: Modal workflow for identity and role operations, validation, and feedback.

// Bulk action confirmation modal: optional role picker + required audit reason.

'use client';

import { Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { USER_ROLES } from '@/config/domain';
import { cn } from '@/lib/utils';
import { en } from '@/localization/en';
import { roleChangeIntent, type BulkIntent, type EditableRole } from './users-types';

interface UsersBulkModalProps {
  intent: BulkIntent;
  selectedCount: number;
  bulkRole: EditableRole;
  setBulkRole: (role: EditableRole) => void;
  canAssignAdminRole: boolean;
  reason: string;
  setReason: (value: string) => void;
  isSaving: boolean;
  onCancel: () => void;
  onCommit: () => void;
}

const messages = en.adminUsers;

export function UsersBulkModal({
  intent,
  selectedCount,
  bulkRole,
  setBulkRole,
  canAssignAdminRole,
  reason,
  setReason,
  isSaving,
  onCancel,
  onCommit,
}: UsersBulkModalProps) {
  return (
    <Modal onClose={onCancel} label={messages.massActionTitle} overlayClassName="z-[120]" className="max-w-md">
      <div className="w-full animate-in overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-xl font-semibold text-foreground">{messages.massActionTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{messages.massActionDescription(selectedCount)}</p>
        </header>
        <div className="space-y-4 px-5 py-5">
          {intent === roleChangeIntent && (
            <div className="space-y-3">
              <div className={cn('grid gap-3', canAssignAdminRole ? 'grid-cols-2' : 'grid-cols-1')}>
                <button
                  type="button"
                  onClick={() => setBulkRole(USER_ROLES.resident)}
                  aria-pressed={bulkRole === USER_ROLES.resident}
                  className={cn(
                    'flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border bg-background p-4 text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    bulkRole === USER_ROLES.resident && 'border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20'
                  )}
                >
                  <Users className="size-5" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase">{messages.residentRole}</span>
                </button>
                {canAssignAdminRole && (
                  <button
                    type="button"
                    onClick={() => setBulkRole(USER_ROLES.admin)}
                    aria-pressed={bulkRole === USER_ROLES.admin}
                    className={cn(
                      'flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border bg-background p-4 text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      bulkRole === USER_ROLES.admin && 'border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20'
                    )}
                  >
                    <Shield className="size-5" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase">{messages.adminRole}</span>
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="bulk-audit-reason" className="text-xs font-medium text-muted-foreground">
              {messages.auditReason}
            </Label>
            <Textarea
              id="bulk-audit-reason"
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder={messages.auditReasonPlaceholder}
              className="h-24 bg-background"
            />
          </div>
        </div>
        <footer className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} className="h-10 sm:min-w-28">
            {messages.cancel}
          </Button>
          <Button type="button" onClick={onCommit} disabled={!reason.trim() || isSaving} className="h-10 sm:min-w-32">
            {isSaving ? <Spinner className="size-4 text-current" /> : messages.execute}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
