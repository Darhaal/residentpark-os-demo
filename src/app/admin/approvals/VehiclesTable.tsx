// Title: Vehicles Table
// Path: src/app/admin/approvals/VehiclesTable.tsx
// Functionality: Tabular approval view with status, selection, and row-level actions.

// Pending vehicle-requests table. Presentational: selection and approve/reject
// actions are owned by ApprovalsClient.

'use client';

import { Building, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { en } from '@/localization/en';
import { getApartmentNumber, type PendingVehicle } from './approvals-types';

const messages = en.adminApprovals;

interface VehiclesTableProps {
  vehicles: PendingVehicle[];
  selectedIds: Set<string>;
  processingId: string | null;
  onToggleAll: () => void;
  onToggleRow: (id: string) => void;
  onReject: (id: string) => void;
  onApprove: (id: string) => void;
}

export function VehiclesTable({
  vehicles,
  selectedIds,
  processingId,
  onToggleAll,
  onToggleRow,
  onReject,
  onApprove,
}: VehiclesTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm animate-in fade-in">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="w-12 px-4 py-3 text-center align-middle">
                <input type="checkbox" aria-label={messages.selectAllVehicles} checked={vehicles.length > 0 && selectedIds.size === vehicles.length} onChange={onToggleAll} className="size-4 cursor-pointer rounded border-border accent-primary" />
              </th>
              <th className="px-4 py-3">{messages.table.vehicleDetails}</th>
              <th className="px-4 py-3">{messages.table.linkedUnit}</th>
              <th className="px-4 py-3 text-right">{messages.table.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {vehicles.map(vehicle => (
              <tr key={vehicle.id} className={`transition-colors ${selectedIds.has(vehicle.id) ? 'bg-muted/40' : 'hover:bg-muted/25'}`}>
                <td className="px-4 py-3 text-center align-middle">
                  <input
                    type="checkbox"
                    aria-label={messages.selectVehicle(vehicle.plate_number)}
                    checked={selectedIds.has(vehicle.id)}
                    onChange={() => onToggleRow(vehicle.id)}
                    className="size-4 cursor-pointer rounded border-border accent-primary"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="inline-block rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-sm font-semibold text-foreground">{vehicle.plate_number}</div>
                  <div className="mt-2 text-xs font-medium text-muted-foreground">{vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''} - {vehicle.color}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Building className="size-4 text-muted-foreground" aria-hidden="true" /> {messages.apartmentPrefix} {getApartmentNumber(vehicle.apartments) || messages.unknownApartment}
                  </div>
                  <div className="mt-1 text-xs font-medium text-muted-foreground">{vehicle.profiles?.full_name || messages.ownerNotSpecified}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => onReject(vehicle.id)} disabled={processingId === vehicle.id} className="font-medium text-destructive hover:bg-destructive/10">{messages.reject}</Button>
                    <Button variant="default" size="sm" onClick={() => onApprove(vehicle.id)} disabled={processingId === vehicle.id} className="bg-success text-success-foreground shadow-sm hover:bg-success/90">
                      {processingId === vehicle.id && <Spinner className="size-3.5 text-current" aria-hidden="true" />}
                      {messages.approve}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={4} className="p-0">
                  <EmptyState icon={Car} title={messages.emptyVehiclesTitle} description={messages.emptyVehiclesDescription} className="rounded-none border-0 bg-transparent" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
