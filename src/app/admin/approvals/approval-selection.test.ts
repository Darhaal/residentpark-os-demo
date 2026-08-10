// Title: Approval Selection Helpers Test
// Path: src/app/admin/approvals/approval-selection.test.ts
// Functionality: Unit coverage for immutable row, select-all, clear-all, and processed-row transitions.

import { describe, expect, it } from 'vitest';
import {
  removeApprovalSelection,
  toggleAllApprovalSelections,
  toggleApprovalSelection,
} from './approval-selection';

describe('approval selection helpers', () => {
  it('toggles one ID without mutating the current set', () => {
    const current = new Set(['account-1']);
    const next = toggleApprovalSelection(current, 'account-2');

    expect(Array.from(current)).toEqual(['account-1']);
    expect(Array.from(next)).toEqual(['account-1', 'account-2']);
    expect(Array.from(toggleApprovalSelection(next, 'account-1'))).toEqual(['account-2']);
  });

  it('selects every visible ID and clears a fully selected queue', () => {
    const selected = toggleAllApprovalSelections(new Set(), ['account-1', 'account-2']);
    expect(Array.from(selected)).toEqual(['account-1', 'account-2']);
    expect(toggleAllApprovalSelections(selected, ['account-1', 'account-2']).size).toBe(0);
  });

  it('removes a processed ID while preserving unrelated selections', () => {
    expect(Array.from(removeApprovalSelection(new Set(['account-1', 'account-2']), 'account-1')))
      .toEqual(['account-2']);
  });
});
