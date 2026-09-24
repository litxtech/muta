import { supabase } from '../../../lib/supabase';
import i18n from '../../../i18n';

export type KullaniciRaporOzeti = {
  id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed' | string;
  content_type: string | null;
  content_id: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter_note: string | null;
  target: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    public_user_id: string | null;
  } | null;
};

export async function RaporlarimiListele(
  limit = 40,
): Promise<KullaniciRaporOzeti[]> {
  const { data, error } = await supabase.rpc('raporlarimi_listele', {
    p_limit: limit,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as KullaniciRaporOzeti[];
}

export async function RaporumuGetir(
  id: string,
): Promise<KullaniciRaporOzeti> {
  const { data, error } = await supabase.rpc('raporumu_getir', { p_id: id });
  if (error) throw error;
  return data as KullaniciRaporOzeti;
}

export function RaporDurumEtiketiKullanici(status: string): string {
  switch (status) {
    case 'open':
      return i18n.t('raporlarim.durumAlindi') as string;
    case 'reviewing':
      return i18n.t('raporlarim.durumInceleniyor') as string;
    case 'resolved':
      return i18n.t('raporlarim.durumSonuclandi') as string;
    case 'dismissed':
      return i18n.t('raporlarim.durumKapatildi') as string;
    default:
      return status;
  }
}
