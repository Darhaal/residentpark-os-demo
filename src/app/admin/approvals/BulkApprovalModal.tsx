// Title: Bulk Approval Modal
// Path: src/app/admin/approvals/BulkApprovalModal.tsx
// Functionality: Collects the required reason and confirms bulk account or vehicle decisions.

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ACCOUNT_STATUS } from '@/config/domain';
import { en } from '@/localization/en';
import type { ApprovalBulkIntent } from './approvals-types';

const messages = en.adminApprovals;

interface BulkApprovalModalProps {
  intent: ApprovalBulkIntent;
  selectedCount: number;
  reason: string;
  setReason: (value: string) => void;
  isProcessing: boolean;
  onCancel: () => void;
  onCommit: () => void;
}

export function BulkApprovalModal({ intent, selectedCount, reason, setReason, isProcessing, onCancel, onCommit }: BulkApprovalModalProps) {
  const isApproveIntent = intent === ACCOUNT_STATUS.approved;
  const close = () => {
    if (!isProcessing) onCancel();
  };

  return (
    <Modal onClose={close} label={messages.bulkModalTitle} overlayClassName="z-[80]" className="max-w-md">
      <div className="w-full animate-in overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-xl font-semibold text-foreground">{messages.bulkModalTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{messages.bulkModalDescription(selectedCount)}</p>
        </header>
        <div className="space-y-4 px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="approval-bulk-reason" className="text-xs font-medium text-muted-foreground">{messages.resolutionLog}</Label>
            <Textarea id="approval-bulk-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={messages.bulkReasonPlaceholder} className="h-24 bg-background" />
          </div>
        </div>
        <footer className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={isProcessing} className="h-10 sm:min-w-28">{messages.cancel}</Button>
          <Button
            type="button"
            variant={isApproveIntent ? 'default' : 'destructive'}
            onClick={onCommit}
            disabled={!reason.trim() || isProcessing}
            className={isApproveIntent ? 'h-10 min-w-32 bg-success text-success-foreground hover:bg-success/90' : 'h-10 min-w-32'}
          >
            {isProcessing && <Spinner className="size-4 text-current" aria-hidden="true" />}
            {isProcessing ? messages.processing : messages.confirm}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
