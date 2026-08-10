// Title: Construction Disruption Service
// Path: src/services/DisruptionService.ts
// Functionality: Wraps the atomic disruption RPCs (create, activate, cancel, complete).
// All state mutation + relocation + audit happens inside the SECURITY DEFINER RPCs.

import { SupabaseClient } from '@supabase/supabase-js';
import { ADMIN_DISRUPTIONS_CONFIG } from '@/config/admin-clients';
import { AppError, toDatabaseAppError } from '@/lib/errors';
import { en } from '@/localization/en';

const disruptionErrors = en.adminDisruptions.actionErrors;

export interface DisruptionSummary { disruption_id?: string; blocked?: number; relocated?: number; needs_placement?: number; returned?: number; needs_review?: number; unblocked?: number; }

const disruptionSummaryNumberKeys = [
  'blocked',
  'relocated',
  'needs_placement',
  'returned',
  'needs_review',
  'unblocked',
] as const;

export class DisruptionService {
  private static parseSummary(data: unknown): DisruptionSummary {
    if (data == null) return {};
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new AppError('INTERNAL_ERROR', 'Disruption transaction returned an invalid summary.');
    }

    const record = data as Record<string, unknown>;
    const summary: DisruptionSummary = {};

    if (record.disruption_id != null) {
      if (typeof record.disruption_id !== 'string') {
        throw new AppError('INTERNAL_ERROR', 'Disruption transaction returned an invalid summary.');
      }
      summary.disruption_id = record.disruption_id;
    }

    for (const key of disruptionSummaryNumberKeys) {
      const value = record[key];
      if (value == null) continue;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new AppError('INTERNAL_ERROR', 'Disruption transaction returned an invalid summary.');
      }
      summary[key] = value;
    }

    return summary;
  }

  static async create(
    supabase: SupabaseClient,
    spotIds: string[],
    title: string,
    reason: string,
    startDate: string,
    endDate: string,
    actorId: string
  ): Promise<DisruptionSummary> {
    if (!spotIds.length) throw new AppError('VALIDATION_ERROR', disruptionErrors.selectSpots);
    if (!title.trim()) throw new AppError('VALIDATION_ERROR', disruptionErrors.titleRequired);
    if (!reason.trim() || reason.trim().length < ADMIN_DISRUPTIONS_CONFIG.reasonMinLength) throw new AppError('VALIDATION_ERROR', disruptionErrors.reasonRequired);
    if (!startDate || !endDate || endDate < startDate) throw new AppError('VALIDATION_ERROR', disruptionErrors.invalidDateRange);

    const { data, error } = await supabase.rpc('tx_create_disruption', {
      p_spot_ids: spotIds, p_title: title.trim(), p_reason: reason.trim(), p_start: startDate, p_end: endDate, p_actor: actorId,
    });
    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: disruptionErrors.createDisruption });
    return this.parseSummary(data);
  }

  // Edit a not-yet-activated (scheduled) disruption: title, reason, dates, and spot set.
  static async update(
    supabase: SupabaseClient,
    disruptionId: string,
    spotIds: string[],
    title: string,
    reason: string,
    startDate: string,
    endDate: string,
    actorId: string
  ): Promise<DisruptionSummary> {
    if (!spotIds.length) throw new AppError('VALIDATION_ERROR', disruptionErrors.selectSpots);
    if (!title.trim()) throw new AppError('VALIDATION_ERROR', disruptionErrors.titleRequired);
    if (!reason.trim() || reason.trim().length < ADMIN_DISRUPTIONS_CONFIG.reasonMinLength) throw new AppError('VALIDATION_ERROR', disruptionErrors.reasonRequired);
    if (!startDate || !endDate || endDate < startDate) throw new AppError('VALIDATION_ERROR', disruptionErrors.invalidDateRange);

    const { data, error } = await supabase.rpc('tx_update_disruption', {
      p_disruption_id: disruptionId, p_spot_ids: spotIds, p_title: title.trim(), p_reason: reason.trim(), p_start: startDate, p_end: endDate, p_actor: actorId,
    });
    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: disruptionErrors.updateDisruption });
    return this.parseSummary(data);
  }

  static async complete(supabase: SupabaseClient, disruptionId: string, actorId: string): Promise<DisruptionSummary> {
    const { data, error } = await supabase.rpc('tx_complete_disruption', { p_disruption_id: disruptionId, p_actor: actorId });
    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: disruptionErrors.completeDisruption });
    return this.parseSummary(data);
  }

  // Flip a single scheduled disruption to active (blocks + relocates its spots).
  static async activate(supabase: SupabaseClient, disruptionId: string): Promise<DisruptionSummary> {
    const { data, error } = await supabase.rpc('tx_activate_disruption', { p_disruption_id: disruptionId });
    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: disruptionErrors.activateDisruption });
    return this.parseSummary(data);
  }

  // Activate every scheduled disruption whose start date has arrived; returns the count.
  static async activateDue(supabase: SupabaseClient): Promise<number> {
    const { data, error } = await supabase.rpc('tx_activate_due_disruptions');
    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: disruptionErrors.activateDueDisruptions });
    return typeof data === 'number' ? data : 0;
  }

  // Cancel a not-yet-activated scheduled disruption.
  static async cancel(supabase: SupabaseClient, disruptionId: string, actorId: string): Promise<void> {
    const { error } = await supabase.rpc('tx_cancel_disruption', { p_disruption_id: disruptionId, p_actor: actorId });
    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: disruptionErrors.cancelDisruption });
  }
}
