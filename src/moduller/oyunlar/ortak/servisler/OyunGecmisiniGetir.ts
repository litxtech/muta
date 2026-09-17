/**
 * Kullanıcının oynadığı oyun oturumları — hesap hareketleri belgesi için.
 */

import { supabase } from '../../../../lib/supabase';

export type OyunGecmisiKaydi = {
  id: string;
  session_id: string;
  oyunAdi: string;
  oyunKodu: string | null;
  odaBaslik: string | null;
  durum: string;
  sira: number | null;
  xp: number;
  kupa: number;
  coinOdul: number;
  baslangic: string;
  bitis: string | null;
};

const OYUN_AD_FALLBACK: Record<string, string> = {
  match3: 'Kristal Savaşı (kaldırıldı)',
  kozmik_kaskad: 'Kozmik Kaskad',
  zeus: 'ZEUS',
};

const DURUM_ETIKET: Record<string, string> = {
  joined: 'Katıldı',
  ready: 'Hazır',
  playing: 'Oynuyor',
  finished: 'Tamamlandı',
  disconnected: 'Bağlantı koptu',
  dnf: 'Tamamlamadı',
  left: 'Ayrıldı',
};

export function OyunDurumEtiketi(status: string): string {
  return DURUM_ETIKET[status] ?? status;
}

export function OyunSiraYazi(rank: number | null): string {
  if (rank == null) return '—';
  if (rank === 1) return '1. (kazandı)';
  if (rank === 2) return '2.';
  if (rank === 3) return '3.';
  return `${rank}.`;
}

export async function OyunGecmisiniGetir(
  userId: string,
  limit = 80,
): Promise<OyunGecmisiKaydi[]> {
  const { data, error } = await supabase
    .from('game_session_players')
    .select(
      `
      id,
      session_id,
      status,
      joined_at,
      finished_at,
      final_rank,
      xp_earned,
      trophy_change,
      coin_reward,
      session:game_sessions (
        id,
        game_code,
        status,
        created_at,
        room_id,
        oda:rooms ( title )
      )
    `,
    )
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data as any[]) ?? []).map((row) => {
    const session = row.session ?? null;
    const kod = (session?.game_code as string | null) ?? null;
    const oda = session?.oda ?? null;
    return {
      id: String(row.id),
      session_id: String(row.session_id),
      oyunAdi: kod
        ? OYUN_AD_FALLBACK[kod] ?? kod.replace(/_/g, ' ')
        : 'Oyun',
      oyunKodu: kod,
      odaBaslik: (oda?.title as string | null) ?? null,
      durum: String(row.status ?? ''),
      sira: row.final_rank != null ? Number(row.final_rank) : null,
      xp: Number(row.xp_earned ?? 0),
      kupa: Number(row.trophy_change ?? 0),
      coinOdul: Number(row.coin_reward ?? 0),
      baslangic: String(row.joined_at),
      bitis: (row.finished_at as string | null) ?? null,
    };
  });
}
