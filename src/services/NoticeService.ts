// Title: Notice Domain Service
// Path: src/services/NoticeService.ts
// Functionality: Typed adapter for resident notice delivery RPCs with audience validation.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ADMIN_NOTICES_CONFIG } from '@/config/admin-clients';
import { validateUuid } from '@/lib/action-validation';
import { AppError, toDatabaseAppError } from '@/lib/errors';
import { en } from '@/localization/en';

const noticeAudiences = ADMIN_NOTICES_CONFIG.audiences;
const noticeTypes = ADMIN_NOTICES_CONFIG.noticeTypes;
const messages = en.adminNotices.actionErrors;

export type NoticeAudience = (typeof noticeAudiences)[keyof typeof noticeAudiences];
export type NoticeType = (typeof noticeTypes)[number];

export interface SendNoticeParams {
  audience: NoticeAudience;
  apartmentId?: string | null;
  targetId?: string | null;
  title: string;
  body: string;
  type: NoticeType;
}

export interface NoticeSendMeta {
  batch_id?: string;
  count: number;
}

const audienceValues = Object.values(noticeAudiences) as NoticeAudience[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseAudience(value: unknown): NoticeAudience {
  if (audienceValues.includes(value as NoticeAudience)) return value as NoticeAudience;
  throw new AppError('VALIDATION_ERROR', messages.invalidAudience);
}

function parseNoticeType(value: unknown): NoticeType {
  if (noticeTypes.includes(value as NoticeType)) return value as NoticeType;
  throw new AppError('VALIDATION_ERROR', messages.invalidType);
}

function requiredText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseSendMeta(data: unknown): NoticeSendMeta {
  if (data == null) return { count: 0 };
  if (!isRecord(data) || typeof data.count !== 'number' || data.count < 0) {
    throw new AppError('INTERNAL_ERROR', messages.sendNotice);
  }

  return {
    count: data.count,
    ...(typeof data.batch_id === 'string' ? { batch_id: data.batch_id } : {}),
  };
}

export class NoticeService {
  static async sendNotice(supabase: SupabaseClient, input: SendNoticeParams): Promise<NoticeSendMeta> {
    const audience = parseAudience(input.audience);
    const type = parseNoticeType(input.type);
    const title = requiredText(input.title);
    const body = requiredText(input.body);

    if (!title || !body) throw new AppError('VALIDATION_ERROR', messages.titleBodyRequired);
    if (audience === noticeAudiences.apartment && !input.apartmentId) {
      throw new AppError('VALIDATION_ERROR', messages.selectApartment);
    }
    if (audience === noticeAudiences.profile && !input.targetId) {
      throw new AppError('VALIDATION_ERROR', messages.selectResident);
    }

    const apartmentId = audience === noticeAudiences.apartment
      ? validateUuid(input.apartmentId ?? '', 'apartment ID')
      : null;
    const targetId = audience === noticeAudiences.profile
      ? validateUuid(input.targetId ?? '', 'resident ID')
      : null;

    const { data, error } = await supabase.rpc('tx_send_notice', {
      p_audience: audience,
      p_apartment_id: apartmentId,
      p_target_id: targetId,
      p_title: title,
      p_body: body,
      p_type: type,
    });

    if (error) throw toDatabaseAppError(error, { INTERNAL_ERROR: messages.sendNotice });
    return parseSendMeta(data);
  }
}
