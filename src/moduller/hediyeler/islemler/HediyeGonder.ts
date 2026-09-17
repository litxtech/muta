import { supabase } from '../../../lib/supabase';
import { FinansIdempotencyAnahtariOlustur } from '../../cuzdan/islemler/FinansIdempotencyAnahtariOlustur';
import { KillSwitchAktifMiSunucu } from '../../ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';

export type HediyeGonderSonuc =
  | {
      ok: true;
      transaction: unknown;
      coinsSpent: number;
      coinsAfter?: number;
    }
  | { ok: false; hata: string; kod?: 'kill_switch' | 'feature' | 'rpc' };

/**
 * Hediye business action — fiyat client'tan gelmez.
 * Ses odasi sadece bu fonksiyonu cagirir.
 */
export async function HediyeGonder(input: {
  roomId?: string | null;
  receiverId: string;
  giftId: string;
  quantity?: number;
  idempotencyKey?: string;
  statusId?: string | null;
  liveSessionId?: string | null;
}): Promise<HediyeGonderSonuc> {
  if (await KillSwitchAktifMiSunucu('kill_gift_send')) {
    return { ok: false, hata: 'Hediye gonderimi gecici olarak kapali.', kod: 'kill_switch' };
  }
  if (!(await OzellikBayragiAktifMiSunucu('gifts_enabled'))) {
    return { ok: false, hata: 'Hediye ozelligi kapali.', kod: 'feature' };
  }

  const key =
    input.idempotencyKey ?? FinansIdempotencyAnahtariOlustur('gift_send');

  const { data, error } = await supabase.rpc('send_gift', {
    p_room_id: input.roomId ?? null,
    p_receiver_id: input.receiverId,
    p_gift_id: input.giftId,
    p_quantity: input.quantity ?? 1,
    p_idempotency_key: key,
    p_status_id: input.statusId ?? null,
    p_live_session_id: input.liveSessionId ?? null,
  });

  if (error) return { ok: false, hata: error.message, kod: 'rpc' };
  const tx = data as { coins_spent?: number } | null;
  const coinsSpent = Number(tx?.coins_spent ?? 0);
  return { ok: true, transaction: data, coinsSpent };
}
