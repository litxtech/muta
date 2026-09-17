import { supabase } from '../../../lib/supabase';

export type SehirHediyeOzeti = {
  ok: boolean;
  has_city: boolean;
  city_id?: string;
  city_name?: string;
  last_delta?: number;
  today_power?: number;
  today_gifts?: number;
};

export type SehirYukselen = {
  id: string;
  name: string;
  slug: string;
  power_score: number;
  supporter_count: number;
  delta_24h: number;
};

export type SehirGorev = {
  id: string;
  code: string;
  title: string;
  description: string;
  goal_type: string;
  goal_target: number;
  reward_coins: number;
  reward_label: string | null;
  sort_order: number;
  progress: number;
  completed_at: string | null;
  claimed_at: string | null;
  week_code: string;
};

export async function SehirHediyeSonrasiOzet(): Promise<SehirHediyeOzeti> {
  const { data, error } = await supabase.rpc('sehir_hediye_sonrasi_ozet');
  if (error) throw error;
  return data as SehirHediyeOzeti;
}

export async function SehirYukselenleriGetir(limit = 5): Promise<SehirYukselen[]> {
  const { data, error } = await supabase.rpc('sehir_yukselenleri_getir', {
    p_limit: limit,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as SehirYukselen[];
}

export async function SehirGorevlerimiGetir(): Promise<SehirGorev[]> {
  const { data, error } = await supabase.rpc('sehir_gorevlerimi_getir');
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as SehirGorev[];
}

export async function SehirGorevOdulAl(
  missionId: string,
): Promise<{ ok: boolean; reward_coins?: number; hata?: string }> {
  const { data, error } = await supabase.rpc('sehir_gorev_odul_al', {
    p_mission_id: missionId,
  });
  if (error) return { ok: false, hata: error.message };
  return data as { ok: boolean; reward_coins?: number };
}

export async function SehirDuyuruYayinla(input: {
  cityId: string;
  title: string;
  body: string;
  pinned?: boolean;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('sehir_duyuru_yayinla', {
    p_city_id: input.cityId,
    p_title: input.title,
    p_body: input.body,
    p_pinned: input.pinned ?? false,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function AdminSehirSavasOlustur(input: {
  cityA: string;
  cityB: string;
  hours?: number;
  live?: boolean;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('admin_sehir_savas_olustur', {
    p_city_a: input.cityA,
    p_city_b: input.cityB,
    p_hours: input.hours ?? 24,
    p_live: input.live ?? true,
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export async function AdminSehirHaftalikEslestir(
  hours = 48,
): Promise<{ ok: boolean; created?: number; hata?: string }> {
  const { data, error } = await supabase.rpc('admin_sehir_haftalik_eslestir', {
    p_hours: hours,
  });
  if (error) return { ok: false, hata: error.message };
  return data as { ok: boolean; created?: number; hata?: string };
}

export async function AdminSehirSezonOdulDagit(
  top = 3,
): Promise<{ ok: boolean; distributed_to_leaders?: number; hata?: string }> {
  const { data, error } = await supabase.rpc('admin_sehir_sezon_odul_dagit', {
    p_top: top,
  });
  if (error) return { ok: false, hata: error.message };
  return data as { ok: boolean; distributed_to_leaders?: number };
}
