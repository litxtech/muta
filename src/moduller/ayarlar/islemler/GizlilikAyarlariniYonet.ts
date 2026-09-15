import { supabase } from '../../../lib/supabase';

export type GizlilikAyarlari = {
  hide_recharge_rank: boolean;
  hide_gifter_rank: boolean;
  hide_current_room: boolean;
  hide_last_seen: boolean;
  hide_agency: boolean;
  hide_gift_collection: boolean;
  hide_top_supporter: boolean;
};

const DEFAULTS: GizlilikAyarlari = {
  hide_recharge_rank: false,
  hide_gifter_rank: false,
  hide_current_room: false,
  hide_last_seen: false,
  hide_agency: false,
  hide_gift_collection: false,
  hide_top_supporter: false,
};

export async function GizlilikAyarlariniGetir(): Promise<GizlilikAyarlari> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { ...DEFAULTS };

  const { data, error } = await supabase
    .from('user_privacy_settings')
    .select(
      'hide_recharge_rank, hide_gifter_rank, hide_current_room, hide_last_seen, hide_agency, hide_gift_collection, hide_top_supporter',
    )
    .eq('user_id', uid)
    .maybeSingle();

  if (error || !data) return { ...DEFAULTS };
  return { ...DEFAULTS, ...(data as GizlilikAyarlari) };
}

export async function GizlilikAyariKaydet(
  alan: keyof GizlilikAyarlari,
  deger: boolean,
): Promise<{ ok: boolean; hata?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { ok: false, hata: 'Oturum yok' };

  const { error } = await supabase.from('user_privacy_settings').upsert(
    {
      user_id: uid,
      [alan]: deger,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}

export const GIZLILIK_ALAN_ETIKETLERI: {
  key: keyof GizlilikAyarlari;
  label: string;
  aciklama?: string;
}[] = [
  {
    key: 'hide_recharge_rank',
    label: 'Yükleme sıralamamı gizle',
    aciklama: 'Haftalık / günlük coin yükleme liderliğinde görünmezsin',
  },
  { key: 'hide_gifter_rank', label: 'Hediye sıralamamı gizle' },
  { key: 'hide_current_room', label: 'Bulunduğum odayı gizle' },
  { key: 'hide_last_seen', label: 'Son görülmeyi gizle' },
  { key: 'hide_agency', label: 'Ajansımı gizle' },
  { key: 'hide_gift_collection', label: 'Hediye koleksiyonumu gizle' },
  { key: 'hide_top_supporter', label: 'En çok destekçiyi gizle' },
];
