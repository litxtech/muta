import i18n from '../../../i18n';
import type { KayitAlanAyarlari, KayitOzelAlan } from './tipler';
import { AlanGorunurMu, AlanZorunluMu } from './tipler';
import { DogumTarihiDogrula } from '../yas/YasKapisi';

export type KayitFormGirdi = {
  username: string;
  displayName: string;
  password: string;
  phone: string;
  email: string;
  gender: string;
  dogumYil: string;
  dogumAy: string;
  dogumGun: string;
  avatarVar: boolean;
  ozelDegerler: Record<string, string>;
};

export type KayitFormDogrulamaSonuc =
  | {
      ok: true;
      phone?: string;
      email?: string;
      gender?: string;
      birthDate?: string;
      customFields: Record<string, string>;
    }
  | { ok: false; hata: string };

function etiketZorunlu(etiket: string, istegeBagli: boolean): string {
  return istegeBagli
    ? i18n.t('auth.etiketIstegeBagli', { etiket })
    : etiket;
}

export function KayitAlanEtiketi(
  etiket: string,
  zorunlu: boolean,
): string {
  return etiketZorunlu(etiket, !zorunlu);
}

function ozelDoldurulduMu(alan: KayitOzelAlan, deger: string): boolean {
  return deger.trim().length > 0;
}

/** Kayıt formu doğrulama — admin ayarlarına göre */
export function KayitFormunuDogrula(
  ayar: KayitAlanAyarlari,
  girdi: KayitFormGirdi,
): KayitFormDogrulamaSonuc {
  if (!girdi.username.trim() || !girdi.displayName.trim() || !girdi.password) {
    return {
      ok: false,
      hata: i18n.t('auth.kimlikSifreGerekli'),
    };
  }
  if (girdi.password.length < 6) {
    return { ok: false, hata: i18n.t('auth.sifreMinKarakter') };
  }

  const phoneMod = ayar.alanlar.phone;
  const emailMod = ayar.alanlar.email;
  const genderMod = ayar.alanlar.gender;
  const birthMod = ayar.alanlar.birth_date;
  const avatarMod = ayar.alanlar.avatar;

  const phoneHam = AlanGorunurMu(phoneMod) ? girdi.phone.trim() : '';
  const emailHam = AlanGorunurMu(emailMod) ? girdi.email.trim() : '';

  if (AlanZorunluMu(phoneMod) && !phoneHam) {
    return { ok: false, hata: i18n.t('auth.telefonGerekli') };
  }
  if (AlanZorunluMu(emailMod) && !emailHam) {
    return { ok: false, hata: i18n.t('auth.epostaGerekli') };
  }

  // Auth için telefon veya gerçek e-posta şart
  if (!phoneHam && !emailHam.includes('@')) {
    if (AlanGorunurMu(emailMod)) {
      return {
        ok: false,
        hata: i18n.t('auth.epostaGecerliYaz'),
      };
    }
    return {
      ok: false,
      hata: i18n.t('auth.telefonVeyaEposta'),
    };
  }

  if (AlanZorunluMu(genderMod) && !girdi.gender) {
    return { ok: false, hata: i18n.t('auth.cinsiyetSec') };
  }

  let birthDate: string | undefined;
  const dogumGorunur = AlanGorunurMu(birthMod);
  const dogumDolu =
    dogumGorunur && !!(girdi.dogumYil && girdi.dogumAy && girdi.dogumGun);
  const dogumKismi =
    dogumGorunur &&
    !!(girdi.dogumYil || girdi.dogumAy || girdi.dogumGun) &&
    !dogumDolu;

  if (AlanZorunluMu(birthMod) || dogumDolu || dogumKismi) {
    const dogum = DogumTarihiDogrula(
      girdi.dogumYil,
      girdi.dogumAy,
      girdi.dogumGun,
    );
    if (!dogum.ok) return { ok: false, hata: dogum.hata };
    birthDate = dogum.iso;
  }

  if (AlanZorunluMu(avatarMod) && !girdi.avatarVar) {
    return { ok: false, hata: i18n.t('auth.profilFotoGerekli') };
  }

  const customFields: Record<string, string> = {};
  for (const alan of ayar.ozel_alanlar) {
    if (alan.aktif === false) continue;
    const deger = (girdi.ozelDegerler[alan.anahtar] ?? '').trim();
    if (alan.mod === 'required' && !ozelDoldurulduMu(alan, deger)) {
      return { ok: false, hata: i18n.t('auth.alanGerekli', { alan: alan.etiket }) };
    }
    if (deger) customFields[alan.anahtar] = deger;
  }

  return {
    ok: true,
    phone: phoneHam || undefined,
    email: emailHam.includes('@') ? emailHam.toLowerCase() : undefined,
    gender:
      AlanGorunurMu(genderMod) && girdi.gender
        ? girdi.gender
        : undefined,
    birthDate,
    customFields,
  };
}
