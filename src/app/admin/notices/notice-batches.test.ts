// Title: Notice Batch View Model Test
// Path: src/app/admin/notices/notice-batches.test.ts
// Functionality: Unit coverage for notice delivery grouping, read totals, ordering, and labels.

import { describe, expect, it } from 'vitest';
import type { NoticeRow } from '@/actions/notices';
import { buildNoticeBatches, formatNoticeType } from './notice-batches';

function notice(overrides: Partial<NoticeRow>): NoticeRow {
  return {
    id: 'notice-1',
    batch_id: 'batch-1',
    recipient_id: 'resident-1',
    title: 'Garage update',
    body: '<p>Move by 8 AM.</p>',
    type: 'announcement',
    created_at: '2026-06-24T10:00:00.000Z',
    read_at: null,
    ...overrides,
  };
}

describe('notice batch view model', () => {
  it('groups recipient rows, counts reads, and returns newest batches first', () => {
    const batches = buildNoticeBatches([
      notice({ id: 'notice-1', recipient_id: 'resident-1' }),
      notice({ id: 'notice-2', recipient_id: 'resident-2', read_at: '2026-06-24T11:00:00.000Z' }),
      notice({
        id: 'notice-3',
        batch_id: 'batch-2',
        recipient_id: 'resident-3',
        title: 'Water shutdown',
        created_at: '2026-06-25T10:00:00.000Z',
        read_at: '2026-06-25T11:00:00.000Z',
      }),
    ]);

    expect(batches).toEqual([
      expect.objectContaining({ batch_id: 'batch-2', recipients: 1, read: 1 }),
      expect.objectContaining({ batch_id: 'batch-1', recipients: 2, read: 1 }),
    ]);
  });

  it('uses localized labels for known types and readable fallback labels for unknown types', () => {
    expect(formatNoticeType('construction_notice')).toBe('Construction notice');
    expect(formatNoticeType('custom_event')).toBe('custom event');
  });
});
