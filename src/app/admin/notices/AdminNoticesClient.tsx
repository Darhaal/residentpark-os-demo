// Title: Notices Admin Client
// Path: src/app/admin/notices/AdminNoticesClient.tsx
// Functionality: Coordinates resident banner, notice composition, delivery history, and shared feedback.

'use client';

import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import { useFeedback } from '@/hooks/use-feedback';
import { en } from '@/localization/en';
import type { AdminNoticesClientProps } from './admin-notices-types';
import { NoticeComposer } from './NoticeComposer';
import { PortalBannerPanel } from './PortalBannerPanel';
import { SentNoticesPanel } from './SentNoticesPanel';

const messages = en.adminNotices;

export function AdminNoticesClient({
  notices,
  apartments,
  residents,
  portalNotice,
  settingsReady,
}: AdminNoticesClientProps) {
  const feedback = useFeedback();
  const feedbackHandlers = {
    clearFeedback: feedback.clearFeedback,
    showError: feedback.showError,
    showToast: feedback.showToast,
  };
  // "Edit & resend": load a sent notice's content into the composer. The nonce remounts
  // the composer so it re-seeds its draft from the prefill each time.
  const [resend, setResend] = useState<{ title: string; body: string; type: string; nonce: number } | null>(null);

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-8">
      <FeedbackToasts
        successMsg={feedback.successMsg}
        errorMsg={feedback.errorMsg}
        onClear={feedback.clearFeedback}
      />

      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
              <Megaphone className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{messages.pageTitle}</h1>
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{messages.pageDescription}</p>
            </div>
          </div>
        </header>

        <PortalBannerPanel
          initialValue={portalNotice}
          settingsReady={settingsReady}
          {...feedbackHandlers}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <NoticeComposer
            key={resend ? resend.nonce : 'compose'}
            apartments={apartments}
            residents={residents}
            prefill={resend ? { title: resend.title, body: resend.body, type: resend.type } : undefined}
            {...feedbackHandlers}
          />
          <SentNoticesPanel
            notices={notices}
            onResend={(batch) => setResend({ title: batch.title, body: batch.body, type: batch.type, nonce: Date.now() })}
          />
        </div>
      </div>
    </main>
  );
}
