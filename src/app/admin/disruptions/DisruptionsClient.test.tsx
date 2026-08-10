// Title: Disruptions Client Test
// Path: src/app/admin/disruptions/DisruptionsClient.test.tsx
// Functionality: Component coverage for scheduled-disruption UI actions and date payloads.

/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { en } from '@/localization/en';

const mocks = vi.hoisted(() => ({
  loadDisruptionsAction: vi.fn(),
  createDisruptionAction: vi.fn(),
  completeDisruptionAction: vi.fn(),
  activateDisruptionAction: vi.fn(),
  cancelDisruptionAction: vi.fn(),
}));

vi.mock('@/actions/disruptions', () => ({
  loadDisruptionsAction: mocks.loadDisruptionsAction,
  createDisruptionAction: mocks.createDisruptionAction,
  completeDisruptionAction: mocks.completeDisruptionAction,
  activateDisruptionAction: mocks.activateDisruptionAction,
  cancelDisruptionAction: mocks.cancelDisruptionAction,
}));

import { DisruptionsClient, type Disruption, type Spot } from './DisruptionsClient';

const spotId = '22222222-2222-4222-8222-222222222222';
const disruptionId = '44444444-4444-4444-8444-444444444444';
const messages = en.adminDisruptions;

const baseSpot: Spot = {
  id: spotId,
  spot_number: 'A-1',
  floor: '1',
  zone: 'A',
  status: 'available',
  assigned_vehicle_id: null,
};

const scheduledDisruption: Disruption = {
  id: disruptionId,
  title: 'Future concrete work',
  reason: 'Concrete work',
  start_date: '2099-01-01',
  end_date: '2099-01-02',
  status: 'scheduled',
  completed_at: null,
};

function renderClient(input?: { disruptions?: Disruption[]; spots?: Spot[] }) {
  return render(
    <DisruptionsClient
      initialDisruptions={input?.disruptions ?? []}
      initialRelocations={[]}
      initialBlockedSpots={[]}
      initialSpots={input?.spots ?? [baseSpot]}
    />,
  );
}

describe('DisruptionsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadDisruptionsAction.mockResolvedValue({
      success: true,
      disruptions: [],
      relocations: [],
      blockedSpots: [],
      spots: [baseSpot],
    });
    mocks.createDisruptionAction.mockResolvedValue({
      success: true,
      meta: { blocked: 0, relocated: 0, needs_placement: 0 },
    });
    mocks.activateDisruptionAction.mockResolvedValue({
      success: true,
      meta: { blocked: 1, relocated: 0, needs_placement: 0 },
    });
    mocks.cancelDisruptionAction.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('shows activate and cancel for scheduled disruptions instead of complete', async () => {
    renderClient({ disruptions: [scheduledDisruption] });

    expect(screen.getByRole('button', { name: messages.activateNow })).toBeTruthy();
    expect(screen.getByRole('button', { name: messages.cancelScheduled })).toBeTruthy();
    expect(screen.queryByRole('button', { name: messages.completeAndReturn })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: messages.activateNow }));

    await waitFor(() => {
      expect(mocks.activateDisruptionAction).toHaveBeenCalledWith(disruptionId);
    });
  });

  it('keeps future create dates scheduled instead of clamping them to today', async () => {
    const { container } = renderClient();

    fireEvent.click(screen.getByRole('button', { name: messages.newDisruption }));
    fireEvent.change(screen.getByPlaceholderText(messages.placeholders.title), {
      target: { value: 'Future concrete work' },
    });
    fireEvent.change(screen.getByPlaceholderText(messages.placeholders.reason), {
      target: { value: 'Concrete work' },
    });

    const dateInputs = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2099-01-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2099-01-02' } });
    fireEvent.click(screen.getByRole('button', { name: baseSpot.spot_number }));
    fireEvent.click(screen.getByRole('button', { name: messages.scheduleSpots(1) }));

    await waitFor(() => {
      expect(mocks.createDisruptionAction).toHaveBeenCalledWith(expect.objectContaining({
        spotIds: [spotId],
        startDate: '2099-01-01',
        endDate: '2099-01-02',
      }));
    });
  });
});
