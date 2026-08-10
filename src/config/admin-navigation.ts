// Title: Admin Navigation Configuration
// Path: src/config/admin-navigation.ts
// Functionality: Centralized configuration values and UI metadata for application workflows.

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Car,
  ClipboardCheck,
  Construction,
  FileClock,
  Map as MapIcon,
  Megaphone,
  Settings,
  UploadCloud,
  UserCog,
} from 'lucide-react';
import { pathMatchesRoute, ROUTES } from '@/config/routes';
import { en } from '@/localization/en';

export type AdminNavigationTab = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  group: 'workspace' | 'operations' | 'records' | 'system';
  superadminOnly?: boolean;
  mobileShortcut?: boolean;
};

const labels = en.navigation.adminTabs;

export const ADMIN_NAVIGATION_TABS: readonly AdminNavigationTab[] = [
  {
    href: ROUTES.admin.reports,
    label: labels.reports,
    shortLabel: labels.reports,
    icon: BarChart3,
    group: 'workspace',
    mobileShortcut: true,
  },
  {
    href: ROUTES.admin.parking,
    label: labels.parking,
    shortLabel: labels.parking,
    icon: MapIcon,
    group: 'operations',
    mobileShortcut: true,
  },
  {
    href: ROUTES.admin.approvals,
    label: labels.approvals,
    shortLabel: labels.approvalsShort,
    icon: ClipboardCheck,
    group: 'workspace',
    mobileShortcut: true,
  },
  {
    href: ROUTES.admin.issues,
    label: labels.issues,
    shortLabel: labels.issuesShort,
    icon: AlertTriangle,
    group: 'operations',
    mobileShortcut: true,
  },
  {
    href: ROUTES.admin.disruptions,
    label: labels.disruptions,
    shortLabel: labels.disruptionsShort,
    icon: Construction,
    group: 'operations',
  },
  {
    href: ROUTES.admin.apartments,
    label: labels.apartments,
    shortLabel: labels.apartmentsShort,
    icon: Building2,
    group: 'records',
  },
  {
    href: ROUTES.admin.vehicles,
    label: labels.vehicles,
    shortLabel: labels.vehicles,
    icon: Car,
    group: 'records',
  },
  {
    href: ROUTES.admin.users,
    label: labels.users,
    shortLabel: labels.usersShort,
    icon: UserCog,
    group: 'records',
  },
  {
    href: ROUTES.admin.invites,
    label: labels.invites,
    shortLabel: labels.invitesShort,
    icon: UploadCloud,
    group: 'workspace',
  },
  {
    href: ROUTES.admin.notices,
    label: labels.notices,
    shortLabel: labels.notices,
    icon: Megaphone,
    group: 'workspace',
  },
  {
    href: ROUTES.admin.settings,
    label: labels.settings,
    shortLabel: labels.settings,
    icon: Settings,
    group: 'system',
  },
  {
    href: ROUTES.admin.logs,
    label: labels.auditLogs,
    shortLabel: labels.auditShort,
    icon: FileClock,
    group: 'system',
    superadminOnly: true,
  },
];

export const getVisibleAdminTabs = (isSuperadmin: boolean) =>
  ADMIN_NAVIGATION_TABS.filter(tab => !tab.superadminOnly || isSuperadmin);

export const getVisibleAdminMobileShortcuts = (isSuperadmin: boolean) =>
  getVisibleAdminTabs(isSuperadmin).filter(tab => tab.mobileShortcut);

export const isAdminNavigationTabActive = (pathname: string, href: string) => {
  if (pathname === ROUTES.admin.root && href === ROUTES.admin.reports) return true;
  return pathMatchesRoute(pathname, href);
};
