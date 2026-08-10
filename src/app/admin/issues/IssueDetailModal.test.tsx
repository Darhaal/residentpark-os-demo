// @vitest-environment jsdom
// Title: Issue Detail Modal Test
// Path: src/app/admin/issues/IssueDetailModal.test.tsx
// Functionality: Component coverage for the admin parking issue detail workflow.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { IssueDetailModal } from './IssueDetailModal';
import { en } from '@/localization/en';
import type { ParkingIssueRow } from '@/actions/issues';
import type { ParkingIssueStatus } from '@/services/ParkingIssueService';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

const messages = en.adminIssues;

const issue: ParkingIssueRow = {
  id: '11111111-1111-4111-8111-111111111111',
  spot_id: '22222222-2222-4222-8222-222222222222',
  reporter_id: '33333333-3333-4333-8333-333333333333',
  issue_type: 'Wrong vehicle',
  violating_plate: 'BAD-123',
  comment: 'Vehicle is parked in my assigned spot.',
  status: 'open',
  created_at: '2026-06-22T12:00:00.000Z',
  resolved_at: null,
  resolved_by: null,
  resolution_note: null,
  spot_number: 'P-12',
  spot_status: 'occupied',
  floor: 'B1',
  zone: 'East',
  reporter_name: 'Jane Resident',
  reporter_email: 'jane@example.test',
  unit: '1204',
  resolver_name: null,
};

const props = (overrides: Partial<{
  targetStatus: ParkingIssueStatus;
  note: string;
  isPending: boolean;
  onClose: () => void;
  onStatusChange: (status: ParkingIssueStatus) => void;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
}> = {}) => ({
  selected: issue,
  targetStatus: overrides.targetStatus ?? 'in_progress',
  note: overrides.note ?? '',
  isPending: overrides.isPending ?? false,
  onClose: overrides.onClose ?? vi.fn(),
  onStatusChange: overrides.onStatusChange ?? vi.fn(),
  onNoteChange: overrides.onNoteChange ?? vi.fn(),
  onSubmit: overrides.onSubmit ?? vi.fn(),
});

describe('IssueDetailModal', () => {
  it('renders a structured issue workflow dialog', () => {
    const { getByText } = render(<IssueDetailModal {...props()} />);
    const dialog = document.querySelector('[role="dialog"]');

    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute('aria-label')).toBe(messages.detailTitle);
    expect(getByText(messages.lifecycleTitle)).toBeTruthy();
    expect(getByText('Jane Resident')).toBeTruthy();
    expect(getByText('BAD-123')).toBeTruthy();
    expect(getByText('B1 / East')).toBeTruthy();
  });

  it('requires a resolution note before closing an issue', () => {
    const { getByLabelText, getByRole, getByText } = render(
      <IssueDetailModal {...props({ targetStatus: 'resolved', note: '' })} />,
    );

    const noteField = getByLabelText(messages.resolutionNote);
    const saveButton = getByRole('button', { name: messages.saveStatus }) as HTMLButtonElement;

    expect(noteField.getAttribute('aria-invalid')).toBe('true');
    expect(getByText(messages.resolutionRequirement(3, messages.statusLabels.resolved))).toBeTruthy();
    expect(saveButton.disabled).toBe(true);
  });

  it('wires workflow changes, note edits, and submit action', () => {
    const onStatusChange = vi.fn();
    const onNoteChange = vi.fn();
    const onSubmit = vi.fn();
    const { getByLabelText, getByRole } = render(
      <IssueDetailModal {...props({ note: 'checking', onStatusChange, onNoteChange, onSubmit })} />,
    );

    fireEvent.change(getByLabelText(messages.workflowStatus), { target: { value: 'closed' } });
    fireEvent.change(getByLabelText(messages.resolutionNote), { target: { value: 'Resolved by patrol.' } });
    fireEvent.click(getByRole('button', { name: messages.saveStatus }));

    expect(onStatusChange).toHaveBeenCalledWith('closed');
    expect(onNoteChange).toHaveBeenCalledWith('Resolved by patrol.');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
