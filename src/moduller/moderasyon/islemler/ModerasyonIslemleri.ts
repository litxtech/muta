import { supabase } from '../../../lib/supabase';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';

export type ModerasyonAksiyonu = 'mute' | 'unmute' | 'kick' | 'ban' | 'unban';

export type EngellenenKullanici = {
  blocked_id: string;
  created_at: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  public_user_id: string | null;
};

export async function OdaModerasyonUygula(input: {
  roomId: string;
  targetUserId: string;
  action: ModerasyonAksiyonu;
  reason?: string;
}): Promise<{ ok: boolean; hata?: string }> {
  if (!(await OzellikBayragiAktifMiSunucu('moderation_enabled'))) {
    return { ok: false, hata: 'moderation_enabled kapalı.' };
  }
  const { error } = await supabase.rpc('oda_moderasyon_uygula', {
    p_room_id: input.roomId,
    p_target_user_id: input.targetUserId,
    p_action: input.action,
    p_reason: input.reason ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function KullaniciBildir(input: {
  reason: string;
  /** BILDIRME_SEBEPLERI id — çocuk koruma önceliği için */
  reasonCode?: string;
  targetUserId?: string;
  roomId?: string;
  details?: string;
  contentType?:
    | 'user'
    | 'dm_message'
    | 'room_chat'
    | 'live_chat'
    | 'room'
    | 'profile'
    | 'status_post'
    | 'status_comment'
    | 'other';
  contentId?: string;
  context?: Record<string, unknown>;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('kullanici_bildir', {
    p_reason: input.reason,
    p_target_user_id: input.targetUserId ?? null,
    p_room_id: input.roomId ?? null,
    p_details: input.details ?? null,
    p_content_type: input.contentType ?? null,
    p_content_id: input.contentId ?? null,
    p_context: {
      ...(input.context ?? {}),
      ...(input.reasonCode ? { reason_code: input.reasonCode } : {}),
    },
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function KullaniciEngelle(
  blockedUserId: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('kullanici_engelle', {
    p_blocked_id: blockedUserId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function KullaniciEngeliKaldir(
  blockedUserId: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('kullanici_engeli_kaldir', {
    p_blocked_id: blockedUserId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function EngellenenKullanicilariGetir(
  limit = 100,
): Promise<EngellenenKullanici[]> {
  const { data, error } = await supabase.rpc('engellenen_kullanicilar_listesi', {
    p_limit: limit,
  });
  if (error) throw error;
  return (data as EngellenenKullanici[]) ?? [];
}

export async function KullanicilarEngelliMi(
  otherUserId: string,
): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid || !otherUserId) return false;
  const { data, error } = await supabase.rpc('kullanicilar_engelli_mi', {
    p_a: uid,
    p_b: otherUserId,
  });
  if (error) return false;
  return !!data;
}

/** Apple / Google standart rapor sebepleri */
export const BILDIRME_SEBEPLERI = [
  { id: 'spam', label: 'Spam veya dolandırıcılık' },
  { id: 'harassment', label: 'Taciz veya zorbalık' },
  { id: 'hate', label: 'Nefret söylemi' },
  { id: 'sexual', label: 'Cinsel içerik / uygunsuz' },
  { id: 'child_safety', label: 'Çocuk istismarı / reşit olmayan içerik' },
  { id: 'violence', label: 'Şiddet veya tehdit' },
  { id: 'impersonation', label: 'Kimliğe bürünme' },
  { id: 'other', label: 'Diğer' },
] as const;
