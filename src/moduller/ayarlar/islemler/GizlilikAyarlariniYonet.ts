import { supabase } from '../../../lib/supabase';

export type GizlilikAyarlari = {
  hide_recharge_rank: boolean;
  hide_gifter_rank: boolean;
  hide_current_room: boolean;
  hide_last_seen: boolean;
  hide_agency: boolean;
  hide_gift_collection: boolean;
  hide_top_supporter: boolean;
  hide_level: boolean;
  hide_topup_coin: boolean;
  hide_prestige: boolean;
  hide_account_value: boolean;
  hide_crown: boolean;
  hide_online_status: boolean;
  hide_followers: boolean;
  hide_following: boolean;
  hide_status_posts: boolean;
  hide_game_stats: boolean;
  is_private: boolean;
};

const DEFAULTS: GizlilikAyarlari = {
  hide_recharge_rank: false,
  hide_gifter_rank: false,
  hide_current_room: false,
  hide_last_seen: false,
  hide_agency: false,
  hide_gift_collection: false,
  hide_top_supporter: false,
  hide_level: false,
  hide_topup_coin: false,
  hide_prestige: false,
  hide_account_value: false,
  hide_crown: false,
  hide_online_status: false,
  hide_followers: false,
  hide_following: false,
  hide_status_posts: false,
  hide_game_stats: false,
  is_private: false,
};

const SELECT_ALANLARI =
  'hide_recharge_rank, hide_gifter_rank, hide_current_room, hide_last_seen, hide_agency, hide_gift_collection, hide_top_supporter, hide_level, hide_topup_coin, hide_prestige, hide_account_value, hide_crown, hide_online_status, hide_followers, hide_following, hide_status_posts, hide_game_stats, is_private';

function satirdanAyarlar(data: Partial<GizlilikAyarlari> | null): GizlilikAyarlari {
  return { ...DEFAULTS, ...(data ?? {}) };
}

/** Oturum sahibinin gizlilik ayarları */
export async function GizlilikAyarlariniGetir(): Promise<GizlilikAyarlari> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { ...DEFAULTS };
  return GizlilikAyarlariniKullaniciIcinGetir(uid);
}

/** Herhangi bir kullanıcının profil gösterme bayrakları (ziyaret UI) */
export async function GizlilikAyarlariniKullaniciIcinGetir(
  userId: string,
): Promise<GizlilikAyarlari> {
  const { data, error } = await supabase
    .from('user_privacy_settings')
    .select(SELECT_ALANLARI)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return { ...DEFAULTS };
  return satirdanAyarlar(data as Partial<GizlilikAyarlari>);
}

export async function GizlilikAyariKaydet(
  alan: keyof GizlilikAyarlari,
  deger: boolean,
): Promise<{ ok: boolean; hata?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { ok: false, hata: 'Oturum yok' };

  if (alan === 'is_private') {
    const { data, error } = await supabase.rpc('gizli_hesap_ayarla', {
      p_is_private: deger,
    });
    if (error) return { ok: false, hata: error.message };
    const row = data as { ok?: boolean } | null;
    return { ok: row?.ok !== false };
  }

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

/** Genel gizlilik (liderlik, oda, hesap) */
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
  {
    key: 'hide_online_status',
    label: 'Çevrimiçi durumumu gizle',
    aciklama: 'Aktif / çevrimiçi olduğun başkalarına gösterilmez',
  },
  { key: 'hide_gift_collection', label: 'Hediye koleksiyonumu gizle' },
  { key: 'hide_top_supporter', label: 'En çok destekçiyi gizle' },
  {
    key: 'hide_followers',
    label: 'Takipçilerimi gizle',
    aciklama: 'Takipçi sayısı ve listesi profilde görünmez',
  },
  {
    key: 'hide_following',
    label: 'Takip listemi gizle',
    aciklama: 'Takip ettiğin kişi sayısı ve listesi görünmez',
  },
  {
    key: 'hide_status_posts',
    label: 'Durumlarımı / gönderilerimi gizle',
    aciklama: 'Profildeki durum ızgarası ziyaretçilere kapalı',
  },
  {
    key: 'is_private',
    label: 'Gizli hesap',
    aciklama: 'Takip isteklerin onayın olmadan kimse seni takip edemez',
  },
];

/** Profil ziyaretinde görünen göstergeler — kapalıysa başkası göremez */
export const PROFIL_GOSTERGE_GIZLILIK: {
  key: keyof GizlilikAyarlari;
  label: string;
  aciklama?: string;
}[] = [
  {
    key: 'hide_prestige',
    label: 'Ünvanlarımı gizle',
    aciklama: 'VIP, hediye, çekicilik ve yükleme rozetleri',
  },
  {
    key: 'hide_agency',
    label: 'Ajansımı gizle',
    aciklama: 'Profil ziyaretinde ajans rozetin görünmez',
  },
  {
    key: 'hide_topup_coin',
    label: 'Yüklenen coinimi gizle',
    aciklama: 'Toplam yüklediğin coin miktarı profilde görünmez',
  },
  {
    key: 'hide_level',
    label: 'Seviyemi gizle',
    aciklama: 'Seviye ve tecrübe puanın profilde görünmez',
  },
  {
    key: 'hide_crown',
    label: 'Seviye tacımı gizle',
    aciklama: 'Avatarını saran parıltılı taç çerçevesi kapanır',
  },
  {
    key: 'hide_account_value',
    label: 'Hesap değerimi gizle',
    aciklama: 'Güven / kalite skorun profil ziyaretlerinde görünmez',
  },
  {
    key: 'hide_game_stats',
    label: 'Oyun istatistiğimi gizle',
    aciklama: 'Kupa, galibiyet ve lig kartın profilde görünmez',
  },
];
