// Title: Structured Error Handling Test
// Path: src/lib/errors.test.ts
// Functionality: Unit coverage for safe AppError and database error translation.

import { describe, expect, it } from 'vitest';
import { AppError, toActionError, toDatabaseAppError } from './errors';

describe('toDatabaseAppError', () => {
  it('preserves existing AppError instances', () => {
    const error = new AppError('FORBIDDEN', 'Nope.');
    expect(toDatabaseAppError(error)).toBe(error);
  });

  it('maps common Postgres and PostgREST error codes to safe app codes', () => {
    expect(toDatabaseAppError({ code: '23505', message: 'duplicate key' }).code).toBe('CONFLICT');
    expect(toDatabaseAppError({ code: '23503', message: 'foreign key' }).code).toBe('RULE_VIOLATION');
    expect(toDatabaseAppError({ code: '22023', message: 'invalid parameter' }).code).toBe('VALIDATION_ERROR');
    expect(toDatabaseAppError({ code: '42501', message: 'permission denied' }).code).toBe('FORBIDDEN');
    expect(toDatabaseAppError({ code: 'PGRST116', message: 'no rows' }).code).toBe('NOT_FOUND');
    expect(toDatabaseAppError({ code: 'PGRST202', message: 'function missing' }).code).toBe('INTERNAL_ERROR');
  });

  it('maps raised RPC messages by safe prefix', () => {
    expect(toDatabaseAppError({ code: 'P0001', message: 'FORBIDDEN: admin required' }).code).toBe('FORBIDDEN');
    expect(toDatabaseAppError({ code: 'P0001', message: 'RULE: current state blocks this' }).code).toBe('RULE_VIOLATION');
    expect(toDatabaseAppError({ code: 'P0001', message: 'RATE_LIMITED: slow down' }).code).toBe('RATE_LIMITED');
  });

  it('uses caller-provided safe messages without exposing raw database text', () => {
    const error = toDatabaseAppError(
      { code: '23505', message: 'duplicate key value violates unique constraint vehicles_plate_number_key' },
      { CONFLICT: 'Vehicle with this plate already exists.' },
    );
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe('Vehicle with this plate already exists.');
    expect(toActionError(error)).toEqual({
      success: false,
      error: 'Vehicle with this plate already exists.',
      code: 'CONFLICT',
    });
  });
});
