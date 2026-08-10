// Title: Invitation Import Panel
// Path: src/app/admin/invites/InvitationImportPanel.tsx
// Functionality: Parses CSV/TSV invitation rows, creates records, and presents the delivery/import report.

import { useState } from 'react';
import { FileSpreadsheet, MailQuestion } from 'lucide-react';
import { processBulkInvites, type BulkInviteResult } from '@/actions/invites';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { en } from '@/localization/en';
import type { InviteFeedbackHandlers } from './invites-types';
import { parseBulkInviteInput } from './invites-view-model';

const messages = en.invitations;

interface InvitationImportPanelProps extends InviteFeedbackHandlers {
  active: boolean;
}

export function InvitationImportPanel({
  active,
  clearFeedback,
  showToast,
}: InvitationImportPanelProps) {
  const [rawInput, setRawInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<BulkInviteResult | null>(null);

  const handleParseAndSubmit = async () => {
    if (!rawInput.trim()) return;

    setIsProcessing(true);
    setReport(null);
    clearFeedback();

    try {
      const parsed = parseBulkInviteInput(rawInput);
      const result = await processBulkInvites(parsed.invites);
      const nextReport: BulkInviteResult = {
        ...result,
        failed: [...parsed.failures, ...result.failed],
        totalProcessed: result.totalProcessed + parsed.failures.length,
      };
      setReport(nextReport);

      if (nextReport.successful > 0) {
        setRawInput('');
        showToast(messages.createdToast(nextReport.successful));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="invitations-import-panel"
      role="tabpanel"
      aria-labelledby="invitations-import-tab"
      hidden={!active}
      className={active ? 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]' : 'hidden'}
    >
      <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm" aria-labelledby="invite-import-title">
        <div className="border-b border-border bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 id="invite-import-title" className="text-sm font-semibold text-foreground">{messages.dataInputTitle}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {messages.dataInputFormatLabel}{' '}
            <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-foreground">{messages.dataInputFormat}</code>
          </p>
        </div>
        <div className="space-y-4 p-4">
          <Textarea
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            placeholder={messages.placeholder}
            aria-label={messages.importInputAria}
            className="min-h-[300px] resize-y font-mono text-sm"
            disabled={isProcessing}
          />
          <div className="flex justify-end">
            <Button type="button" onClick={handleParseAndSubmit} disabled={isProcessing || !rawInput.trim()}>
              {isProcessing && <Spinner className="size-4 text-current" aria-hidden="true" />}
              {messages.sendButton}
            </Button>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-md border border-border bg-card p-4 shadow-sm" aria-labelledby="invite-delivery-title">
          <div className="flex items-center gap-2">
            <MailQuestion className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 id="invite-delivery-title" className="text-sm font-semibold text-foreground">{messages.deliveryModelTitle}</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{messages.deliveryModelDescription}</p>
          <div className="mt-4 space-y-3">
            {messages.deliveryModelSteps.map((step) => (
              <div key={step.label} className="rounded-md border border-border bg-muted/20 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{step.label}</div>
                <div className="mt-1 text-sm text-foreground">{step.value}</div>
              </div>
            ))}
          </div>
        </section>

        {report && <InvitationImportReport report={report} />}
      </aside>
    </div>
  );
}

function InvitationImportReport({ report }: { report: BulkInviteResult }) {
  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-sm" aria-labelledby="invite-report-title">
      <h2 id="invite-report-title" className="text-sm font-semibold text-foreground">{messages.reportTitle}</h2>
      <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border text-center">
        <ReportStat label={messages.processedLabel} value={report.totalProcessed} />
        <ReportStat label={messages.successLabel} value={report.successful} tone="success" />
        <ReportStat label={messages.failedLabel} value={report.failed.length} tone={report.failed.length ? 'destructive' : undefined} />
      </div>
      {report.failed.length > 0 && (
        <div className="mt-3 max-h-[150px] overflow-y-auto border-t border-border pt-3">
          <div className="text-xs font-semibold text-foreground">{messages.errorsLabel}</div>
          <div className="mt-2 space-y-1">
            {report.failed.map((failure, index) => (
              <div key={`${failure.email}-${index}`} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{failure.email}</span>: {failure.reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ReportStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'destructive';
}) {
  const toneClass = tone === 'success'
    ? 'text-success'
    : tone === 'destructive'
      ? 'text-destructive'
      : 'text-foreground';

  return (
    <div className="bg-card p-3">
      <div className={cn('text-lg font-semibold tabular-nums', toneClass)}>{value}</div>
      <div className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</div>
    </div>
  );
}
