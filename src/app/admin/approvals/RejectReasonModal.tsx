// Title: Approval Rejection Modal
// Path: src/app/admin/approvals/RejectReasonModal.tsx
// Functionality: Collects and confirms a required rejection reason without dismissing during processing.

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { en } from '@/localization/en';

const messages = en.adminApprovals;

interface RejectReasonModalProps {
  reason: string;
  setReason: (value: string) => void;
  isProcessing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RejectReasonModal({ reason, setReason, isProcessing, onCancel, onConfirm }: RejectReasonModalProps) {
  const close = () => {
    if (!isProcessing) onCancel();
  };

  return (
    <Modal onClose={close} label={messages.rejectModalTitle} overlayClassName="z-[80]" className="max-w-sm">
      <div className="w-full overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-xl font-semibold text-foreground">{messages.rejectModalTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{messages.rejectModalDescription}</p>
        </header>
        <div className="space-y-4 px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="approval-reject-reason" className="text-xs font-medium text-muted-foreground">{messages.rejectionReason}</Label>
            <Input id="approval-reject-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={messages.rejectionPlaceholder} className="h-10 bg-background" />
          </div>
        </div>
        <footer className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={isProcessing} className="h-10 sm:min-w-28">{messages.cancel}</Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={!reason.trim() || isProcessing} className="h-10 sm:min-w-36">
            {isProcessing && <Spinner className="size-4 text-current" aria-hidden="true" />}
            {isProcessing ? messages.rejecting : messages.confirmReject}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
