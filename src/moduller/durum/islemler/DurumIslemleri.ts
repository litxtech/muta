import { supabase } from '../../../lib/supabase';

export type DurumPostKind = 'media' | 'game_win';

export type DurumOyunKazanciPayload = {
  game_code: string;
  game_title: string;
  round_id: string;
  total_win: number;
  base_win: number;
  bet_amount: number;
  total_multiplier: number;
  win_tier: string;
};

export type DurumOggesi = {
  id: string;
  user_id: string;
  media_type: 'image' | 'video' | 'card';
  media_url: string;
  caption: string | null;
  like_count: number;
  comment_count: number;
  gift_count: number;
  post_kind: DurumPostKind;
  payload: DurumOyunKazanciPayload | Record<string, unknown> | null;
  created_at: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  public_user_id: string | null;
  liked_by_me: boolean;
  is_mine: boolean;
};

function normalizeDurum(row: DurumOggesi): DurumOggesi {
  return {
    ...row,
    gift_count: Number(row.gift_count ?? 0),
    post_kind: (row.post_kind as DurumPostKind) || 'media',
    payload: (row.payload as DurumOggesi['payload']) ?? {},
  };
}

export function DurumOyunKazanciPayloadAl(
  oge: DurumOggesi,
): DurumOyunKazanciPayload | null {
  if (oge.post_kind !== 'game_win' || !oge.payload) return null;
  const p = oge.payload as Partial<DurumOyunKazanciPayload>;
  if (!p.round_id && p.total_win == null) return null;
  return {
    game_code: String(p.game_code ?? 'kozmik_kaskad'),
    game_title: String(p.game_title ?? 'Realm of Storms'),
    round_id: String(p.round_id ?? ''),
    total_win: Number(p.total_win ?? 0),
    base_win: Number(p.base_win ?? p.total_win ?? 0),
    bet_amount: Number(p.bet_amount ?? 0),
    total_multiplier: Number(p.total_multiplier ?? 1),
    win_tier: String(p.win_tier ?? 'STORM'),
  };
}

export type DurumYorum = {
  id: string;
  user_id: string;
  body: string;
  parent_id: string | null;
  media_url: string | null;
  like_count: number;
  liked_by_me: boolean;
  created_at: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  public_user_id: string | null;
  is_mine: boolean;
};

export type DurumBegenen = {
  user_id: string;
  created_at: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  public_user_id: string | null;
};

export async function DurumAkisiniGetir(limit = 40): Promise<DurumOggesi[]> {
  const { data, error } = await supabase.rpc('durum_akisi', {
    p_limit: limit,
    p_before: null,
  });
  if (error) throw error;
  return ((data as DurumOggesi[]) ?? []).map(normalizeDurum);
}

export async function DurumTakipAkisiniGetir(limit = 40): Promise<DurumOggesi[]> {
  const { data, error } = await supabase.rpc('durum_akisi_takip', {
    p_limit: limit,
    p_before: null,
  });
  if (error) throw error;
  return ((data as DurumOggesi[]) ?? []).map(normalizeDurum);
}

export async function DurumDetayGetir(id: string): Promise<DurumOggesi> {
  const { data, error } = await supabase.rpc('durum_detay', { p_status_id: id });
  if (error) throw error;
  return normalizeDurum(data as DurumOggesi);
}

export async function DurumOlustur(input: {
  mediaType: 'image' | 'video';
  mediaUrl: string;
  caption?: string;
}): Promise<{ ok: boolean; id?: string; hata?: string }> {
  const { data, error } = await supabase.rpc('durum_olustur', {
    p_media_type: input.mediaType,
    p_media_url: input.mediaUrl,
    p_caption: input.caption ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  const row = data as { ok?: boolean; id?: string };
  return { ok: !!row?.ok, id: row?.id };
}

export async function DurumOyunKazanciOlustur(input: {
  gameCode: string;
  roundId: string;
  caption?: string;
}): Promise<{ ok: boolean; id?: string; already?: boolean; hata?: string }> {
  const { data, error } = await supabase.rpc('durum_oyun_kazanci_olustur', {
    p_game_code: input.gameCode,
    p_round_id: input.roundId,
    p_caption: input.caption ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  const row = data as { ok?: boolean; id?: string; already?: boolean };
  return {
    ok: !!row?.ok,
    id: row?.id,
    already: !!row?.already,
  };
}

export async function DurumSil(
  id: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('durum_sil', { p_status_id: id });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function DurumGuncelle(
  id: string,
  caption?: string,
): Promise<{ ok: boolean; caption?: string | null; hata?: string }> {
  const { data, error } = await supabase.rpc('durum_guncelle', {
    p_status_id: id,
    p_caption: caption ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  const row = data as { ok?: boolean; caption?: string | null };
  return { ok: !!row?.ok, caption: row?.caption ?? null };
}

export async function DurumKullanicisiniGetir(
  userId: string,
  limit = 40,
): Promise<DurumOggesi[]> {
  const { data, error } = await supabase.rpc('durum_kullanicisi', {
    p_user_id: userId,
    p_limit: limit,
    p_before: null,
  });
  if (error) throw error;
  return ((data as DurumOggesi[]) ?? []).map(normalizeDurum);
}

export async function DurumBegeniToggle(
  id: string,
): Promise<{ ok: boolean; liked?: boolean; like_count?: number; hata?: string }> {
  const { data, error } = await supabase.rpc('durum_begeni_toggle', {
    p_status_id: id,
  });
  if (error) return { ok: false, hata: error.message };
  const row = data as { ok?: boolean; liked?: boolean; like_count?: number };
  return {
    ok: !!row?.ok,
    liked: row?.liked,
    like_count: row?.like_count,
  };
}

export async function DurumBegenenleriGetir(
  id: string,
): Promise<DurumBegenen[]> {
  const { data, error } = await supabase.rpc('durum_begenenler', {
    p_status_id: id,
    p_limit: 50,
  });
  if (error) throw error;
  return (data as DurumBegenen[]) ?? [];
}

export async function DurumYorumlariGetir(id: string): Promise<DurumYorum[]> {
  const { data, error } = await supabase.rpc('durum_yorumlari', {
    p_status_id: id,
    p_limit: 120,
  });
  if (error) throw error;
  return ((data as DurumYorum[]) ?? []).map((y) => ({
    ...y,
    parent_id: y.parent_id ?? null,
    media_url: y.media_url ?? null,
    like_count: Number(y.like_count ?? 0),
    liked_by_me: !!y.liked_by_me,
  }));
}

export async function DurumYorumEkle(
  id: string,
  body: string,
  opts?: { parentId?: string | null; mediaUrl?: string | null },
): Promise<{ ok: boolean; id?: string; hata?: string }> {
  const { data, error } = await supabase.rpc('durum_yorum_ekle', {
    p_status_id: id,
    p_body: body || null,
    p_parent_id: opts?.parentId ?? null,
    p_media_url: opts?.mediaUrl ?? null,
  });
  if (error) return { ok: false, hata: error.message };
  const row = data as { ok?: boolean; id?: string };
  return { ok: !!row?.ok, id: row?.id };
}

export async function DurumYorumSil(
  commentId: string,
): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('durum_yorum_sil', {
    p_comment_id: commentId,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function DurumYorumBegeniToggle(
  commentId: string,
): Promise<{ ok: boolean; liked?: boolean; like_count?: number; hata?: string }> {
  const { data, error } = await supabase.rpc('durum_yorum_begeni_toggle', {
    p_comment_id: commentId,
  });
  if (error) return { ok: false, hata: error.message };
  const row = data as { ok?: boolean; liked?: boolean; like_count?: number };
  return {
    ok: !!row?.ok,
    liked: row?.liked,
    like_count: row?.like_count,
  };
}
