// Title: Approval Selection Helpers
// Path: src/app/admin/approvals/approval-selection.ts
// Functionality: Provides immutable row-selection transitions shared by account and vehicle queues.

export function toggleApprovalSelection(selectedIds: Set<string>, id: string) {
  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function toggleAllApprovalSelections(selectedIds: Set<string>, visibleIds: string[]) {
  if (visibleIds.length > 0 && selectedIds.size === visibleIds.length) return new Set<string>();
  return new Set(visibleIds);
}

export function removeApprovalSelection(selectedIds: Set<string>, id: string) {
  if (!selectedIds.has(id)) return selectedIds;
  const next = new Set(selectedIds);
  next.delete(id);
  return next;
}
