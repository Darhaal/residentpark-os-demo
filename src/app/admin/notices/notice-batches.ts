// Title: Notice Batch View Model
// Path: src/app/admin/notices/notice-batches.ts
// Functionality: Groups recipient notice rows into stable, presentation-ready delivery batches.

import type { NoticeRow } from '@/actions/notices';
import { ADMIN_NOTICES_CONFIG } from '@/config/admin-clients';
import { en } from '@/localization/en';
import type { AdminNoticeType, NoticeBatch } from './admin-notices-types';

const noticeTypes = ADMIN_NOTICES_CONFIG.noticeTypes;
const messages = en.adminNotices;

function isNoticeType(value: string): value is AdminNoticeType {
  return noticeTypes.includes(value as AdminNoticeType);
}

export function formatNoticeType(noticeType: string) {
  return isNoticeType(noticeType)
    ? messages.noticeTypeLabels[noticeType]
    : noticeType.replace(/_/g, ' ');
}

export function buildNoticeBatches(notices: NoticeRow[]): NoticeBatch[] {
  const batches = new Map<string, NoticeBatch>();

  for (const notice of notices) {
    const batch = batches.get(notice.batch_id);
    if (batch) {
      batch.recipients += 1;
      if (notice.read_at) batch.read += 1;
      continue;
    }

    batches.set(notice.batch_id, {
      batch_id: notice.batch_id,
      title: notice.title,
      body: notice.body,
      type: notice.type,
      created_at: notice.created_at,
      recipients: 1,
      read: notice.read_at ? 1 : 0,
    });
  }

  return Array.from(batches.values()).sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
}
