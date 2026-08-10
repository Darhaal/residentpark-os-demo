// Title: Property Directory Client
// Path: src/app/admin/apartments/ApartmentsClient.tsx
// Functionality: Filter apartments, inspect unit details, and run status overrides.

'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building, Search, Grid, List,
  ChevronRight, Users, Car, AlertTriangle, Lock, DoorOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import { useFeedback } from '@/hooks/use-feedback';
import { updateApartmentStatusAction } from '@/actions/apartments';
import { loadApartmentDetailsAction } from '@/actions/loaders';
import { ADMIN_APARTMENTS_CONFIG } from '@/config/admin-clients';
import { en as locale } from '@/localization/en';
import { APARTMENT_STATUS } from '@/config/domain';
import { ApartmentDetailDrawer } from './ApartmentDetailDrawer';
import { ApartmentStatusModal } from './ApartmentStatusModal';
import {
  APARTMENT_STATUSES,
  aptStatusVariant,
  getCount,
  getErrorMessage,
  getStatusBorderClass,
  getStatusColorClass,
  groupByFloor,
  sortApartments,
  type ApartmentDetails,
  type ApartmentListItem,
  type ApartmentStatus,
} from './apartments-types';

export type { ApartmentListItem } from './apartments-types';

interface ApartmentsClientProps {
  initialApartments: ApartmentListItem[];
}

type ViewMode = 'grid' | 'table';

const messages = locale.adminApartments;
const apartmentConfig = ADMIN_APARTMENTS_CONFIG;
const floorConfig = apartmentConfig.floorGrouping;

export function ApartmentsClient({ initialApartments }: ApartmentsClientProps) {
  const searchParams = useSearchParams();
  const { errorMsg, successMsg, showToast, showError, clearFeedback } = useFeedback();

  const [apartments, setApartments] = useState<ApartmentListItem[]>(initialApartments);
  // Seed from ?q= so Global Search results deep-link straight to the matched unit.
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<string>(apartmentConfig.filters.all);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [selectedAptId, setSelectedAptId] = useState<string | null>(null);
  const [aptDetails, setAptDetails] = useState<ApartmentDetails | null>(null);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ApartmentStatus | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  const openApartmentModal = async (id: string) => {
    setSelectedAptId(id);
    setAptDetails(null);
    setIsDrawerLoading(true);
    try {
      const res = await loadApartmentDetailsAction(id);
      if (!res.success) throw new Error(res.error || messages.loadDetailsError);
      setAptDetails(res.details as ApartmentDetails);
    } catch (error) {
      showError(getErrorMessage(error, messages.loadDetailsError));
      setSelectedAptId(null);
    } finally {
      setIsDrawerLoading(false);
    }
  };

  const closeApartmentModal = () => {
    setSelectedAptId(null);
    setAptDetails(null);
    setStatusModalOpen(false);
  };

  const promptStatusChange = (newStatus: ApartmentStatus) => {
    setPendingStatus(newStatus);
    setStatusReason('');
    setStatusModalOpen(true);
  };

  const executeStatusChange = async () => {
    if (!selectedAptId || !pendingStatus || statusReason.trim().length < apartmentConfig.statusReasonMinLength) return;

    setIsStatusUpdating(true);
    try {
      const res = await updateApartmentStatusAction(selectedAptId, pendingStatus, statusReason);
      if (!res.success) {
        showError(res.error || messages.statusUpdateError);
        return;
      }

      showToast(messages.statusUpdatedToast(pendingStatus));
      setAptDetails(prev => prev ? { ...prev, status: pendingStatus } : prev);
      setApartments(prev => prev.map(apt => apt.id === selectedAptId ? { ...apt, status: pendingStatus } : apt));
      setStatusModalOpen(false);
    } catch (error) {
      showError(getErrorMessage(error));
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const filteredApts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return apartments.filter(apt => {
      const matchesSearch = !query || apt.apartment_number.toLowerCase().includes(query);
      const matchesStatus = statusFilter === apartmentConfig.filters.all || apt.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [apartments, searchQuery, statusFilter]);

  const groupedByFloor = useMemo(() => groupByFloor(filteredApts), [filteredApts]);
  const summary = useMemo(() => ({
    total: apartments.length,
    occupied: apartments.filter(apt => apt.status === APARTMENT_STATUS.occupied).length,
    vacant: apartments.filter(apt => apt.status === APARTMENT_STATUS.vacant).length,
  }), [apartments]);

  return (
    <main className="flex-1 overflow-y-auto bg-muted/30 px-4 py-5 pb-24 sm:px-6 lg:px-8">
      <FeedbackToasts successMsg={successMsg} errorMsg={errorMsg} onClear={clearFeedback} />

      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
              <Building className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{messages.pageTitle}</h1>
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{messages.pageDescription}</p>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border shadow-sm sm:grid-cols-3" aria-label={messages.summaryAria}>
          <DirectoryMetric icon={Building} label={messages.summary.total} value={summary.total} />
          <DirectoryMetric icon={Users} label={messages.summary.occupied} value={summary.occupied} />
          <DirectoryMetric icon={DoorOpen} label={messages.summary.vacant} value={summary.vacant} />
        </section>

        <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input type="text" aria-label={messages.searchAria} placeholder={messages.searchPlaceholder} value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="h-9 bg-background pl-9 shadow-none" />
            </div>
            <select aria-label={messages.filterAria} value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="h-9 rounded-md border border-border bg-background px-2.5 text-sm font-medium text-foreground shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-48">
              <option value={apartmentConfig.filters.all}>{messages.allStatuses}</option>
              {APARTMENT_STATUSES.map(status => <option key={status} value={status}>{messages.statusLabels[status as keyof typeof messages.statusLabels] ?? status}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-1 sm:w-fit sm:flex-row">
            <ViewModeButton icon={Grid} label={messages.visualMap} active={viewMode === 'grid'} onClick={() => setViewMode('grid')} />
            <ViewModeButton icon={List} label={messages.listView} active={viewMode === 'table'} onClick={() => setViewMode('table')} />
          </div>
        </section>

        {filteredApts.length === 0 ? (
          <EmptyState icon={Building} title={messages.emptyTitle} description={messages.emptyDescription} className="rounded-md border-border bg-card" />
        ) : viewMode === 'grid' ? (
          <div className="space-y-8 pb-10 animate-in fade-in duration-500">
            {groupedByFloor.map(([floor, units]) => (
              <section key={floor} className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">{floor === floorConfig.penthouseLabel ? messages.penthouseLevel : messages.floorLabel(floor)}</h2>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {sortApartments(units).map(apt => (
                    <button
                      key={apt.id}
                      onClick={() => openApartmentModal(apt.id)}
                      className={`group relative flex min-h-[148px] cursor-pointer flex-col overflow-hidden rounded-md border bg-card p-3 text-left shadow-sm transition-all hover:shadow-md ${getStatusBorderClass(apt.status)}`}
                    >
                      <div className={`absolute left-0 right-0 top-0 h-1 ${getStatusColorClass(apt.status)}`} />
                      {apt.status === APARTMENT_STATUS.problem && <AlertTriangle className="absolute right-3 top-3 size-4 text-destructive" aria-hidden="true" />}
                      {apt.status === APARTMENT_STATUS.restricted && <Lock className="absolute right-3 top-3 size-4 text-warning" aria-hidden="true" />}
                      <div className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{apt.apartment_number}</div>
                      <Badge variant={aptStatusVariant(apt.status)} className="mt-2 w-fit text-xs font-medium">{apt.status}</Badge>
                      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" title={messages.titles.occupants}>
                          <Users className="size-3.5" aria-hidden="true" />
                          <span className="tabular-nums text-foreground">{getCount(apt.profiles)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" title={messages.titles.vehicles}>
                          <Car className="size-3.5" aria-hidden="true" />
                          <span className="tabular-nums text-foreground">{getCount(apt.vehicles)}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm animate-in fade-in">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{messages.unitHeader}</th>
                    <th className="px-4 py-3">{messages.statusHeader}</th>
                    <th className="px-4 py-3">{messages.occupantsHeader}</th>
                    <th className="px-4 py-3">{messages.vehiclesHeader}</th>
                    <th className="px-4 py-3 text-right">{messages.viewHeader}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredApts.map(apt => (
                    <tr key={apt.id} className="cursor-pointer transition-colors hover:bg-muted/25" onClick={() => openApartmentModal(apt.id)}>
                      <td className="px-4 py-3 text-base font-semibold text-foreground">{messages.unitPrefix} {apt.apartment_number}</td>
                      <td className="px-4 py-3">
                        <Badge variant={aptStatusVariant(apt.status)} className="text-xs font-medium">{apt.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-muted-foreground">
                          <Users className="size-4" aria-hidden="true" /> {messages.residentsCount(getCount(apt.profiles))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-muted-foreground">
                          <Car className="size-4" aria-hidden="true" /> {messages.permitsCount(getCount(apt.vehicles))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="font-medium">{messages.details} <ChevronRight className="size-4" aria-hidden="true" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedAptId && (
        <ApartmentDetailDrawer
          details={aptDetails}
          isLoading={isDrawerLoading}
          onClose={closeApartmentModal}
          onPromptStatusChange={promptStatusChange}
        />
      )}

      {statusModalOpen && (
        <ApartmentStatusModal
          pendingStatus={pendingStatus}
          reason={statusReason}
          setReason={setStatusReason}
          isUpdating={isStatusUpdating}
          reasonMinLength={apartmentConfig.statusReasonMinLength}
          onCancel={() => setStatusModalOpen(false)}
          onConfirm={executeStatusChange}
        />
      )}
    </main>
  );
}

function DirectoryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 bg-card p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function ViewModeButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-w-32 ${
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
