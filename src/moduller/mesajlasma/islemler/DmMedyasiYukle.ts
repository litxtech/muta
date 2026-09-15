import { supabase } from '../../../lib/supabase';
import { OrtamDegiskenleri } from '../../../yapilandirma/OrtamDegiskenleri';
import { ImagePickerModuluYukle } from '../../../ortak/medya/ImagePickerHazirMi';
import {
  DepoyaMedyaYukle,
  MedyaUzantisiCoz,
} from '../../../ortak/medya/DepoyaMedyaYukle';

export type DmMedyaTuru = 'image' | 'video';

function publicUrl(path: string): string {
  const base = OrtamDegiskenleri.supabaseUrl?.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/dm-media/${path}`;
}

/** Galeri: foto veya video → dm-media bucket */
export async function DmMedyasiSecVeYukle(
  tur: DmMedyaTuru,
): Promise<
  | { ok: true; url: string; messageType: DmMedyaTuru }
  | { ok: false; hata: string; iptal?: boolean }
> {
  const mod = await ImagePickerModuluYukle();
  if (!mod.ok) return { ok: false, hata: mod.hata };

  const { ImagePicker } = mod;

  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { ok: false, hata: 'Galeri izni gerekli.' };

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: tur === 'video' ? ['videos'] : ['images'],
      quality: 0.82,
      videoMaxDuration: 120,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { ok: false, hata: 'İptal', iptal: true };
    }

    const asset = result.assets[0];
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return { ok: false, hata: 'Oturum yok' };

    const { YaptirimAktifMi } = await import(
      '../../admin/ses-odalari/AdminSesOdasiIslemleri'
    );
    if (await YaptirimAktifMi('upload_ban')) {
      return { ok: false, hata: 'Yükleme cezan aktif. Medya yükleyemezsin.' };
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
      hata: e instanceof Error ? e.message : 'Yükleme başarısız',
    };
  }
}
