// Title: Approvals Bulk Bar
// Path: src/app/admin/approvals/ApprovalsBulkBar.tsx
// Functionality: Presents selected queue count and bulk approve, reject, or clear commands.

import { Layers, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { en } from '@/localization/en';

const messages = en.adminApprovals;

interface ApprovalsBulkBarProps {
  count: number;
  onApprove: () => void;
  onReject: () => void;
  onClear: () => void;
}

export function ApprovalsBulkBar({ count, onApprove, onReject, onClear }: ApprovalsBulkBarProps) {
  return (
    <div role="region" aria-label={messages.bulkSelectionAria} className="fixed bottom-5 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 animate-in flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 text-foreground shadow-sm slide-in-from-bottom-10 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
          <Layers className="size-4 text-muted-foreground" aria-hidden="true" />
        </span>
        <span className="min-w-0 text-sm font-medium">
          <span className="mr-2 inline-flex h-6 min-w-8 items-center justify-center rounded-md bg-muted px-2 font-semibold tabular-nums text-foreground">{count}</span>
          {messages.selected}
        </span>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" onClick={onApprove} className="h-8 bg-success text-success-foreground hover:bg-success/90">{messages.approve}</Button>
        <Button size="sm" variant="destructive" onClick={onReject} className="h-8">{messages.reject}</Button>
        <Button size="icon" variant="ghost" onClick={onClear} aria-label={messages.clearSelection} className="size-8 text-muted-foreground hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
