/** Ödeme profili tipleri — ağ katmanından bağımsız. */

export const ODEME_BELGE_KOVASI = 'creator-payout-docs';
export const ODEME_BELGE_MAX_BAYT = 10 * 1024 * 1024;
export const ODEME_PROFILI_HREF = '/cuzdan/yayinci-kazanclari/odeme-profili' as const;

export type OdemeBelgeTuru =
  | 'personal_id'
  | 'tax_certificate'
  | 'company_registration'
  | 'company_signature'
  | 'bank_letter'
  | 'address_proof'
  | 'other';

export type OdemeBelgeDurumu = 'submitted' | 'under_review' | 'approved' | 'rejected';
export type OdemeProfiliDurumu = 'incomplete' | 'submitted' | 'verified' | 'rejected';

export type OdemeProfiliEksigi =
  | 'profil'
  | 'ad'
  | 'soyad'
  | 'telefon'
  | 'ulke'
  | 'vergi_no'
  | 'sirket_adi'
  | 'sirket_vergi_no'
  | 'vergi_belgesi'
  | 'sirket_belgesi';

export type OdemeProfiliBelgesi = {
  id: string;
  doc_type: OdemeBelgeTuru;
  version: number;
  status: OdemeBelgeDurumu;
  file_name: string | null;
  mime: string;
  byte_size: number | null;
  created_at: string;
  review_note: string | null;
  reviewed_at: string | null;
};

export type OdemeProfiliKaydi = {
  country_code: string;
  legal_first_name: string;
  legal_last_name: string;
  phone_country_code: string | null;
  phone: string;
  tax_number: string | null;
  tax_office: string | null;
  has_company: boolean;
  company_name: string | null;
  company_tax_number: string | null;
  company_country_code: string | null;
  status: OdemeProfiliDurumu;
  submitted_at: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  updated_at: string | null;
};

export type OdemeBankaOzeti = {
  exists: boolean;
  status: string;
  country_code: string | null;
  account_holder: string | null;
  bank_name: string | null;
  scheme: string | null;
  currency: string | null;
  masked: Record<string, string>;
};

export type OdemeProfiliVerisi = {
  exists: boolean;
  status: OdemeProfiliDurumu;
  tamam: boolean;
  eksikler: OdemeProfiliEksigi[];
  sirket_yok: boolean;
  has_company: boolean;
  belge_gerekli: OdemeBelgeTuru[];
  profile: OdemeProfiliKaydi | null;
  documents: OdemeProfiliBelgesi[];
  banka: OdemeBankaOzeti;
};

export type OdemeProfiliGirdisi = {
  countryCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  taxNumber?: string | null;
  taxOffice?: string | null;
  hasCompany: boolean;
  companyName?: string | null;
  companyTaxNumber?: string | null;
  companyCountryCode?: string | null;
  phoneCountryCode?: string | null;
};

export type OdemeIslemSonucu<T = unknown> =
  | { ok: true; veri: T }
  | { ok: false; kod: string; hata?: string };

export type BelgeYukleGirdisi = {
  tur: OdemeBelgeTuru;
  uri: string;
  dosyaAdi: string;
  mime?: string | null;
  byteSize?: number | null;
};
