// Title: Vehicles Directory Client
// Path: src/app/admin/vehicles/VehiclesClient.tsx
// Functionality: Search, filter, sort, register, review, and archive vehicles.

'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Car, PlusCircle, Search, ShieldCheck, Building, Info, Archive, Clock, ArrowUpDown, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import { addVehicleByAdminAction, reviewVehicleAction, archiveVehicleAction } from '@/actions/parking';
import { loadVehiclesDirectoryAction } from '@/actions/loaders';
import { type ExtendedApartmentObj, type VehicleFormData } from '@/components/shared/VehicleForm';
import { useFeedback } from '@/hooks/use-feedback';
import { ADMIN_VEHICLES_CONFIG } from '@/config/admin-clients';
import { en as locale } from '@/localization/en';
import { FILTER_ALL, VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { VehicleInfoModal } from './VehicleInfoModal';
import { AddVehicleModal } from './AddVehicleModal';
import { type SortDirection, type SortField, type VehicleDirectoryVehicle } from './vehicles-types';

export type { VehicleDirectoryVehicle } from './vehicles-types';

interface VehiclesClientProps {
  initialVehicles: VehicleDirectoryVehicle[];
  initialApartments: ExtendedApartmentObj[];
}

const messages = locale.adminVehicles;

function SortHeader({
  field,
  label,
  activeField,
  onSort,
}: {
  field: SortField;
  label: string;
  activeField: SortField;
  onSort: (field: SortField) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center gap-1 cursor-pointer hover:text-zinc-900 transition-colors group select-none"
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 transition-opacity ${activeField === field ? 'opacity-100 text-zinc-900' : 'opacity-0 group-hover:opacity-50'}`} />
    </button>
  );
}

export function VehiclesClient({ initialVehicles, initialApartments }: VehiclesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { errorMsg, successMsg, showToast, showError, clearFeedback } = useFeedback();
  const [vehicles, setVehicles] = useState<VehicleDirectoryVehicle[]>(initialVehicles);
  const [allApartments, setAllApartments] = useState<ExtendedApartmentObj[]>(initialApartments);
  // Seed from ?q= so Global Search results deep-link straight to the matched record.
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [filterStatus, setFilterStatus] = useState(FILTER_ALL);
  const [sortField, setSortField] = useState<SortField>(ADMIN_VEHICLES_CONFIG.defaultSort.field);
  const [sortDir, setSortDir] = useState<SortDirection>(ADMIN_VEHICLES_CONFIG.defaultSort.direction);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [addVehicleModal, setAddVehicleModal] = useState(false);
  const [selectedVehicleInfo, setSelectedVehicleInfo] = useState<VehicleDirectoryVehicle | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isPending, startTransition] = useTransition();

  const refreshData = async (nextFilter = filterStatus) => {
    clearFeedback();
    const res = await loadVehiclesDirectoryAction(nextFilter);
    if (!res.success) {
      showError(res.error || messages.loadError);
      return false;
    }
    setVehicles(res.vehicles as VehicleDirectoryVehicle[]);
    setAllApartments(res.apartments as ExtendedApartmentObj[]);
    return true;
  };

  const handleFilterChange = (nextFilter: string) => {
    setFilterStatus(nextFilter);
    startTransition(async () => {
      await refreshData(nextFilter);
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const processedVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = vehicles.filter(vehicle =>
      vehicle.plate_number.toLowerCase().includes(q) ||
      (vehicle.profiles?.full_name || '').toLowerCase().includes(q) ||
      (vehicle.apartments?.apartment_number || '').toLowerCase().includes(q)
    );

    return filtered.sort((a, b) => {
      if (sortField === 'apartment') {
        const aNum = a.apartments?.apartment_number || '';
        const bNum = b.apartments?.apartment_number || '';
        const cmp = aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      }

      let aVal = '';
      let bVal = '';
      if (sortField === 'plate_number') { aVal = a.plate_number; bVal = b.plate_number; }
      if (sortField === 'make') { aVal = a.make || ''; bVal = b.make || ''; }
      if (sortField === 'owner') { aVal = a.profiles?.full_name || ''; bVal = b.profiles?.full_name || ''; }
      if (sortField === 'status') { aVal = a.approval_status; bVal = b.approval_status; }

      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [vehicles, searchQuery, sortField, sortDir]);

  const handleAddVehicle = (data: VehicleFormData) => {
    setIsProcessing(ADMIN_VEHICLES_CONFIG.processingIds.addVehicle);
    startTransition(async () => {
      const res = await addVehicleByAdminAction({
        apartmentId: data.apartmentId,
        ownerId: data.ownerId,
        plateNumber: data.plateNumber,
        make: data.make,
        model: data.model,
        color: data.color,
        year: data.year,
      });

      if (res.success) {
        await refreshData(filterStatus);
        setAddVehicleModal(false);
        showToast(messages.registeredToast);
        router.refresh();
      } else {
        showError(res.error || messages.addError);
      }
      setIsProcessing(null);
    });
  };

  const handleStatusChange = (id: string, decision: typeof VEHICLE_APPROVAL_STATUS.approved | typeof VEHICLE_APPROVAL_STATUS.rejected) => {
    setIsProcessing(id);
    startTransition(async () => {
      const reason = decision === VEHICLE_APPROVAL_STATUS.rejected ? (actionReason || messages.defaultReasons.rejection) : messages.defaultReasons.override;
      const res = await reviewVehicleAction(id, decision, reason);
      if (res.success) {
        await refreshData(filterStatus);
        setSelectedVehicleInfo(null);
        setActionReason('');
        showToast(messages.markedToast(decision));
        router.refresh();
      } else {
        showError(res.error || messages.updateError);
      }
      setIsProcessing(null);
    });
  };

  const handleArchiveVehicle = (id: string) => {
    setIsProcessing(ADMIN_VEHICLES_CONFIG.processingIds.archive);
    startTransition(async () => {
      const res = await archiveVehicleAction(id, actionReason || messages.defaultReasons.archive);
      if (res.success) {
        await refreshData(filterStatus);
        setSelectedVehicleInfo(null);
        setActionReason('');
        showToast(messages.archivedToast);
        router.refresh();
      } else {
        showError(res.error || messages.archiveError);
      }
      setIsProcessing(null);
    });
  };

  return (
    <main className="flex-1 p-8 overflow-y-auto pb-24">
      <FeedbackToasts successMsg={successMsg} errorMsg={errorMsg} onClear={clearFeedback} />

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-zinc-950 flex items-center gap-3">
              <Car className="h-8 w-8 text-zinc-900" /> {messages.pageTitle}
            </h1>
          </div>
          <Button onClick={() => setAddVehicleModal(true)} className="bg-zinc-950 text-white font-bold h-10 w-full md:w-auto shadow-sm">
            <PlusCircle className="h-4 w-4 mr-2" /> {messages.registerVehicle}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              aria-label={messages.searchAria}
              placeholder={messages.searchPlaceholder}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-11 bg-white shadow-sm"
            />
          </div>
          <select
            aria-label={messages.filterAria}
            value={filterStatus}
            onChange={e => handleFilterChange(e.target.value)}
            className="h-11 px-4 rounded-lg border border-zinc-200 bg-white text-sm font-medium outline-none shadow-sm min-w-[200px]"
            disabled={isPending}
          >
            <option value={FILTER_ALL}>{messages.filters.all}</option>
            <option value={VEHICLE_APPROVAL_STATUS.approved}>{messages.filters.active}</option>
            <option value={VEHICLE_APPROVAL_STATUS.pendingApproval}>{messages.filters.pending}</option>
            <option value={VEHICLE_APPROVAL_STATUS.rejected}>{messages.filters.rejected}</option>
            <option value={VEHICLE_APPROVAL_STATUS.archived}>{messages.filters.archived}</option>
          </select>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left min-w-[760px]">
              <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider text-[10px] border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-4"><SortHeader field="plate_number" label={messages.headers.identification} activeField={sortField} onSort={handleSort} /></th>
                  <th className="px-6 py-4"><SortHeader field="apartment" label={messages.headers.unitOwner} activeField={sortField} onSort={handleSort} /></th>
                  <th className="px-6 py-4"><SortHeader field="status" label={messages.headers.status} activeField={sortField} onSort={handleSort} /></th>
                  <th className="px-6 py-4 text-right">{messages.headers.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {processedVehicles.map(vehicle => (
                  <tr key={vehicle.id} className={`transition-colors ${vehicle.approval_status === VEHICLE_APPROVAL_STATUS.archived ? 'opacity-60 grayscale-[0.5]' : ''} hover:bg-zinc-50/50`}>
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-base text-zinc-950 border border-zinc-200 bg-zinc-100 inline-block px-2 py-1 rounded shadow-sm">{vehicle.plate_number}</div>
                      <div className="text-zinc-600 text-xs mt-2 font-medium">
                        {vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''} - {vehicle.color}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900 flex items-center gap-2">
                        <Building className="h-4 w-4 text-zinc-400" /> {messages.apartmentPrefix} {vehicle.apartments?.apartment_number || messages.unknownApartment}
                      </div>
                      <div className="text-zinc-500 text-xs mt-1">{vehicle.profiles?.full_name || messages.notAssigned}</div>
                    </td>
                    <td className="px-6 py-4">
                      {vehicle.approval_status === VEHICLE_APPROVAL_STATUS.approved && <Badge variant="success" className="text-[10px] font-bold uppercase tracking-wider"><ShieldCheck /> {messages.statusLabels.approved}</Badge>}
                      {vehicle.approval_status === VEHICLE_APPROVAL_STATUS.pendingApproval && <Badge variant="warning" className="text-[10px] font-bold uppercase tracking-wider"><Clock /> {messages.statusLabels.pending_approval}</Badge>}
                      {vehicle.approval_status === VEHICLE_APPROVAL_STATUS.rejected && <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider"><Ban /> {messages.statusLabels.rejected}</Badge>}
                      {vehicle.approval_status === VEHICLE_APPROVAL_STATUS.archived && <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider"><Archive /> {messages.statusLabels.archived}</Badge>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="secondary" size="sm" onClick={() => setSelectedVehicleInfo(vehicle)} className="h-8 text-xs font-bold shadow-sm border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700">
                        <Info className="h-3.5 w-3.5 mr-1" /> {messages.info}
                      </Button>
                    </td>
                  </tr>
                ))}
                {processedVehicles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <EmptyState icon={Car} title={messages.emptyTitle} description={messages.emptyDescription} className="rounded-none border-0 bg-transparent" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedVehicleInfo && (
        <VehicleInfoModal
          vehicle={selectedVehicleInfo}
          reason={actionReason}
          setReason={setActionReason}
          processingId={isProcessing}
          archiveId={ADMIN_VEHICLES_CONFIG.processingIds.archive}
          onClose={() => setSelectedVehicleInfo(null)}
          onStatusChange={handleStatusChange}
          onArchive={handleArchiveVehicle}
        />
      )}

      {addVehicleModal && (
        <AddVehicleModal
          apartments={allApartments}
          isProcessing={isProcessing === ADMIN_VEHICLES_CONFIG.processingIds.addVehicle}
          onSubmit={handleAddVehicle}
          onCancel={() => setAddVehicleModal(false)}
        />
      )}
    </main>
  );
}
