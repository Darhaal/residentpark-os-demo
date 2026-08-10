// Title: Resident Notices Localization
// Path: src/localization/en/resident-notices.ts
// Functionality: English localization strings for application screens, actions, and empty states.

import { noticeMessages } from './notices';

export const residentNotices = {
  pageTitle: 'Notices',
  unavailableTitle: 'Notices unavailable',
  unavailableDescription: 'Your notices could not be loaded. Apply migration 0057 and try again.',
  summaryAria: 'Notice summary',
  summary: {
    total: 'Total notices',
    unread: 'Unread',
    read: 'Read',
  },
  listTitle: 'Notice Inbox',
  listDescription: 'Unread notices can be selected to mark them read.',
  unreadCount: (count: number) => `${count} unread`,
  allCaughtUp: 'All caught up.',
  markAllRead: 'Mark all read',
  markReadError: 'Failed to mark notice as read.',
  markAllReadError: 'Failed to mark notices as read.',
  emptyTitle: 'No notices',
  emptyDescription: 'Management notices will appear here.',
  noticeTypeLabels: noticeMessages.typeLabels,
  unreadStatus: 'Unread notice',
  readStatus: 'Read notice',
  noticeAriaMarkRead: (title: string) => `${title}. Unread. Select to mark read.`,
  noticeAriaRead: (title: string) => `${title}. Read.`,
  selectToMarkRead: 'Select to mark read',
  backToDashboard: 'Back to dashboard',
  actionErrors: {
    loadNotices: 'Failed to load notices.',
    markRead: 'Failed to mark notice as read.',
    markAllRead: 'Failed to mark notices as read.',
  },
} as const;
