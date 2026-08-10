// Title: Revoke Invitation Modal
// Path: src/app/admin/invites/RevokeInvitationModal.tsx
// Functionality: Confirms permanent invitation-link revocation with stable loading feedback.

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { en } from '@/localization/en';

const messages = en.invitations;

interface RevokeInvitationModalProps {
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RevokeInvitationModal({ isLoading, onClose, onConfirm }: RevokeInvitationModalProps) {
  const close = () => {
    if (!isLoading) onClose();
  };

  return (
    <Modal onClose={close} label={messages.revokeTitle} overlayClassName="z-50" className="max-w-sm">
      <div className="w-full overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-xl font-semibold text-foreground">{messages.revokeTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{messages.revokeDescription}</p>
        </header>
        <footer className="flex flex-col-reverse gap-2 bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={isLoading} className="h-10 sm:min-w-28">
            {messages.cancel}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isLoading} className="h-10 sm:min-w-32">
            {isLoading && <Spinner className="size-4 text-current" aria-hidden="true" />}
            {isLoading ? messages.revoking : messages.confirm}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
