import i18n from '../../../i18n';
import { supabase } from '../../../lib/supabase';
import { GaleriAc } from '../../../ortak/medya/ImagePickerHazirMi';
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
 * İzin beklemeden sistem seçiciyi açar (PHPicker / Photo Picker).
 */
export async function ProfilMedyasiSec(
  _tur: ProfilMedyaTuru,
): Promise<
  | { ok: true; medya: SecilenProfilMedya }
  | { ok: false; hata: string; iptal?: boolean }
> {
  const secim = await GaleriAc({ mediaTypes: ['images'] });
  if (!secim.ok) {
    if (secim.hata.includes('build') || secim.hata.includes('native')) {
      return {
        ok: false,
        hata: i18n.t('auth.fotoSeciciYok'),
        iptal: secim.iptal,
      };
    }
    return secim;
  }

  return {
    ok: true,
    medya: { uri: secim.asset.uri, mimeType: secim.asset.mimeType },
  };
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
    if (!uid) return { ok: false, hata: i18n.t('ortak.oturumYok') };

    const { YaptirimAktifMi } = await import(
      '../../admin/ses-odalari/AdminSesOdasiIslemleri'
    );
    if (await YaptirimAktifMi('upload_ban')) {
      return {
        ok: false,
        hata: i18n.t('auth.yuklemeCezasi'),
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
        hata: i18n.t('auth.medyaYuklenemedi'),
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
        hata: i18n.t('auth.medyaYuklenemedi'),
      };
    }

    return { ok: true, url };
  } catch (e) {
    return { ok: false, hata: i18n.t('auth.medyaYuklenemedi') };
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
