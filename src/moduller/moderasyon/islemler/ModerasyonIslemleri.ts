import { supabase } from '../../../lib/supabase';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';

export type ModerasyonAksiyonu = 'mute' | 'unmute' | 'kick' | 'ban' | 'unban';

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
  targetUserId?: string;
  roomId?: string;
  details?: string;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('kullanici_bildir', {
    p_reason: input.reason,
    p_target_user_id: input.targetUserId ?? null,
    p_room_id: input.roomId ?? null,
    p_details: input.details ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
