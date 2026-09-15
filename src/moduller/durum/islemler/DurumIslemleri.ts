import { supabase } from '../../../lib/supabase';

export type DurumOggesi = {
  id: string;
  user_id: string;
  media_type: 'image' | 'video';
  media_url: string;
  caption: string | null;
  like_count: number;
  comment_count: number;
  gift_count: number;
  created_at: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  public_user_id: string | null;
  liked_by_me: boolean;
  is_mine: boolean;
};

export type DurumYorum = {
  id: string;
  user_id: string;
  body: string;
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
  return ((data as DurumOggesi[]) ?? []).map((row) => ({
    ...row,
    gift_count: Number(row.gift_count ?? 0),
  }));
}

export async function DurumDetayGetir(id: string): Promise<DurumOggesi> {
  const { data, error } = await supabase.rpc('durum_detay', { p_status_id: id });
  if (error) throw error;
  const row = data as DurumOggesi;
  return { ...row, gift_count: Number(row.gift_count ?? 0) };
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
  return ((data as DurumOggesi[]) ?? []).map((row) => ({
    ...row,
    gift_count: Number(row.gift_count ?? 0),
  }));
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
    p_limit: 80,
  });
  if (error) throw error;
  return (data as DurumYorum[]) ?? [];
}

export async function DurumYorumEkle(
  id: string,
  body: string,
): Promise<{ ok: boolean; id?: string; hata?: string }> {
  const { data, error } = await supabase.rpc('durum_yorum_ekle', {
    p_status_id: id,
    p_body: body,
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
