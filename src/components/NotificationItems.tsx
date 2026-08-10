// Title: Notification Items
// Path: src/components/NotificationItems.tsx
// Functionality: Shared notification list rendering for alerts, notices, and operational updates.

// Presentational notification lists for the bell popover (admin alert sections and
// resident notices). State, fetching, and realtime live in NotificationBell.

'use client';

import Link from 'next/link';
import { AlertTriangle, Car, ChevronRight, User } from 'lucide-react';
import type {
  AdminNotifAccount,
  AdminNotifVehicle,
  AdminNotifIssue,
  ResidentNotifItem,
} from '@/actions/notification-bell';
import { formatShortDate } from '@/lib/dates';
import { en } from '@/localization/en';
import { PARKING_ISSUE_LABELS } from '@/config/issues';
import { TIME_UNITS } from '@/config/limits';
import { ROUTES } from '@/config/routes';
import { stripHtml } from '@/lib/html';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / TIME_UNITS.minuteMs);
  if (minutes < 2) return en.notificationBell.time.justNow;
  if (minutes < TIME_UNITS.hourMinutes) return `${minutes}${en.notificationBell.time.minuteSuffix}`;
  const hours = Math.floor(minutes / TIME_UNITS.hourMinutes);
  if (hours < TIME_UNITS.dayHours) return `${hours}${en.notificationBell.time.hourSuffix}`;
  const days = Math.floor(hours / TIME_UNITS.dayHours);
  if (days === 1) return en.notificationBell.time.yesterday;
  if (days < TIME_UNITS.weekDays) return `${days}${en.notificationBell.time.daySuffix}`;
  return formatShortDate(iso);
}

function NotifSection({
  label, count, icon: Icon, iconClass, children,
}: {
  label: string; count: number;
  icon: React.ElementType; iconClass: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 border-b border-zinc-100">
        <Icon className={`h-3 w-3 ${iconClass}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex-1">{label}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-200 text-zinc-600">{count}</span>
      </div>
      {children}
    </div>
  );
}

export function AdminItems({ accounts, vehicles, issues, onClose }: {
  accounts: AdminNotifAccount[];
  vehicles: AdminNotifVehicle[];
  issues: AdminNotifIssue[];
  onClose: () => void;
}) {
  return (
    <div className="divide-y divide-zinc-100">
      {issues.length > 0 && (
        <NotifSection label={en.notificationBell.sections.incidents} count={issues.length} icon={AlertTriangle} iconClass="text-destructive">
          {issues.map(i => (
            <Link
              key={i.id} href={ROUTES.admin.issues} onClick={onClose}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors group"
            >
              <div className="h-6 w-6 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              </div>
              <span className="text-xs text-zinc-700 truncate flex-1">
                {PARKING_ISSUE_LABELS[i.issue_type] ?? i.issue_type}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          ))}
        </NotifSection>
      )}

      {accounts.length > 0 && (
        <NotifSection label={en.notificationBell.sections.pendingAccounts} count={accounts.length} icon={User} iconClass="text-info">
          {accounts.map(a => (
            <Link
              key={a.id} href={ROUTES.admin.approvals} onClick={onClose}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors group"
            >
              <div className="h-6 w-6 rounded-md bg-zinc-100 flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-zinc-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-800 truncate">{a.full_name ?? en.notificationBell.unnamedResident}</p>
                {a.unit && <p className="text-[10px] text-zinc-400">{en.notificationBell.unitPrefix} {a.unit}</p>}
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          ))}
        </NotifSection>
      )}

      {vehicles.length > 0 && (
        <NotifSection label={en.notificationBell.sections.pendingVehicles} count={vehicles.length} icon={Car} iconClass="text-warning">
          {vehicles.map(v => (
            <Link
              key={v.id} href={ROUTES.admin.approvals} onClick={onClose}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors group"
            >
              <div className="h-6 w-6 rounded-md bg-warning/10 flex items-center justify-center shrink-0">
                <Car className="h-3.5 w-3.5 text-warning" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-800 truncate">{v.plate_number}{v.make ? ` · ${v.make}` : ''}</p>
                {v.unit && <p className="text-[10px] text-zinc-400">{en.notificationBell.unitPrefix} {v.unit}</p>}
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          ))}
        </NotifSection>
      )}
    </div>
  );
}

export function ResidentItems({ notices, onMarkRead }: {
  notices: ResidentNotifItem[];
  onMarkRead: (id: string) => void;
}) {
  return (
    <div className="divide-y divide-zinc-100">
      {notices.map(n => {
        const unread = !n.read_at;
        return (
          <div
            key={n.id}
            onClick={() => unread && onMarkRead(n.id)}
            className={`flex gap-3 px-4 py-3 transition-colors ${unread ? 'cursor-pointer hover:bg-info/10 bg-info/5' : 'hover:bg-zinc-50'}`}
          >
            <div className="shrink-0 mt-1.5">
              <span className={`block h-2 w-2 rounded-full ${unread ? 'bg-info' : 'bg-zinc-200'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-xs truncate ${unread ? 'font-bold text-zinc-900' : 'font-medium text-zinc-500'}`}>
                  {n.title}
                </p>
                <span className="text-[10px] text-zinc-400 whitespace-nowrap shrink-0 mt-0.5">
                  {timeAgo(n.created_at)}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate mt-0.5">{stripHtml(n.body)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
