// Title: Notification Bell
// Path: src/components/NotificationBell.tsx
// Functionality: Header notification trigger that loads resident/admin alerts and unread counts.

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui/spinner';
// Types only — the actual fetches are direct client queries (no Server Actions on read
// paths to avoid the Next.js 14 behaviour where any Server Action call from a Client
// Component triggers a full Router Cache re-validation, which shows up as a flood of
// GET / or GET /admin requests in the server log).
import type {
  AdminNotifAccount,
  AdminNotifVehicle,
  AdminNotifIssue,
  ResidentNotifItem,
} from '@/actions/notification-bell';
import { markNoticeReadAction, markAllNoticesReadAction } from '@/actions/notices';
import { en } from '@/localization/en';
import { ACCOUNT_STATUS, PARKING_ISSUE_STATUS, VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { NOTIFICATION_CONFIG, PAGE_LIMITS, UI_TIMING } from '@/config/limits';
import { ROUTES } from '@/config/routes';
import { AdminItems, ResidentItems } from './NotificationItems';

interface Props {
  isAdmin: boolean;
}

export function NotificationBell({ isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [accounts, setAccounts] = useState<AdminNotifAccount[]>([]);
  const [vehicles, setVehicles] = useState<AdminNotifVehicle[]>([]);
  const [issues, setIssues] = useState<AdminNotifIssue[]>([]);
  const [notices, setNotices] = useState<ResidentNotifItem[]>([]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Admin: real-time alert count
  useEffect(() => {
    if (!isAdmin) return;
    const supabase = createClient();

    const fetchCount = async () => {
      const [a, v, i] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('approval_status', ACCOUNT_STATUS.pendingApproval),
        supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('approval_status', VEHICLE_APPROVAL_STATUS.pendingApproval),
        supabase.from('parking_issues').select('id', { count: 'exact', head: true }).in('status', [PARKING_ISSUE_STATUS.open, PARKING_ISSUE_STATUS.inProgress]),
      ]);
      setCount((a.count ?? 0) + (v.count ?? 0) + (i.count ?? 0));
    };

    fetchCount();
    const ch = supabase.channel('notif-bell-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `approval_status=eq.${ACCOUNT_STATUS.pendingApproval}` }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles', filter: `approval_status=eq.${VEHICLE_APPROVAL_STATUS.pendingApproval}` }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_issues' }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  // Resident: real-time unread count
  useEffect(() => {
    if (isAdmin) return;
    const supabase = createClient();

    const fetchUnread = async () => {
      const { count: c } = await supabase.from('notices').select('id', { count: 'exact', head: true }).is('read_at', null);
      setCount(c ?? 0);
    };

    fetchUnread();
    const ch = supabase.channel('notif-bell-resident')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, fetchUnread)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  // ESC closes the popover (restoring focus to the bell); an outside click also closes it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); bellRef.current?.focus(); }
    };
    const onOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [open]);

  // Direct client-side reads — no Server Action calls here.
  // Reason: in Next.js 14, any programmatic Server Action call from a Client Component
  // automatically triggers a Router Cache re-validation (GET request to current route).
  // For read-only notification preview data, the Supabase client with RLS is sufficient.
  const fetchItems = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      if (isAdmin) {
        type AptRow = { apartment_number: string | null };
        const aptUnit = (apt: AptRow | AptRow[] | null | undefined) =>
          !apt ? null : (Array.isArray(apt) ? apt[0] : apt)?.apartment_number ?? null;

        const [accountsRes, vehiclesRes, issuesRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, apartments!profiles_apartment_id_fkey(apartment_number)')
            .eq('approval_status', ACCOUNT_STATUS.pendingApproval)
            .order('created_at', { ascending: true })
            .limit(PAGE_LIMITS.notificationAccounts),
          supabase
            .from('vehicles')
            .select('id, plate_number, make, apartments(apartment_number)')
            .eq('approval_status', VEHICLE_APPROVAL_STATUS.pendingApproval)
            .order('created_at', { ascending: true })
            .limit(PAGE_LIMITS.notificationVehicles),
          supabase
            .from('parking_issues')
            .select('id, issue_type')
            .in('status', [PARKING_ISSUE_STATUS.open, PARKING_ISSUE_STATUS.inProgress])
            .order('created_at', { ascending: true })
            .limit(PAGE_LIMITS.notificationIssues),
        ]);

        if (!accountsRes.error)
          setAccounts(
            ((accountsRes.data ?? []) as Array<{ id: string; full_name: string | null; apartments: AptRow | AptRow[] | null }>)
              .map(r => ({ id: r.id, full_name: r.full_name, unit: aptUnit(r.apartments) }))
          );
        if (!vehiclesRes.error)
          setVehicles(
            ((vehiclesRes.data ?? []) as Array<{ id: string; plate_number: string; make: string | null; apartments: AptRow | AptRow[] | null }>)
              .map(r => ({ id: r.id, plate_number: r.plate_number, make: r.make, unit: aptUnit(r.apartments) }))
          );
        if (!issuesRes.error)
          setIssues((issuesRes.data ?? []).map(r => ({ id: r.id as string, issue_type: r.issue_type as string })));
      } else {
        const { data } = await supabase
          .from('notices')
          .select('id, title, body, type, created_at, read_at')
          .order('created_at', { ascending: false })
          .limit(PAGE_LIMITS.residentNotifications);
        if (data) setNotices(data as ResidentNotifItem[]);
      }
    } catch {
      // Swallow errors — the bell stays empty rather than crashing the nav.
    }

    setLoading(false);
  }, [isAdmin]);

  const openPopover = useCallback(() => {
    setOpen(true);
    fetchItems();
  }, [fetchItems]);

  // Hover: open after short delay; close after leaving entire wrapper
  const onMouseEnter = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (!open) openTimer.current = setTimeout(openPopover, UI_TIMING.notificationOpenDelayMs);
  };
  const onMouseLeave = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    closeTimer.current = setTimeout(() => setOpen(false), UI_TIMING.notificationCloseDelayMs);
  };

  // Click: toggle (works on touch / keyboard)
  const onBellClick = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (open) { setOpen(false); } else { openPopover(); }
  };

  const handleMarkRead = async (id: string) => {
    await markNoticeReadAction(id);
    setNotices(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNoticesReadAction();
    setNotices(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setCount(0);
  };

  const isEmpty = isAdmin
    ? accounts.length === 0 && vehicles.length === 0 && issues.length === 0
    : notices.length === 0;

  const viewAllHref = isAdmin
    ? (issues.length > 0 ? ROUTES.admin.issues : ROUTES.admin.approvals)
    : ROUTES.notices;

  return (
    <div ref={wrapperRef} className="relative" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={onBellClick}
        aria-label={en.notificationBell.ariaLabel}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? 'notification-popover' : undefined}
        className={`relative p-2 rounded-lg transition-colors ${open ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full bg-destructive text-[9px] font-semibold text-white ring-2 ring-background">
            {count > NOTIFICATION_CONFIG.maxBadgeCount ? `${NOTIFICATION_CONFIG.maxBadgeCount}+` : count}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div id="notification-popover" role="region" aria-label={en.notificationBell.title} className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-zinc-200 shadow-2xl shadow-zinc-200/80 z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-50/60">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">{en.notificationBell.title}</span>
            </div>
            {!isAdmin && count > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-700 font-semibold transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" /> {en.notificationBell.markAllRead}
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner className="size-5 text-zinc-300" />
              </div>
            ) : isEmpty ? (
              <div className="flex flex-col items-center justify-center py-10 px-4">
                <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                  <Bell className="h-5 w-5 text-zinc-300" />
                </div>
                <p className="text-sm font-bold text-zinc-500">{en.notificationBell.allClearTitle}</p>
                <p className="text-xs text-zinc-400 mt-1">{en.notificationBell.allClearDescription}</p>
              </div>
            ) : isAdmin ? (
              <AdminItems
                accounts={accounts}
                vehicles={vehicles}
                issues={issues}
                onClose={() => setOpen(false)}
              />
            ) : (
              <ResidentItems
                notices={notices}
                onMarkRead={handleMarkRead}
              />
            )}
          </div>

          {/* Footer */}
          {!loading && (
            <div className="border-t border-zinc-100 px-4 py-2.5 bg-zinc-50/40">
              <Link
                href={viewAllHref}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                {en.notificationBell.viewAll} <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

