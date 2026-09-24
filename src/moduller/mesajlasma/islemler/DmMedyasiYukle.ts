import { supabase } from '../../../lib/supabase';
import i18n from '../../../i18n';
import { OrtamDegiskenleri } from '../../../yapilandirma/OrtamDegiskenleri';
import { GaleriAc, KameraAc } from '../../../ortak/medya/ImagePickerHazirMi';
import {
  DepoyaMedyaYukle,
  MedyaUzantisiCoz,
} from '../../../ortak/medya/DepoyaMedyaYukle';

export type DmMedyaTuru = 'image' | 'video';
export type DmMedyaKaynak = 'galeri' | 'kamera';

function publicUrl(path: string): string {
  const base = OrtamDegiskenleri.supabaseUrl?.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/dm-media/${path}`;
}

/** Galeri veya kamera: foto / video → dm-media bucket */
export async function DmMedyasiSecVeYukle(
  tur: DmMedyaTuru,
  opts?: {
    kaynak?: DmMedyaKaynak;
    onYuklemeBasladi?: () => void;
  },
): Promise<
  | { ok: true; url: string; messageType: DmMedyaTuru }
  | { ok: false; hata: string; iptal?: boolean }
> {
  try {
    const kaynak = opts?.kaynak ?? 'galeri';
    const pickerOpts = {
      mediaTypes: (tur === 'video' ? ['videos'] : ['images']) as (
        | 'images'
        | 'videos'
      )[],
      videoMaxDuration: 120,
    };
    const secim =
      kaynak === 'kamera'
        ? await KameraAc(pickerOpts)
        : await GaleriAc(pickerOpts);
    if (!secim.ok) return secim;

    opts?.onYuklemeBasladi?.();

    const asset = secim.asset;
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return { ok: false, hata: i18n.t('ortak.oturumYok') };

    const { YaptirimAktifMi } = await import(
      '../../admin/ses-odalari/AdminSesOdasiIslemleri'
    );
    if (await YaptirimAktifMi('upload_ban')) {
      return { ok: false, hata: i18n.t('durumX.uploadBan') };
    }

    const ext = MedyaUzantisiCoz(
      asset.uri,
      asset.mimeType,
      tur === 'video' ? 'mp4' : 'jpg',
    );
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const up = await DepoyaMedyaYukle(supabase, {
      bucket: 'dm-media',
      path,
      uri: asset.uri,
      mime: asset.mimeType,
      tur,
      upsert: false,
    });

    if (!up.ok) return { ok: false, hata: up.hata };

    const { data: pub } = supabase.storage.from('dm-media').getPublicUrl(path);
    return {
      ok: true,
      url: pub?.publicUrl || publicUrl(path),
      messageType: tur,
    };
  } catch (e) {
    return {
      ok: false,
      hata: e instanceof Error ? e.message : i18n.t('durumX.yuklemeBasarisiz'),
    };
  }
}
