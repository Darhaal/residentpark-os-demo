// Title: Resident Actions
// Path: src/actions/resident.ts
// Functionality: Next.js Server Actions for resident workflows, validation, and persistence.

// Resident mutations restricted to the verified user's apartment context.

'use server';

import { AppError, toActionError } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { logActionError } from '@/lib/action-logger';
import { requireApprovedUser } from '@/lib/auth';
import { VehicleService } from '@/services/VehicleService';
import { ParkingIssueService } from '@/services/ParkingIssueService';

export async function submitResidentVehicleAction(data: {
  plateNumber: string;
  make: string;
  model: string;
  color: string;
  year: number;
}) {
  try {
    const { supabase, userId, apartmentId } = await requireApprovedUser();
    await enforceRateLimit(supabase, 'vehicle_submit');

    if (!apartmentId) {
      throw new AppError('FORBIDDEN', 'You must be assigned to an apartment to register a vehicle.');
    }

    // The database RPC owns approval policy and binds apartment/owner to auth.uid().
    await VehicleService.submitRequest(
      supabase,
      apartmentId,
      userId,
      data.plateNumber,
      data.make,
      data.model,
      data.color,
      data.year,
      userId,
    );

    return { success: true as const };
  } catch (error) {
    await logActionError('submitResidentVehicleAction failed', error);
    return toActionError(error);
  }
}

export async function reportParkingIssueAction(
  spotId: string,
  _spotNumber: string,
  issueType: string,
  violatingPlate: string,
  comment: string,
) {
  try {
    const { supabase, userId, apartmentId } = await requireApprovedUser();
    await enforceRateLimit(supabase, 'issue_report');

    if (!apartmentId) {
      throw new AppError('FORBIDDEN', 'No apartment assigned.');
    }

    await ParkingIssueService.reportIssue(supabase, { spotId, issueType, violatingPlate, comment, actorId: userId });

    return { success: true as const };
  } catch (error) {
    await logActionError('reportParkingIssueAction failed', error);
    return toActionError(error);
  }
}
