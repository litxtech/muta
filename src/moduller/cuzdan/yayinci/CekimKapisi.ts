/**
 * Yayıncı para çekme kapısı — istemci tarafı yönlendirme kararı.
 *
 * Tek doğruluk kaynağı sunucudur (`yayinci_odeme_talebi_olustur` +
 * `creator_payout_requests_identity_gate`). Buradaki fonksiyonlar yalnızca
 * kullanıcıyı doğru ekrana (Tamuso Verify / ödeme hesabı) yönlendirmek ve
 * sunucudan dönen hata kodunu anlaşılır metne çevirmek içindir.
 */
import type { CeviriAnahtari } from '../../../i18n/useCeviri';
import { FinansIdempotencyAnahtariOlustur } from '../islemler/FinansIdempotencyAnahtariOlustur';
import type { YayinciKazancOzeti, YayinciUygunluk } from './YayinciKazancApi';

export type CekimYonlendirme = 'kimlik' | 'hesap' | 'profil';

export type CekimDurumKodu =
  | 'kapali'
  | 'program'
  | 'kimlik'
  | 'kimlik_inceleme'
  | 'kimlik_belge'
  | 'profil'
  | 'hesap'
  | 'risk'
  | 'acik_talep'
  | 'minimum'
  | 'ulke'
  | 'hazir';

export type CekimDurumu = {
  kod: CekimDurumKodu;
  baslikAnahtari: CeviriAnahtari;
  metinAnahtari: CeviriAnahtari;
  /** Butona basınca gidilecek adım; null ise talep akışı çalışır. */
  yonlendirme: CekimYonlendirme | null;
  /** true ise "Para çekme talebi oluştur" butonu aktif. */
  talepOlusturulabilir: boolean;
  ton: 'bilgi' | 'uyari' | 'engel' | 'basari';
};

/** Kimlik başvurusu hâlâ inceleme akışında mı? */
const INCELEMEDE: string[] = [
  'in_progress',
  'awaiting_document',
  'awaiting_selfie',
  'under_review',
  'additional_verification',
  'appeal_review',
];

export function KimlikIncelemedeMi(durum: string | null | undefined): boolean {
  return INCELEMEDE.includes(String(durum ?? ''));
}

const HAZIR: CekimDurumu = {
  kod: 'hazir',
  baslikAnahtari: 'verify.cekimHazirBaslik',
  metinAnahtari: 'verify.cekimHazirMetin',
  yonlendirme: null,
  talepOlusturulabilir: true,
  ton: 'basari',
};

export function CekimDurumunuHesapla(
  durum: YayinciUygunluk | undefined,
  ozet: YayinciKazancOzeti | null | undefined,
  /** false → vergi/şirket/banka profili eksik; undefined → eski davranış. */
  profilTamam?: boolean,
): CekimDurumu {
  if (ozet && ozet.withdrawals_enabled === false) {
    return {
      kod: 'kapali',
      baslikAnahtari: 'verify.cekimKapaliBaslik',
      metinAnahtari: 'verify.cekimKapaliMetin',
      yonlendirme: null,
      talepOlusturulabilir: false,
      ton: 'bilgi',
    };
  }

  if (!durum?.program_approved) {
    return {
      kod: 'program',
      baslikAnahtari: 'verify.cekimProgramBaslik',
      metinAnahtari: 'verify.cekimProgramMetin',
      yonlendirme: null,
      talepOlusturulabilir: false,
      ton: 'bilgi',
    };
  }

  if (!durum.kyc_verified) {
    const kimlikDurumu = durum.verify?.identity_status ?? null;
    if (KimlikIncelemedeMi(kimlikDurumu)) {
      return {
        kod: 'kimlik_inceleme',
        baslikAnahtari: 'verify.cekimKimlikIncelemeBaslik',
        metinAnahtari: 'verify.cekimKimlikIncelemeMetin',
        yonlendirme: 'kimlik',
        talepOlusturulabilir: false,
        ton: 'bilgi',
      };
    }
    return {
      kod: 'kimlik',
      baslikAnahtari: 'verify.cekimKimlikBaslik',
      metinAnahtari: 'verify.cekimKimlikMetin',
      yonlendirme: 'kimlik',
      talepOlusturulabilir: false,
      ton: 'uyari',
    };
  }

  // Kimlik onaylı ama belge seviyesi ödeme için yetersiz (ör. yalnızca ön yüz).
  if (durum.verify && durum.verify.document_level_ok === false) {
    return {
      kod: 'kimlik_belge',
      baslikAnahtari: 'verify.cekimBelgeSeviyeBaslik',
      metinAnahtari: 'verify.cekimBelgeSeviyeMetin',
      yonlendirme: 'kimlik',
      talepOlusturulabilir: false,
      ton: 'uyari',
    };
  }

  // Vergi no + şirket beyanı + belgeler + banka tek ekranda toplanır.
  if (profilTamam === false) {
    return {
      kod: 'profil',
      baslikAnahtari: 'verify.cekimProfilBaslik',
      metinAnahtari: 'verify.cekimProfilMetin',
      yonlendirme: 'profil',
      talepOlusturulabilir: false,
      ton: 'uyari',
    };
  }

  if (!durum.payout_account_verified) {
    return {
      kod: 'hesap',
      baslikAnahtari: 'verify.cekimHesapBaslik',
      metinAnahtari: 'verify.cekimHesapMetin',
      yonlendirme: 'hesap',
      talepOlusturulabilir: false,
      ton: 'uyari',
    };
  }

  if (durum.open_high_risk) {
    return {
      kod: 'risk',
      baslikAnahtari: 'verify.cekimRiskBaslik',
      metinAnahtari: 'verify.cekimRiskMetin',
      yonlendirme: null,
      talepOlusturulabilir: false,
      ton: 'engel',
    };
  }

  if (ozet?.open_request) {
    return {
      kod: 'acik_talep',
      baslikAnahtari: 'verify.cekimAcikTalepBaslik',
      metinAnahtari: 'verify.cekimAcikTalepMetin',
      yonlendirme: null,
      talepOlusturulabilir: false,
      ton: 'bilgi',
    };
  }

  if (ozet && ozet.minimum_reached === false) {
    return {
      kod: 'minimum',
      baslikAnahtari: 'verify.cekimMinimumBaslik',
      metinAnahtari: 'verify.cekimMinimumMetin',
      yonlendirme: null,
      talepOlusturulabilir: false,
      ton: 'bilgi',
    };
  }

  return HAZIR;
}

/**
 * Sunucu hata kodunu kullanıcı metnine çevirir.
 * Kodlar `identity_odeme_kosullari` ve `yayinci_odeme_talebi_olustur` ile aynıdır.
 */
export function CekimHataAnahtari(kod: string | undefined | null): CeviriAnahtari {
  switch ((kod ?? '').trim()) {
    case 'identity_required':
    case 'kyc_required':
      return 'verify.cekimHataKimlik';
    case 'identity_document_level_insufficient':
      return 'verify.cekimHataBelgeSeviye';
    case 'payout_profile_required':
    case 'profile_required':
      return 'verify.cekimHataProfil';
    case 'bank_account_required':
      return 'verify.cekimHataHesap';
    case 'below_minimum':
      return 'verify.cekimHataMinimum';
    case 'open_request_exists':
      return 'verify.cekimHataAcikTalep';
    case 'withdrawals_unavailable':
      return 'verify.cekimHataKapali';
    case 'security_review':
      return 'verify.cekimHataRisk';
    case 'adult_required':
      return 'verify.cekimHataYetiskin';
    case 'program_contract_required':
      return 'verify.cekimHataSozlesme';
    case 'country_payout_not_supported':
      return 'verify.cekimHataUlke';
    default:
      return 'verify.cekimHataGenel';
  }
}

/** Sunucu hatasında kullanıcıyı hangi ekrana göndermeliyiz? */
export function CekimHataYonlendirmesi(
  kod: string | undefined | null,
): CekimYonlendirme | null {
  switch ((kod ?? '').trim()) {
    case 'identity_required':
    case 'kyc_required':
    case 'identity_document_level_insufficient':
      return 'kimlik';
    case 'payout_profile_required':
    case 'profile_required':
      return 'profil';
    case 'bank_account_required':
      return 'hesap';
    default:
      return null;
  }
}

export const KIMLIK_DOGRULA_HREF = '/cuzdan/yayinci-kazanclari/kimlik-dogrula' as const;
export const ODEME_HESABI_HREF = '/cuzdan/yayinci-kazanclari/odeme-hesabi' as const;
export const ODEME_PROFILI_HREF = '/cuzdan/yayinci-kazanclari/odeme-profili' as const;

/** Aynı talebin çift oluşmaması için oturum boyunca korunacak anahtar. */
export function YeniCekimAnahtari(): string {
  return FinansIdempotencyAnahtariOlustur('creator_payout');
}
