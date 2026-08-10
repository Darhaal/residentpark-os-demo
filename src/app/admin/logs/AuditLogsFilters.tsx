// Title: Audit Logs Filters
// Path: src/app/admin/logs/AuditLogsFilters.tsx
// Functionality: Search box, action-type dropdown and from/to date range for the
//   superadmin audit log.

'use client';

import { Calendar, Filter, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { en } from '@/localization/en';
import { ACTION_TYPES } from './audit-logs-utils';

interface AuditLogsFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filterAction: string;
  setFilterAction: (value: string) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
}

export function AuditLogsFilters({
  searchQuery,
  setSearchQuery,
  filterAction,
  setFilterAction,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}: AuditLogsFiltersProps) {
  const t = en.adminLogs;

  return (
    <section className="grid grid-cols-1 gap-3 rounded-md border border-border bg-card p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="text" aria-label={t.searchAriaLabel} placeholder={t.searchPlaceholder} value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="h-9 bg-background pl-9 shadow-none" />
      </div>
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <select aria-label={t.filterAriaLabel} value={filterAction} onChange={event => setFilterAction(event.target.value)} className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm font-medium text-foreground shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
          <option value="ALL">{t.allActions}</option>
          {ACTION_TYPES.map(type => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="date" aria-label={t.fromDateAriaLabel} value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="h-9 bg-background pl-9 text-sm text-foreground shadow-none" />
      </div>
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="date" aria-label={t.toDateAriaLabel} value={dateTo} onChange={event => setDateTo(event.target.value)} className="h-9 bg-background pl-9 text-sm text-foreground shadow-none" />
      </div>
    </section>
  );
}
