// Title: Accounts Table
// Path: src/app/admin/approvals/AccountsTable.tsx
// Functionality: Tabular approval view with status, selection, and row-level actions.

// Pending account-requests table. Presentational: selection, apartment picks, and
// approve/reject actions are owned by ApprovalsClient.

'use client';

import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ApartmentCombobox } from '@/components/ui/apartment-combobox';
import { en } from '@/localization/en';
import { formatDate } from '@/lib/dates';
import type { ExtendedApartmentObj } from '@/components/shared/VehicleForm';
import { getApartmentNumber, type PendingAccount } from './approvals-types';

const messages = en.adminApprovals;

interface AccountsTableProps {
  accounts: PendingAccount[];
  apartments: ExtendedApartmentObj[];
  selectedIds: Set<string>;
  selectedApts: Record<string, string>;
  processingId: string | null;
  onToggleAll: () => void;
  onToggleRow: (id: string) => void;
  onSetApt: (id: string, value: string) => void;
  onReject: (id: string) => void;
  onApprove: (id: string) => void;
}

export function AccountsTable({
  accounts,
  apartments,
  selectedIds,
  selectedApts,
  processingId,
  onToggleAll,
  onToggleRow,
  onSetApt,
  onReject,
  onApprove,
}: AccountsTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm animate-in fade-in">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="w-12 px-4 py-3 text-center align-middle">
                <input type="checkbox" aria-label={messages.selectAllAccounts} checked={accounts.length > 0 && selectedIds.size === accounts.length} onChange={onToggleAll} className="size-4 cursor-pointer rounded border-border accent-primary" />
              </th>
              <th className="px-4 py-3">{messages.table.userDetails}</th>
              <th className="px-4 py-3">{messages.table.contextAssignment}</th>
              <th className="px-4 py-3 text-right">{messages.table.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {accounts.map(account => (
              <tr key={account.id} className={`transition-colors ${selectedIds.has(account.id) ? 'bg-muted/40' : 'hover:bg-muted/25'}`}>
                <td className="px-4 py-3 text-center align-middle">
                  <input
                    type="checkbox"
                    aria-label={messages.selectAccount(account.full_name || account.email || messages.unnamedAccount)}
                    checked={selectedIds.has(account.id)}
                    onChange={() => onToggleRow(account.id)}
                    className="size-4 cursor-pointer rounded border-border accent-primary"
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-foreground">{account.full_name || messages.unnamed}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{account.email}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{messages.requestPrefix} {formatDate(account.created_at)}</div>
                </td>
                <td className="px-4 py-3 align-top">
                  {getApartmentNumber(account.apartments) ? (
                    <div className="inline-block rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-foreground">
                      {messages.unitPrefix} {getApartmentNumber(account.apartments)}
                    </div>
                  ) : (
                    <ApartmentCombobox
                      apartments={apartments}
                      value={selectedApts[account.id] || ''}
                      onChange={val => onSetApt(account.id, val)}
                      disabled={processingId === account.id}
                    />
                  )}
                </td>
                <td className="px-4 py-3 align-top text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => onReject(account.id)} disabled={processingId === account.id} className="font-medium text-destructive hover:bg-destructive/10">{messages.reject}</Button>
                    <Button variant="default" size="sm" onClick={() => onApprove(account.id)} disabled={processingId === account.id} className="bg-success text-success-foreground shadow-sm hover:bg-success/90">
                      {processingId === account.id ? <Spinner className="size-3.5 text-current" /> : <CheckCircle2 className="size-3.5" aria-hidden="true" />} {messages.approve}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={4} className="p-0">
                  <EmptyState icon={ShieldCheck} title={messages.emptyAccountsTitle} description={messages.emptyAccountsDescription} className="rounded-none border-0 bg-transparent" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
