// Title: Admin Notices Types
// Path: src/app/admin/notices/admin-notices-types.ts
// Functionality: Shared view-model and component contracts for the admin notices workspace.

import type { NoticeRow } from '@/actions/notices';
import { ADMIN_NOTICES_CONFIG } from '@/config/admin-clients';

export type NoticeAudience = (typeof ADMIN_NOTICES_CONFIG.audiences)[keyof typeof ADMIN_NOTICES_CONFIG.audiences];
export type AdminNoticeType = (typeof ADMIN_NOTICES_CONFIG.noticeTypes)[number];

export interface NoticeApartment {
  id: string;
  apartment_number: string;
}

export interface NoticeResident {
  id: string;
  full_name: string | null;
  email: string | null;
  unit: string | null;
}

export interface NoticeBatch {
  batch_id: string;
  title: string;
  body: string;
  type: string;
  created_at: string;
  recipients: number;
  read: number;
}

export interface NoticeFeedbackHandlers {
  clearFeedback: () => void;
  showError: (message: string) => void;
  showToast: (message: string) => void;
}

export interface AdminNoticesClientProps {
  notices: NoticeRow[];
  apartments: NoticeApartment[];
  residents: NoticeResident[];
  portalNotice: string;
  settingsReady: boolean;
}
