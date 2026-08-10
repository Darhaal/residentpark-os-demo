// Title: Notice Composer
// Path: src/app/admin/notices/NoticeComposer.tsx
// Functionality: Manages audience targeting, rich-text drafting, and notice delivery.

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building, Send, User as UserIcon, Users, type LucideIcon } from 'lucide-react';
import { sendNoticeAction } from '@/actions/notices';
import { NoticeBody } from '@/components/shared/NoticeBody';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { ADMIN_NOTICES_CONFIG } from '@/config/admin-clients';
import { isRichTextEmpty } from '@/lib/html';
import { en } from '@/localization/en';
import { NoticeEditorModal } from './NoticeEditorModal';
import type {
  AdminNoticeType,
  NoticeApartment,
  NoticeAudience,
  NoticeFeedbackHandlers,
  NoticeResident,
} from './admin-notices-types';

const messages = en.adminNotices;
const noticesConfig = ADMIN_NOTICES_CONFIG;
const noticeAudiences = noticesConfig.audiences;
const noticeTypes = noticesConfig.noticeTypes;
const selectClassName = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

interface NoticeComposerProps extends NoticeFeedbackHandlers {
  apartments: NoticeApartment[];
  residents: NoticeResident[];
  /** Seed the draft from a previously sent notice (Edit & resend). Audience is re-chosen. */
  prefill?: { title: string; body: string; type: string };
}

interface AudienceButtonProps {
  value: NoticeAudience;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: (value: NoticeAudience) => void;
}

function AudienceButton({ value, icon: Icon, label, active, onClick }: AudienceButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      onClick={() => onClick(value)}
      aria-pressed={active}
      className="h-10 w-full"
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

export function NoticeComposer({
  apartments,
  residents,
  prefill,
  clearFeedback,
  showError,
  showToast,
}: NoticeComposerProps) {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);
  const [audience, setAudience] = useState<NoticeAudience>(noticeAudiences.all);
  const [apartmentId, setApartmentId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [type, setType] = useState<AdminNoticeType>(() =>
    prefill && noticeTypes.includes(prefill.type as AdminNoticeType)
      ? (prefill.type as AdminNoticeType)
      : noticesConfig.defaultNoticeType,
  );
  const [title, setTitle] = useState(() => prefill?.title ?? '');
  const [body, setBody] = useState(() => prefill?.body ?? '');
  const [editorOpen, setEditorOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // When seeded from "Edit & resend", bring the composer into view (it remounts per resend).
  useEffect(() => {
    if (prefill) sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [prefill]);

  const canSend =
    title.trim().length > 0 &&
    !isRichTextEmpty(body) &&
    (audience !== noticeAudiences.apartment || apartmentId.length > 0) &&
    (audience !== noticeAudiences.profile || targetId.length > 0);

  const handleAudienceChange = (nextAudience: NoticeAudience) => {
    setAudience(nextAudience);
    setApartmentId('');
    setTargetId('');
  };

  const handleSend = () => {
    if (!canSend) return;

    startTransition(async () => {
      clearFeedback();
      const result = await sendNoticeAction({
        audience,
        apartmentId: apartmentId || null,
        targetId: targetId || null,
        title,
        body,
        type,
      });

      if (!result.success) {
        showError(result.error || messages.sendError);
        return;
      }

      showToast(messages.sentToast(result.meta?.count ?? 0));
      setTitle('');
      setBody('');
      router.refresh();
    });
  };

  return (
    <section
      ref={sectionRef}
      className="space-y-4 rounded-md border border-border bg-card p-4 shadow-sm lg:col-span-3"
      aria-labelledby="notice-compose-title"
    >
      <h2 id="notice-compose-title" className="text-sm font-semibold text-foreground">{messages.composeTitle}</h2>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">{messages.audienceLabel}</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label={messages.audienceLabel}>
          <AudienceButton value={noticeAudiences.all} icon={Users} label={messages.audiences.all} active={audience === noticeAudiences.all} onClick={handleAudienceChange} />
          <AudienceButton value={noticeAudiences.apartment} icon={Building} label={messages.audiences.apartment} active={audience === noticeAudiences.apartment} onClick={handleAudienceChange} />
          <AudienceButton value={noticeAudiences.profile} icon={UserIcon} label={messages.audiences.profile} active={audience === noticeAudiences.profile} onClick={handleAudienceChange} />
        </div>
      </div>

      {audience === noticeAudiences.apartment && (
        <div className="space-y-1.5">
          <Label htmlFor="notice-apartment" className="text-xs font-semibold text-muted-foreground">{messages.apartmentLabel}</Label>
          <select id="notice-apartment" value={apartmentId} onChange={(event) => setApartmentId(event.target.value)} className={selectClassName}>
            <option value="">{messages.apartmentPlaceholder}</option>
            {apartments.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>{messages.unitPrefix} {apartment.apartment_number}</option>
            ))}
          </select>
        </div>
      )}

      {audience === noticeAudiences.profile && (
        <div className="space-y-1.5">
          <Label htmlFor="notice-resident" className="text-xs font-semibold text-muted-foreground">{messages.residentLabel}</Label>
          <select id="notice-resident" value={targetId} onChange={(event) => setTargetId(event.target.value)} className={selectClassName}>
            <option value="">{messages.residentPlaceholder}</option>
            {residents.map((resident) => (
              <option key={resident.id} value={resident.id}>
                {resident.full_name || resident.email} {resident.unit ? `- ${messages.unitPrefix} ${resident.unit}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="notice-type" className="text-xs font-semibold text-muted-foreground">{messages.typeLabel}</Label>
          <select id="notice-type" value={type} onChange={(event) => setType(event.target.value as AdminNoticeType)} className={selectClassName}>
            {noticeTypes.map((noticeType) => (
              <option key={noticeType} value={noticeType}>{messages.noticeTypeLabels[noticeType]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notice-title" className="text-xs font-semibold text-muted-foreground">{messages.titleLabel}</Label>
          <Input id="notice-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={messages.titlePlaceholder} className="h-10" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label id="notice-message-label" className="text-xs font-semibold text-muted-foreground">{messages.messageLabel}</Label>
        <div className="overflow-hidden rounded-md border border-border bg-background">
          <div
            role="button"
            tabIndex={0}
            aria-labelledby="notice-message-label"
            aria-haspopup="dialog"
            onClick={() => setEditorOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setEditorOpen(true);
              }
            }}
            className="min-h-24 cursor-text p-3 outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
          >
            {isRichTextEmpty(body)
              ? <span className="text-sm text-muted-foreground">{messages.messagePlaceholder}</span>
              : <NoticeBody html={body} />}
          </div>
          <div className="flex justify-end border-t border-border bg-muted/20 px-2 py-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditorOpen(true)}>
              {messages.openEditor}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="button" onClick={handleSend} disabled={!canSend || isPending} className="h-9 min-w-32">
          {isPending ? <Spinner className="size-4 text-current" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {isPending ? messages.sending : messages.sendNotice}
        </Button>
      </div>

      {editorOpen && (
        <NoticeEditorModal
          value={body}
          placeholder={messages.messagePlaceholder}
          onClose={() => setEditorOpen(false)}
          onSave={(html) => {
            setBody(html);
            setEditorOpen(false);
          }}
        />
      )}
    </section>
  );
}
