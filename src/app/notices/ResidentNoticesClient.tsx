// Title: Resident Notices Client
// Path: src/app/notices/ResidentNoticesClient.tsx
// Functionality: Render resident notices and mark them read.

'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import { formatDateTime } from '@/lib/dates';
import { NoticeBody } from '@/components/shared/NoticeBody';
import { markNoticeReadAction, markAllNoticesReadAction, type NoticeRow } from '@/actions/notices';
import { ADMIN_NOTICES_CONFIG } from '@/config/admin-clients';
import { ROUTES } from '@/config/routes';
import { useFeedback } from '@/hooks/use-feedback';
import { en as locale } from '@/localization/en';
import { cn } from '@/lib/utils';

const messages = locale.residentNotices;
const noticeTypes = ADMIN_NOTICES_CONFIG.noticeTypes;

type NoticeType = (typeof noticeTypes)[number];

const isNoticeType = (value: string): value is NoticeType => noticeTypes.includes(value as NoticeType);
const formatNoticeType = (noticeType: string) =>
  isNoticeType(noticeType) ? messages.noticeTypeLabels[noticeType] : noticeType.replace(/_/g, ' ');

export function ResidentNoticesClient({ notices }: { notices: NoticeRow[] }) {
  const router = useRouter();
  const { errorMsg, successMsg, showError, clearFeedback } = useFeedback();
  const [readOverrides, setReadOverrides] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const visibleNotices = useMemo(() => notices.map(notice => ({
    ...notice,
    read_at: notice.read_at || readOverrides[notice.id] || null,
  })), [notices, readOverrides]);

  const unread = visibleNotices.filter(notice => !notice.read_at).length;
  const read = visibleNotices.length - unread;

  const removeReadOverride = (id: string) => {
    setReadOverrides(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const markOne = (id: string) => {
    const readAt = new Date().toISOString();
    setReadOverrides(prev => ({ ...prev, [id]: readAt }));
    startTransition(async () => {
      clearFeedback();
      const res = await markNoticeReadAction(id);
      if (!res.success) {
        removeReadOverride(id);
        showError(res.error || messages.markReadError);
        return;
      }
      router.refresh();
    });
  };

  const markAll = () => {
    const readAt = new Date().toISOString();
    const added = visibleNotices.filter(notice => !notice.read_at).map(notice => notice.id);
    setReadOverrides(prev => {
      const next = { ...prev };
      for (const id of added) next[id] = readAt;
      return next;
    });

    startTransition(async () => {
      clearFeedback();
      const res = await markAllNoticesReadAction();
      if (!res.success) {
        setReadOverrides(prev => {
          const next = { ...prev };
          for (const id of added) delete next[id];
          return next;
        });
        showError(res.error || messages.markAllReadError);
        return;
      }
      router.refresh();
    });
  };

  return (
    <main className="flex-1 overflow-y-auto bg-muted/30 px-4 py-5 sm:px-6 lg:px-8">
      <FeedbackToasts successMsg={successMsg} errorMsg={errorMsg} onClear={clearFeedback} />

      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
              <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{messages.pageTitle}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {unread > 0 ? messages.unreadCount(unread) : messages.allCaughtUp}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {unread > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={markAll} disabled={isPending} className="w-full sm:w-auto">
                <CheckCheck className="size-4" aria-hidden="true" />
                {messages.markAllRead}
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link href={ROUTES.home}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                {messages.backToDashboard}
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-px overflow-hidden rounded-md border border-border bg-border shadow-sm sm:grid-cols-3" aria-label={messages.summaryAria}>
          <SummaryCell label={messages.summary.total} value={visibleNotices.length} />
          <SummaryCell label={messages.summary.unread} value={unread} tone={unread ? 'info' : undefined} />
          <SummaryCell label={messages.summary.read} value={read} tone={read ? 'success' : undefined} />
        </section>

        {visibleNotices.length === 0 ? (
          <EmptyState icon={Bell} title={messages.emptyTitle} description={messages.emptyDescription} className="rounded-md" />
        ) : (
          <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm" aria-labelledby="resident-notices-list-title">
            <div className="border-b border-border bg-muted/20 px-4 py-3">
              <h2 id="resident-notices-list-title" className="text-sm font-semibold text-foreground">{messages.listTitle}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{messages.listDescription}</p>
            </div>
            <div className="divide-y divide-border">
              {visibleNotices.map(notice => {
                const isUnread = !notice.read_at;
                const statusId = `notice-status-${notice.id}`;
                return (
                  <article
                    key={notice.id}
                    role={isUnread ? 'button' : undefined}
                    tabIndex={isUnread ? 0 : undefined}
                    aria-describedby={statusId}
                    aria-label={isUnread ? messages.noticeAriaMarkRead(notice.title) : messages.noticeAriaRead(notice.title)}
                    onClick={() => {
                      if (isUnread && !isPending) markOne(notice.id);
                    }}
                    onKeyDown={isUnread ? (event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !isPending) {
                        event.preventDefault();
                        markOne(notice.id);
                      }
                    } : undefined}
                    className={cn(
                      'p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      isUnread ? 'cursor-pointer bg-info/5 hover:bg-info/10' : 'bg-card hover:bg-muted/20',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          {isUnread ? <span className="size-2 shrink-0 rounded-full bg-info" aria-hidden="true" /> : null}
                          <h3 className={cn('min-w-0 truncate text-sm text-foreground', isUnread ? 'font-semibold' : 'font-medium')}>
                            {notice.title}
                          </h3>
                        </div>
                        <p id={statusId} className="mt-1 text-xs text-muted-foreground">
                          {isUnread ? messages.unreadStatus : messages.readStatus}
                        </p>
                      </div>
                      <Badge variant={isUnread ? 'info' : 'secondary'} className="shrink-0">
                        {formatNoticeType(notice.type)}
                      </Badge>
                    </div>

                    <NoticeBody html={notice.body} className="mt-3 text-sm text-muted-foreground" />

                    <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>{formatDateTime(notice.created_at)}</span>
                      {isUnread ? <span className="font-medium text-info">{messages.selectToMarkRead}</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'info';
}) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'info' ? 'text-info' : 'text-foreground';

  return (
    <div className="bg-card p-4">
      <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}
