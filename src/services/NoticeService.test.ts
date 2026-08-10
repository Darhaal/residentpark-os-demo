// Title: Notice Service Test
// Path: src/services/NoticeService.test.ts
// Functionality: Unit coverage for typed notice-send RPC payloads and audience validation.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoticeService } from './NoticeService';

const apartmentId = '11111111-1111-4111-8111-111111111111';
const residentId = '22222222-2222-4222-8222-222222222222';

function supabaseWithRpc(rpc = vi.fn()) {
  return { rpc } as unknown as SupabaseClient;
}

describe('NoticeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends an all-residents notice through the typed RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { batch_id: 'batch-1', count: 12 }, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(NoticeService.sendNotice(supabase, {
      audience: 'all',
      title: '  Garage update  ',
      body: '  Please move vehicles by 8 AM.  ',
      type: 'announcement',
    })).resolves.toEqual({ batch_id: 'batch-1', count: 12 });

    expect(rpc).toHaveBeenCalledWith('tx_send_notice', {
      p_audience: 'all',
      p_apartment_id: null,
      p_target_id: null,
      p_title: 'Garage update',
      p_body: 'Please move vehicles by 8 AM.',
      p_type: 'announcement',
    });
  });

  it('sends a profile-targeted notice only with a validated resident id', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { batch_id: 'batch-2', count: 1 }, error: null });
    const supabase = supabaseWithRpc(rpc);

    await expect(NoticeService.sendNotice(supabase, {
      audience: 'profile',
      targetId: ` ${residentId} `,
      apartmentId,
      title: 'Hi Alice',
      body: 'Personal notice',
      type: 'announcement',
    })).resolves.toEqual({ batch_id: 'batch-2', count: 1 });

    expect(rpc).toHaveBeenCalledWith('tx_send_notice', {
      p_audience: 'profile',
      p_apartment_id: null,
      p_target_id: residentId,
      p_title: 'Hi Alice',
      p_body: 'Personal notice',
      p_type: 'announcement',
    });
  });

  it('rejects a missing apartment target before calling the database', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(NoticeService.sendNotice(supabase, {
      audience: 'apartment',
      apartmentId: '',
      title: 'Garage update',
      body: 'Please move vehicles by 8 AM.',
      type: 'announcement',
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Select an apartment.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects unsupported notice types before calling the database', async () => {
    const rpc = vi.fn();
    const supabase = supabaseWithRpc(rpc);

    await expect(NoticeService.sendNotice(supabase, {
      audience: 'all',
      title: 'Garage update',
      body: 'Please move vehicles by 8 AM.',
      type: 'unsupported_notice' as never,
    })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Select a valid notice type.',
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps notice RPC failures to safe action errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'function failed' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(NoticeService.sendNotice(supabase, {
      audience: 'all',
      title: 'Garage update',
      body: 'Please move vehicles by 8 AM.',
      type: 'announcement',
    })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Failed to send notice.',
    });
  });
});
