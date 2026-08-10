// Title: Invitations Directory Table
// Path: src/app/admin/invites/InvitationsDirectoryTable.tsx
// Functionality: Renders invitation delivery, consumption, validity, and row actions.

import { Link2, List, RotateCw } from 'lucide-react';
import type { InvitationDirectoryRow } from '@/actions/invites';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/dates';
import { en } from '@/localization/en';
import {
  deliveryVariant,
  getConsumptionDescription,
  getDeliveryDescription,
  getDeliveryLabel,
  inviteStatusVariant,
} from './invites-view-model';

const messages = en.invitations;

interface InvitationsDirectoryTableProps {
  invitations: InvitationDirectoryRow[];
  isActionLoading: string | null;
  isLoading: boolean;
  onCopyLink: (token: string) => void;
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
}

export function InvitationsDirectoryTable({
  invitations,
  isActionLoading,
  isLoading,
  onCopyLink,
  onResend,
  onRevoke,
}: InvitationsDirectoryTableProps) {
  return (
    <div className="min-h-[300px] overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-semibold">{messages.detailsHeader}</th>
            <th className="px-4 py-2.5 font-semibold">{messages.deliveryHeader}</th>
            <th className="px-4 py-2.5 font-semibold">{messages.consumptionHeader}</th>
            <th className="px-4 py-2.5 font-semibold">{messages.windowHeader}</th>
            <th className="px-4 py-2.5 text-right font-semibold">{messages.actionsHeader}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {isLoading ? (
            <tr>
              <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                <Spinner className="mx-auto mb-3 size-6" />
                {messages.loading}
              </td>
            </tr>
          ) : invitations.length > 0 ? (
            invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                isLoading={isActionLoading === invitation.id}
                onCopyLink={onCopyLink}
                onResend={onResend}
                onRevoke={onRevoke}
              />
            ))
          ) : (
            <tr>
              <td colSpan={5} className="p-0">
                <EmptyState icon={List} title={messages.emptyTitle} description={messages.emptyDescription} className="rounded-none border-0 bg-transparent" />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function InvitationRow({
  invitation,
  isLoading,
  onCopyLink,
  onResend,
  onRevoke,
}: {
  invitation: InvitationDirectoryRow;
  isLoading: boolean;
  onCopyLink: (token: string) => void;
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  const canCopyOrRevoke = invitation.status === 'pending';
  const canRefresh = invitation.status === 'pending' || invitation.status === 'expired';

  return (
    <tr className="transition-colors hover:bg-muted/25">
      <td className="px-4 py-3 align-middle">
        <div className="font-medium text-foreground">{invitation.email}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {messages.apartmentPrefix} {invitation.apartments?.apartment_number || messages.unassignedApartment}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={inviteStatusVariant(invitation.status)}>{messages.statusLabels[invitation.status]}</Badge>
          <span className="text-xs text-muted-foreground">{messages.roleLabel}: {invitation.role}</span>
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <Badge variant={deliveryVariant(invitation.status)}>{getDeliveryLabel(invitation.status)}</Badge>
        <p className="mt-2 max-w-48 text-xs leading-5 text-muted-foreground">{getDeliveryDescription(invitation.status)}</p>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="text-sm font-medium text-foreground">{messages.statusLabels[invitation.status]}</div>
        <p className="mt-1 max-w-52 text-xs leading-5 text-muted-foreground">{getConsumptionDescription(invitation.status)}</p>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{messages.createdPrefix}</span> {formatDate(invitation.created_at)}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{messages.expiresPrefix}</span> {formatDate(invitation.expires_at)}
        </div>
      </td>
      <td className="px-4 py-3 text-right align-middle">
        <div className="flex flex-wrap justify-end gap-2">
          {canCopyOrRevoke && (
            <Button type="button" variant="outline" size="sm" onClick={() => onCopyLink(invitation.token)} className="h-8 text-xs">
              <Link2 className="size-3" aria-hidden="true" />
              {messages.copyLink}
            </Button>
          )}
          {canCopyOrRevoke && (
            <Button type="button" variant="outline" size="sm" onClick={() => onRevoke(invitation.id)} className="h-8 text-xs text-destructive">
              {messages.revoke}
            </Button>
          )}
          {canRefresh && (
            <Button type="button" variant="outline" size="sm" onClick={() => onResend(invitation.id)} disabled={isLoading} className="h-8 text-xs">
              {isLoading ? <Spinner className="size-3" aria-hidden="true" /> : <RotateCw className="size-3" aria-hidden="true" />}
              {messages.resend}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
