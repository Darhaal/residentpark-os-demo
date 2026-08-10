// Title: Index Localization
// Path: src/localization/en/index.ts
// Functionality: English localization strings for application screens, actions, and empty states.

import { adminApartments } from './admin-apartments';
import { adminApprovals } from './admin-approvals';
import { adminParking } from './admin-parking';
import { adminDisruptions } from './admin-disruptions';
import { adminIssues } from './admin-issues';
import { adminLogs } from './admin-logs';
import { adminNotices } from './admin-notices';
import { adminReports } from './admin-reports';
import { adminSettings } from './admin-settings';
import { adminUsers } from './admin-users';
import { adminVehicles } from './admin-vehicles';
import { auth } from './auth';
import { common } from './common';
import { globalSearch } from './global-search';
import { help } from './help';
import { invitations } from './invitations';
import { legal } from './legal';
import { navigation } from './navigation';
import { notificationBell } from './notifications';
import { profile } from './profile';
import { rateLimitMessages } from './rate-limits';
import { richEditor } from './rich-editor';
import { residentDashboard, residentParkingMap, residentParkingPage } from './resident';
import { residentNotices } from './resident-notices';
import { retiredRoutes } from './routes';
import { vehicleForm } from './vehicle-form';

export const en = {
  navigation,
  auth,
  common,
  adminParking,
  adminDisruptions,
  adminIssues,
  adminLogs,
  adminNotices,
  adminReports,
  adminSettings,
  invitations,
  profile,
  rateLimitMessages,
  residentDashboard,
  notificationBell,
  globalSearch,
  help,
  richEditor,
  residentParkingMap,
  residentParkingPage,
  residentNotices,
  vehicleForm,
  adminVehicles,
  adminApprovals,
  adminUsers,
  adminApartments,
  retiredRoutes,
  legal,
} as const;

export type EnglishLocalization = typeof en;
