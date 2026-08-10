// Title: Profile Actions
// Path: src/actions/profile.ts
// Functionality: Next.js Server Actions for profile workflows, validation, and persistence.

'use server';

import { requireUser } from '@/lib/auth';
import { AppError, toActionError, toDatabaseAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/** Update display name and phone — safe, non-auth fields. */
export async function updateProfileInfoAction(input: {
  full_name: string;
  phone: string;
}) {
  try {
    const { supabase, userId } = await requireUser();
    const name = input.full_name.trim();
    if (!name) throw new AppError('VALIDATION_ERROR', 'Full name is required.');

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name, phone: input.phone.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: 'Failed to update profile.' });
    logger.info('Profile info updated', { userId });
    return { success: true as const };
  } catch (err) {
    return toActionError(err);
  }
}
