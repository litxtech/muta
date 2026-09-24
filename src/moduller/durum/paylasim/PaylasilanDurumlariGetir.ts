import i18n from '../../../i18n';
import { supabase } from '../../../lib/supabase';
import type {
  PaylasilanDurumAvailability,
  PaylasilanDurumOnizleme,
} from './tipler';

/**
 * Konuşmadaki shared_post mesajları için toplu önizleme.
 * N+1 yok — tek RPC.
 */
export async function PaylasilanDurumlariGetir(
  statusIds: string[],
): Promise<Record<string, PaylasilanDurumOnizleme>> {
  const unique = Array.from(
    new Set(statusIds.filter((id) => typeof id === 'string' && id.length > 0)),
  );
  if (unique.length === 0) return {};

  const { data, error } = await supabase.rpc('paylasilan_durumlari_onizle', {
    p_status_ids: unique,
  });

  if (error || !data || typeof data !== 'object') {
    const fallback: Record<string, PaylasilanDurumOnizleme> = {};
    for (const id of unique) {
      fallback[id] = {
        status_id: id,
        availability: 'NOT_AVAILABLE',
        message: i18n.t('durumX.ulasilamiyor'),
      };
    }
    return fallback;
  }

  const out: Record<string, PaylasilanDurumOnizleme> = {};
  const map = data as Record<string, Record<string, unknown>>;
  for (const id of unique) {
    const r = map[id];
    if (!r || typeof r !== 'object') {
      out[id] = {
        status_id: id,
        availability: 'NOT_AVAILABLE',
        message: i18n.t('durumX.ulasilamiyor'),
      };
      continue;
    }
    const availability = (r.availability as PaylasilanDurumAvailability) ||
      'NOT_AVAILABLE';
    out[id] = {
      status_id: String(r.status_id ?? id),
      availability,
      message: (r.message as string | undefined) ?? undefined,
      user_id: (r.user_id as string | undefined) ?? undefined,
      media_type: (r.media_type as string | undefined) ?? undefined,
      media_url: typeof r.media_url === 'string' ? r.media_url : '',
      caption: (r.caption as string | null | undefined) ?? null,
      post_kind: (r.post_kind as string | undefined) ?? 'media',
      payload:
        r.payload && typeof r.payload === 'object'
          ? (r.payload as Record<string, unknown>)
          : {},
      created_at: (r.created_at as string | undefined) ?? undefined,
      display_name: (r.display_name as string | undefined) ?? undefined,
      username: (r.username as string | null | undefined) ?? null,
      avatar_url: (r.avatar_url as string | null | undefined) ?? null,
      public_user_id: (r.public_user_id as string | null | undefined) ?? null,
    };
  }
  return out;
}
