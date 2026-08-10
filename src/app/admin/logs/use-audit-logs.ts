// Title: Audit Logs State Hook
// Path: src/app/admin/logs/use-audit-logs.ts
// Functionality: Owns all state, realtime streaming, polling failsafe, filtering,
//   pagination, manual-note creation and CSV export for the superadmin audit log.
//   Presentational pieces consume the returned values. Extracted from AuditLogsClient.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  createManualEventAction,
  loadAuditLogsAction,
} from '@/actions/audit';
import type { AuditLog } from '@/services/AuditService';
import { en } from '@/localization/en';
import { PAGE_LIMITS, TIME_UNITS, UI_TIMING } from '@/config/limits';
import { ROUTES } from '@/config/routes';
import { buildLogQuery, escapeCSV, getErrorMessage, type ManualLogDraft } from './audit-logs-utils';

const PAGE_SIZE = PAGE_LIMITS.auditLogs;
const FAILSAFE_POLLING_INTERVAL_MS = TIME_UNITS.minuteMs;

export interface AuditLogsClientProps {
  initialLogs: AuditLog[];
  initialHasMore: boolean;
  initialFilters: {
    search: string;
    action: string;
    from: string;
    to: string;
  };
}

export function useAuditLogs({ initialLogs, initialHasMore, initialFilters }: AuditLogsClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const t = en.adminLogs;
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialFilters.search);
  const [filterAction, setFilterAction] = useState(initialFilters.action || 'ALL');
  const [dateFrom, setDateFrom] = useState(initialFilters.from);
  const [dateTo, setDateTo] = useState(initialFilters.to);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingLog, setIsCreatingLog] = useState(false);
  const [newLog, setNewLog] = useState<ManualLogDraft>({
    domain: 'system',
    actionType: 'ADMIN_MANUAL_NOTE',
    severity: 'info',
    description: '',
  });

  const filters = useMemo(() => ({
    search: searchQuery,
    action: filterAction,
    from: dateFrom,
    to: dateTo,
  }), [searchQuery, filterAction, dateFrom, dateTo]);

  const isViewingHistory = Boolean(dateFrom || dateTo || searchQuery.trim() || filterAction !== 'ALL');
  const displayLiveActive = !isViewingHistory && isLiveActive;

  useEffect(() => {
    const timer = setTimeout(() => {
      const query = buildLogQuery(filters);
      router.replace(query ? `${ROUTES.admin.logs}?${query}` : ROUTES.admin.logs, { scroll: false });
    }, UI_TIMING.searchDebounceMs);

    return () => clearTimeout(timer);
  }, [filters, router]);

  const fetchLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    setError(null);

    try {
      const res = await loadAuditLogsAction({
        limit: PAGE_SIZE,
        search: searchQuery || null,
        actionFilter: filterAction,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      });

      if (!res.success) {
        setError(res.error || t.loadError);
        return;
      }

      setLogs(res.logs);
      setHasMore(res.hasMore);
    } catch (err) {
      setError(getErrorMessage(err, t.loadError));
    } finally {
      setIsRefreshing(false);
    }
  }, [searchQuery, filterAction, dateFrom, dateTo, t.loadError]);

  useEffect(() => {
    if (isViewingHistory) return;

    let isMounted = true;
    const channel = supabase
      .channel('public:audit_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, async payload => {
        const insertedId = typeof payload.new.id === 'string' ? payload.new.id : null;
        if (!insertedId) return;

        try {
          const res = await loadAuditLogsAction({ limit: 1, search: insertedId });
          if (!res.success || !res.logs[0] || !isMounted) return;
          const formattedLog = res.logs[0];
          setLogs(prev => {
            if (prev.some(log => log.id === formattedLog.id)) return prev;
            return [formattedLog, ...prev];
          });
        } catch (err) {
          console.error('Realtime fetch error:', err);
        }
      })
      .subscribe(status => {
        if (isMounted) setIsLiveActive(status === 'SUBSCRIBED');
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, isViewingHistory]);

  useEffect(() => {
    if (isViewingHistory) return;
    const failsafeInterval = setInterval(() => {
      if (!isLiveActive && !error) void fetchLogs(false);
    }, FAILSAFE_POLLING_INTERVAL_MS);

    return () => clearInterval(failsafeInterval);
  }, [isViewingHistory, isLiveActive, fetchLogs, error]);

  const handleLoadMore = async () => {
    if (!hasMore || logs.length === 0) return;
    setIsLoadingMore(true);
    setError(null);

    try {
      const lastLog = logs[logs.length - 1];
      const res = await loadAuditLogsAction({
        cursorCreatedAt: lastLog.created_at,
        cursorId: lastLog.id,
        limit: PAGE_SIZE,
        search: searchQuery || null,
        actionFilter: filterAction,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      });

      if (!res.success) {
        setError(res.error || t.loadOlderError);
        return;
      }

      setLogs(prev => [...prev, ...res.logs]);
      setHasMore(res.hasMore);
    } catch (err) {
      setError(getErrorMessage(err, t.loadOlderError));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleCreateManualLog = async () => {
    if (!newLog.description.trim()) return;
    setIsCreatingLog(true);

    const res = await createManualEventAction({
      domain: newLog.domain,
      actionType: newLog.actionType,
      severity: newLog.severity,
      description: newLog.description,
    });

    if (res.success) {
      setSuccessMessage(t.createSuccess);
      setIsCreateModalOpen(false);
      setNewLog({ domain: 'system', actionType: 'ADMIN_MANUAL_NOTE', severity: 'info', description: '' });
      setTimeout(() => setSuccessMessage(null), UI_TIMING.successToastMs);
      await fetchLogs(true);
    } else {
      setError(res.error || t.createError);
    }
    setIsCreatingLog(false);
  };

  const handleExportFullCSV = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const res = await loadAuditLogsAction({
        limit: PAGE_LIMITS.auditLogsExport,
        search: searchQuery || null,
        actionFilter: filterAction,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      });

      if (!res.success) throw new Error(res.error || t.exportError);
      if (res.logs.length === 0) throw new Error(t.noExportData);

      const headers = ['Timestamp (UTC)', 'Actor Email', 'Actor Role', 'IP Address', 'Action Type', 'Entity Type', 'Entity ID', 'Description'];
      const csvRows = res.logs.map(log => [
        escapeCSV(log.created_at),
        escapeCSV(log.actor_email_snapshot || log.admin_email || 'System'),
        escapeCSV(log.actor_role_snapshot || 'N/A'),
        escapeCSV(log.ip_address || 'Unknown'),
        escapeCSV(log.action_type),
        escapeCSV(log.entity_type || ''),
        escapeCSV(log.entity_id || ''),
        escapeCSV(log.description || ''),
      ].join(','));

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.map(escapeCSV).join(','), ...csvRows].join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csvContent));
      link.setAttribute('download', `audit_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMessage(t.exportSuccess);
      setTimeout(() => setSuccessMessage(null), UI_TIMING.successToastMs);
    } catch (err) {
      setError(getErrorMessage(err, t.exportError));
    } finally {
      setIsExporting(false);
    }
  };

  return {
    // data + status
    logs, hasMore, isRefreshing, isLoadingMore, isExporting, error, successMessage, displayLiveActive,
    // filters
    searchQuery, setSearchQuery, filterAction, setFilterAction, dateFrom, setDateFrom, dateTo, setDateTo,
    // detail + create modal
    selectedLog, setSelectedLog,
    isCreateModalOpen, setIsCreateModalOpen, isCreatingLog, newLog, setNewLog,
    // actions
    fetchLogs, handleLoadMore, handleCreateManualLog, handleExportFullCSV,
  };
}
