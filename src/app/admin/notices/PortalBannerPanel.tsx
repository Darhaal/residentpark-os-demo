// Title: Resident Portal Banner Panel
// Path: src/app/admin/notices/PortalBannerPanel.tsx
// Functionality: Publishes or clears the persistent resident dashboard banner.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pin } from 'lucide-react';
import { updatePortalNoticeAction } from '@/actions/settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { en } from '@/localization/en';
import type { NoticeFeedbackHandlers } from './admin-notices-types';

const messages = en.adminNotices.portalBanner;

interface PortalBannerPanelProps extends NoticeFeedbackHandlers {
  initialValue: string;
  settingsReady: boolean;
}

export function PortalBannerPanel({
  initialValue,
  settingsReady,
  clearFeedback,
  showError,
  showToast,
}: PortalBannerPanelProps) {
  const router = useRouter();
  const [banner, setBanner] = useState(initialValue);
  const [savedBanner, setSavedBanner] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const isPublished = savedBanner.trim().length > 0;

  const persistBanner = async (value: string) => {
    if (!settingsReady) {
      showError(messages.saveError);
      return;
    }

    setSaving(true);
    clearFeedback();
    const result = await updatePortalNoticeAction(value);
    setSaving(false);

    if (!result.success) {
      showError(result.error || messages.saveError);
      return;
    }

    const nextValue = value.trim();
    setBanner(nextValue);
    setSavedBanner(nextValue);
    showToast(messages.saved);
    router.refresh();
  };

  return (
    <section
      className="space-y-4 rounded-md border border-border bg-card p-4 shadow-sm"
      aria-labelledby="portal-banner-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="portal-banner-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Pin className="size-4 text-muted-foreground" aria-hidden="true" />
            {messages.title}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{messages.description}</p>
        </div>
        <Badge variant={isPublished ? 'success' : 'secondary'} className="w-fit shrink-0">
          <span
            className={`size-1.5 rounded-full ${isPublished ? 'bg-success' : 'bg-muted-foreground'}`}
            aria-hidden="true"
          />
          {isPublished ? messages.live : messages.hidden}
        </Badge>
      </div>

      <Textarea
        value={banner}
        onChange={(event) => setBanner(event.target.value)}
        placeholder={messages.placeholder}
        className="min-h-20 resize-y"
        aria-labelledby="portal-banner-title"
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => persistBanner('')}
          disabled={saving || (banner.trim().length === 0 && savedBanner.trim().length === 0)}
          className="h-9 sm:min-w-24"
        >
          {messages.clear}
        </Button>
        <Button
          type="button"
          onClick={() => persistBanner(banner)}
          disabled={saving || !settingsReady}
          className="h-9 sm:min-w-36"
        >
          {saving ? <Spinner className="size-4 text-current" aria-hidden="true" /> : <Pin className="size-4" aria-hidden="true" />}
          {saving ? messages.saving : messages.save}
        </Button>
      </div>
    </section>
  );
}
