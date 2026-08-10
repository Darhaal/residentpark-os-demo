// Title: Sent Notices Panel
// Path: src/app/admin/notices/SentNoticesPanel.tsx
// Functionality: Presents grouped notice delivery history and read progress.

import { useMemo } from 'react';
import { Megaphone, Pencil } from 'lucide-react';
import type { NoticeRow } from '@/actions/notices';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/dates';
import { en } from '@/localization/en';
import type { NoticeBatch } from './admin-notices-types';
import { buildNoticeBatches, formatNoticeType } from './notice-batches';

const messages = en.adminNotices;

export function SentNoticesPanel({ notices, onResend }: { notices: NoticeRow[]; onResend?: (batch: NoticeBatch) => void }) {
  const batches = useMemo(() => buildNoticeBatches(notices), [notices]);

  return (
    <section
      className="flex overflow-hidden rounded-md border border-border bg-card shadow-sm lg:col-span-2 lg:flex-col"
      aria-labelledby="sent-notices-title"
    >
      <div className="w-full">
        <div className="border-b border-border bg-muted/20 px-4 py-3">
          <h2 id="sent-notices-title" className="text-sm font-semibold text-foreground">{messages.sentTitle(batches.length)}</h2>
        </div>

        {batches.length === 0 ? (
          <EmptyState icon={Megaphone} title={messages.emptyTitle} description={messages.emptyDescription} className="rounded-none border-0 bg-transparent" />
        ) : (
          <div className="max-h-[520px] divide-y divide-border overflow-y-auto">
            {batches.map((batch) => (
              <article key={batch.batch_id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-sm font-semibold text-foreground">{batch.title}</h3>
                  <Badge variant="secondary" className="shrink-0">{formatNoticeType(batch.type)}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{messages.recipients(batch.recipients)}</span>
                  <span aria-hidden="true">/</span>
                  <span>{messages.readCount(batch.read, batch.recipients)}</span>
                  <span aria-hidden="true">/</span>
                  <time dateTime={batch.created_at}>{formatDate(batch.created_at)}</time>
                </div>
                {onResend && (
                  <div className="mt-2.5">
                    <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => onResend(batch)} aria-label={messages.resendAria(batch.title)}>
                      <Pencil className="size-3.5" aria-hidden="true" /> {messages.resendButton}
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
