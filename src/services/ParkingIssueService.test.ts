// Title: Parking Issue Service Test
// Path: src/services/ParkingIssueService.test.ts
// Functionality: Unit coverage for the typed parking issue RPC adapter.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParkingIssueService } from './ParkingIssueService';
import { en } from '@/localization/en';

const spotId = '11111111-1111-4111-8111-111111111111';
const issueId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';

function supabaseWithRpc(rpc = vi.fn()) {
  return { rpc } as unknown as SupabaseClient;
}

describe('ParkingIssueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports an issue through the typed reporting RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: issueId, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(ParkingIssueService.reportIssue(supabase, {
      spotId,
      issueType: 'blocked_access',
      violatingPlate: ' bad-123 ',
      comment: ' Blocking access ',
      actorId,
    })).resolves.toBe(issueId);

    expect(rpc).toHaveBeenCalledWith('tx_report_parking_issue', {
      p_spot_id: spotId,
      p_issue_type: 'blocked_access',
      p_violating_plate: 'bad-123',
      p_comment: 'Blocking access',
      p_actor_id: actorId,
    });
  });

  it('rejects an invalid issue type before calling the database', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(ParkingIssueService.reportIssue(supabase, {
      spotId,
      issueType: 'not_a_real_issue_type',
      violatingPlate: '',
      comment: '',
      actorId,
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: en.adminIssues.actionErrors.invalidIssueType,
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('requires a resolution note before closing an issue', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(ParkingIssueService.updateStatus(supabase, {
      issueId,
      status: 'resolved',
      note: '  ',
      actorId,
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: en.adminIssues.actionErrors.resolutionRequired,
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('updates issue status through the typed update RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(ParkingIssueService.updateStatus(supabase, {
      issueId,
      status: 'in_progress',
      note: '  Inspecting now  ',
      actorId,
    })).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('tx_update_parking_issue', {
      p_issue_id: issueId,
      p_status: 'in_progress',
      p_note: 'Inspecting now',
      p_actor: actorId,
    });
  });

  it('maps reporting RPC failures to safe action errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(ParkingIssueService.reportIssue(supabase, {
      spotId,
      issueType: 'blocked_access',
      violatingPlate: '',
      comment: '',
      actorId,
    })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
    });
  });

  it('maps duplicate active issue reports to the resident-facing conflict message', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message: 'CONFLICT: active parking issue already exists for this spot and issue type',
      },
    });
    const supabase = supabaseWithRpc(rpc);

    await expect(ParkingIssueService.reportIssue(supabase, {
      spotId,
      issueType: 'blocked_access',
      violatingPlate: '',
      comment: '',
      actorId,
    })).rejects.toMatchObject({
      code: 'CONFLICT',
      message: en.residentParkingMap.duplicateActiveIssue,
    });
  });
});
