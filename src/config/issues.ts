// Title: Issues Configuration
// Path: src/config/issues.ts
// Functionality: Centralized configuration values and UI metadata for parking issue workflows.

import { en } from '@/localization/en';
import { PARKING_ISSUE_TYPE } from '@/config/domain';

export const PARKING_ISSUE_LABELS: Record<string, string> = {
  [PARKING_ISSUE_TYPE.unauthorizedVehicle]: en.notificationBell.issueLabels.unauthorizedVehicle,
  [PARKING_ISSUE_TYPE.wrongPlate]: en.notificationBell.issueLabels.wrongPlate,
  [PARKING_ISSUE_TYPE.blockedAccess]: en.notificationBell.issueLabels.blockedAccess,
  [PARKING_ISSUE_TYPE.damaged]: en.notificationBell.issueLabels.damaged,
  [PARKING_ISSUE_TYPE.maintenance]: en.notificationBell.issueLabels.maintenance,
  [PARKING_ISSUE_TYPE.safety]: en.notificationBell.issueLabels.safety,
  [PARKING_ISSUE_TYPE.other]: en.notificationBell.issueLabels.other,
} as const;

export const RESIDENT_PARKING_ISSUE_OPTIONS = [
  { value: PARKING_ISSUE_TYPE.unauthorizedVehicle, label: en.notificationBell.issueLabels.unauthorizedVehicle },
  { value: PARKING_ISSUE_TYPE.blockedAccess, label: en.notificationBell.issueLabels.blockedAccess },
  { value: PARKING_ISSUE_TYPE.maintenance, label: en.notificationBell.issueLabels.maintenance },
  { value: PARKING_ISSUE_TYPE.safety, label: en.notificationBell.issueLabels.safety },
  { value: PARKING_ISSUE_TYPE.other, label: en.notificationBell.issueLabels.other },
] as const;
