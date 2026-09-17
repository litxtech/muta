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
  return istegeBagli ? `${etiket} (isteğe bağlı)` : etiket;
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
      hata: 'Kullanıcı adı, görünen ad ve şifre gerekli.',
    };
  }
  if (girdi.password.length < 6) {
    return { ok: false, hata: 'Şifre en az 6 karakter olmalı.' };
  }

  const phoneMod = ayar.alanlar.phone;
  const emailMod = ayar.alanlar.email;
  const genderMod = ayar.alanlar.gender;
  const birthMod = ayar.alanlar.birth_date;
  const avatarMod = ayar.alanlar.avatar;

  const phoneHam = AlanGorunurMu(phoneMod) ? girdi.phone.trim() : '';
  const emailHam = AlanGorunurMu(emailMod) ? girdi.email.trim() : '';

  if (AlanZorunluMu(phoneMod) && !phoneHam) {
    return { ok: false, hata: 'Telefon numarası gerekli.' };
  }
  if (AlanZorunluMu(emailMod) && !emailHam) {
    return { ok: false, hata: 'E-posta gerekli.' };
  }

  // Auth için telefon veya gerçek e-posta şart
  if (!phoneHam && !emailHam.includes('@')) {
    if (AlanGorunurMu(emailMod)) {
      return {
        ok: false,
        hata: 'Telefon yoksa geçerli bir e-posta yazmalısın.',
      };
    }
    return {
      ok: false,
      hata: 'Kayıt için telefon veya e-posta gerekli. Admin panelinden en az birini aç.',
    };
  }

  if (AlanZorunluMu(genderMod) && !girdi.gender) {
    return { ok: false, hata: 'Cinsiyet seçmelisin.' };
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
    return { ok: false, hata: 'Profil fotoğrafı gerekli.' };
  }

  const customFields: Record<string, string> = {};
  for (const alan of ayar.ozel_alanlar) {
    if (alan.aktif === false) continue;
    const deger = (girdi.ozelDegerler[alan.anahtar] ?? '').trim();
    if (alan.mod === 'required' && !ozelDoldurulduMu(alan, deger)) {
      return { ok: false, hata: `${alan.etiket} gerekli.` };
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
