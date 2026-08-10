// Title: Create Manual Log Modal
// Path: src/app/admin/logs/CreateManualLogModal.tsx
// Functionality: Modal workflow for audit log operations, validation, and feedback.

// Manual audit-note modal. Presentational: draft state and submit handler are
// owned by AuditLogsClient and passed as props.

'use client';

import { CheckCircle2, PlusCircle, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { en } from '@/localization/en';
import type { ManualLogDraft, Severity } from './audit-logs-utils';

const selectClassName =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

interface CreateManualLogModalProps {
  draft: ManualLogDraft;
  setDraft: (draft: ManualLogDraft) => void;
  isCreating: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function CreateManualLogModal({ draft, setDraft, isCreating, onClose, onSubmit }: CreateManualLogModalProps) {
  const t = en.adminLogs;

  return (
    <Modal onClose={onClose} label={t.addNoteTitle} overlayClassName="z-[150]" className="max-w-lg">
      <div className="flex max-h-[90vh] w-full animate-in flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <PlusCircle className="size-5 text-info" aria-hidden="true" />
              {t.addNoteTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.addNoteDescription}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 shrink-0 rounded-md border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
            aria-label={en.common.closeDialog}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manual-log-domain">{t.domainLabel}</Label>
              <select
                id="manual-log-domain"
                value={draft.domain}
                onChange={event => setDraft({ ...draft, domain: event.target.value })}
                className={selectClassName}
              >
                <option value="system">{t.domainSystem}</option>
                <option value="identity">{t.domainIdentity}</option>
                <option value="property">{t.domainProperty}</option>
                <option value="vehicle">{t.domainVehicle}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-log-severity">{t.severityLabel}</Label>
              <select
                id="manual-log-severity"
                value={draft.severity}
                onChange={event => setDraft({ ...draft, severity: event.target.value as Severity })}
                className={selectClassName}
              >
                <option value="info">{t.severityInfo}</option>
                <option value="warning">{t.severityWarning}</option>
                <option value="critical">{t.severityCritical}</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-log-action-type">{t.actionTypeTagLabel}</Label>
            <Input
              id="manual-log-action-type"
              value={draft.actionType}
              onChange={event => setDraft({ ...draft, actionType: event.target.value.toUpperCase() })}
              placeholder={t.actionTypePlaceholder}
              className="bg-background font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-log-description">{t.eventDescriptionLabel}</Label>
            <Textarea
              id="manual-log-description"
              value={draft.description}
              onChange={event => setDraft({ ...draft, description: event.target.value })}
              placeholder={t.eventDescriptionPlaceholder}
              className="h-28 bg-background"
            />
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-border bg-muted/20 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isCreating}>{t.cancel}</Button>
          <Button type="button" onClick={onSubmit} disabled={isCreating || !draft.description.trim()}>
            {isCreating ? <Spinner className="mr-2 size-4 text-current" /> : <CheckCircle2 className="mr-2 size-4" aria-hidden="true" />}
            {t.submitToBus}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
