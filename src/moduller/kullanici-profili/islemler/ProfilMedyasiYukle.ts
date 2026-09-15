import { supabase } from '../../../lib/supabase';
import { ImagePickerModuluYukle } from '../../../ortak/medya/ImagePickerHazirMi';
import {
  DepoyaMedyaYukle,
  MedyaUzantisiCoz,
} from '../../../ortak/medya/DepoyaMedyaYukle';

export type ProfilMedyaTuru = 'avatar' | 'cover';

export type SecilenProfilMedya = {
  uri: string;
  mimeType?: string | null;
};

/**
 * Galeriden profil görseli seçer (yüklemez). Kayıt öncesi önizleme için.
 */
export async function ProfilMedyasiSec(
  tur: ProfilMedyaTuru,
): Promise<
  | { ok: true; medya: SecilenProfilMedya }
  | { ok: false; hata: string; iptal?: boolean }
> {
  const mod = await ImagePickerModuluYukle();
  if (!mod.ok) {
    return {
      ok: false,
      hata: mod.hata.includes('build')
        ? 'Fotoğraf seçici bu build’de yok. Yeni development build kur.'
        : mod.hata,
    };
  }

  const { ImagePicker } = mod;

  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, hata: 'Galeri izni gerekli.' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: tur === 'cover' ? [3, 1] : [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { ok: false, hata: 'İptal', iptal: true };
    }

    const asset = result.assets[0];
    return {
      ok: true,
      medya: { uri: asset.uri, mimeType: asset.mimeType },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('ExponentImagePicker') || msg.includes('native module')) {
      return {
        ok: false,
        hata: 'Fotoğraf seçici native modülü yok. Yeni development build kur.',
      };
    }
    return { ok: false, hata: msg };
  }
}

/**
 * Yerel URI'yi Supabase storage'a yükler; profiles.avatar_url / cover_url günceller.
 */
export async function ProfilMedyasiUriIleYukle(
  tur: ProfilMedyaTuru,
  uri: string,
  mimeType?: string | null,
): Promise<{ ok: true; url: string } | { ok: false; hata: string }> {
  try {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return { ok: false, hata: 'Oturum yok' };

    const { YaptirimAktifMi } = await import(
      '../../admin/ses-odalari/AdminSesOdasiIslemleri'
    );
    if (await YaptirimAktifMi('upload_ban')) {
      return {
        ok: false,
        hata: 'Yükleme cezan aktif. Medya yükleyemezsin.',
      };
    }

    const ext = MedyaUzantisiCoz(uri, mimeType, 'jpg');
    const path = `${uid}/${tur}-${Date.now()}.${ext}`;

    const up = await DepoyaMedyaYukle(supabase, {
      bucket: 'profile-media',
      path,
      uri,
      mime: mimeType,
      tur: 'image',
      upsert: true,
    });

    if (!up.ok) {
      return {
        ok: false,
        hata: up.hata.includes('Bucket')
          ? 'Medya deposu hazır değil (migration 016).'
          : up.hata,
      };
    }

    const { data: pub } = supabase.storage.from('profile-media').getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    const column = tur === 'avatar' ? 'avatar_url' : 'cover_url';

    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ [column]: url })
      .eq('id', uid);

    if (dbErr) {
      return {
        ok: false,
        hata:
          column === 'cover_url' && dbErr.message.includes('cover_url')
            ? 'Kapak alanı henüz yok (migration 016).'
            : dbErr.message,
      };
    }

    return { ok: true, url };
  } catch (e) {
    return { ok: false, hata: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Galeriinden seçip Supabase storage'a yükler; profiles.avatar_url / cover_url günceller.
 */
export async function ProfilMedyasiYukle(
  tur: ProfilMedyaTuru,
): Promise<{ ok: true; url: string } | { ok: false; hata: string; iptal?: boolean }> {
  const secim = await ProfilMedyasiSec(tur);
  if (!secim.ok) return secim;

  const yukleme = await ProfilMedyasiUriIleYukle(
    tur,
    secim.medya.uri,
    secim.medya.mimeType,
  );
  if (!yukleme.ok) return yukleme;
  return yukleme;
}
