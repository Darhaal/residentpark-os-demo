// Title: Resident Parking Issue Modal
// Path: src/components/resident/ResidentParkingIssueModal.tsx
// Functionality: Validates and submits a resident issue for one assigned parking spot.

import { type FormEvent, useState } from 'react';
import { AlertTriangle, Send, X } from 'lucide-react';
import { reportParkingIssueAction } from '@/actions/resident';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { PARKING_ISSUE_TYPE } from '@/config/domain';
import { RESIDENT_PARKING_ISSUE_OPTIONS } from '@/config/issues';
import { en } from '@/localization/en';
import type { ResidentMapSpot } from './resident-parking-map-types';

const messages = en.residentParkingMap;
const selectClassName = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

interface ResidentParkingIssueModalProps {
  spot: ResidentMapSpot;
  onBeforeSubmit: () => void;
  onClose: () => void;
  onError: (message: string) => void;
  onSubmitted: () => void;
}

export function ResidentParkingIssueModal({
  spot,
  onBeforeSubmit,
  onClose,
  onError,
  onSubmitted,
}: ResidentParkingIssueModalProps) {
  const [issueType, setIssueType] = useState<string>(PARKING_ISSUE_TYPE.unauthorizedVehicle);
  const [violatingPlate, setViolatingPlate] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const close = () => {
    if (!isSubmitting) onClose();
  };

  const submitIssue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    onBeforeSubmit();

    try {
      const result = await reportParkingIssueAction(
        spot.id,
        spot.spot_number,
        issueType,
        violatingPlate.trim().toUpperCase(),
        comment.trim(),
      );

      if (!result.success) {
        onError(result.error || messages.issueSubmitError);
        return;
      }

      onSubmitted();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal onClose={close} label={messages.modalTitle} overlayClassName="z-[150] overflow-y-auto" className="max-w-md">
      <Card className="flex max-h-[calc(100dvh-2rem)] w-full animate-in flex-col border-border shadow-2xl fade-in zoom-in-95">
        <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
              {messages.modalTitle}
            </CardTitle>
            <CardDescription className="mt-1">{messages.modalDescription(spot.spot_number)}</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={close} disabled={isSubmitting} aria-label={messages.closeIssueDialog} className="size-8 shrink-0">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </CardHeader>

        <CardContent className="overflow-y-auto pt-1">
          <form onSubmit={submitIssue} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="resident-issue-type" className="text-xs font-semibold text-muted-foreground">{messages.issueTypeLabel}</Label>
              <select id="resident-issue-type" value={issueType} onChange={(event) => setIssueType(event.target.value)} className={selectClassName}>
                {RESIDENT_PARKING_ISSUE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resident-issue-plate" className="text-xs font-semibold text-muted-foreground">{messages.observedPlateLabel}</Label>
              <Input
                id="resident-issue-plate"
                value={violatingPlate}
                onChange={(event) => setViolatingPlate(event.target.value.toUpperCase())}
                placeholder={messages.observedPlatePlaceholder}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resident-issue-comment" className="text-xs font-semibold text-muted-foreground">{messages.commentLabel}</Label>
              <Textarea
                id="resident-issue-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={messages.commentPlaceholder}
                className="min-h-24 resize-y"
              />
            </div>

            <p className="rounded-md border border-warning/20 bg-warning/10 p-3 text-xs text-muted-foreground">{messages.reviewNotice}</p>

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={close} disabled={isSubmitting} className="h-9 sm:min-w-24">{messages.cancel}</Button>
              <Button type="submit" disabled={isSubmitting} className="h-9 sm:min-w-32">
                {isSubmitting ? <Spinner className="size-4 text-current" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                {isSubmitting ? messages.submitting : messages.submit}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}
