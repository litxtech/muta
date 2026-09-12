import { supabase } from '../../../lib/supabase';
import { OzellikBayragiAktifMiSunucu } from '../../ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';

export type Duyuru = {
  id: string;
  title: string;
  body: string;
  priority: string;
  starts_at: string;
  deep_link: string | null;
};

export async function AktifDuyurulariGetir(limit = 20): Promise<Duyuru[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('starts_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Duyuru[]) ?? [];
}

export async function DuyuruOkunduIsaretle(announcementId: string) {
  if (!(await OzellikBayragiAktifMiSunucu('announcements_enabled'))) {
    return { ok: false as const, hata: 'announcements_enabled kapalı.' };
  }
  const { error } = await supabase.rpc('duyuru_okundu_isaretle', {
    p_announcement_id: announcementId,
  });
  if (error) return { ok: false as const, hata: error.message };
  return { ok: true as const };
}
