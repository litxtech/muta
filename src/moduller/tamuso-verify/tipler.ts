/**
 * Tamuso Verify — istemci tipleri.
 *
 * Sunucu (SECURITY DEFINER RPC) tek doğruluk kaynağıdır; bu tipler yalnızca
 * dönen jsonb yapılarını tarif eder.
 */

export type VerifyDurumKodu =
  | 'not_started'
  | 'in_progress'
  | 'awaiting_document'
  | 'awaiting_selfie'
  | 'under_review'
  | 'additional_verification'
  | 'approved'
  | 'rejected'
  | 'appeal_review';

export type VerifyBelgeTuru =
  | 'id_card'
  | 'passport'
  | 'drivers_license'
  | 'residence_permit';

export type VerifyBelgeYuzu = 'front' | 'back' | 'selfie';

export type VerifyAdim =
  | 'center'
  | 'right'
  | 'left'
  | 'blink'
  | 'smile';

export type VerifyBelgeTuruDestegi = {
  doc_type: VerifyBelgeTuru;
  sides_required: number;
  mrz_supported: boolean;
};

export type VerifyBasvuru = {
  id: string;
  country_code: string;
  doc_type: VerifyBelgeTuru;
  status: VerifyDurumKodu;
  submitted_at: string | null;
  created_at: string;
  updated_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  last_review_note: string | null;
  declared_first_name: string | null;
  declared_last_name: string | null;
  declared_birth_date: string | null;
  ocr_state: string | null;
  selfie_attempts: number | null;
};

export type VerifyKarar = {
  decision: 'approved' | 'rejected' | 'additional_verification';
  reason_code: string | null;
  reason: string | null;
  created_at: string;
};

export type VerifyItiraz = {
  id: string;
  status: 'open' | 'reviewing' | 'resolved' | 'rejected';
  message: string;
  resolution_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type VerifyOdemeOzeti = {
  ok?: boolean;
  kodlar?: string[];
  identity_approved?: boolean;
  identity_status?: VerifyDurumKodu;
  document_level?: string;
  document_level_ok?: boolean;
  min_balance_ok?: boolean;
  available_usd?: number;
  minimum_usd?: number;
  risk_ok?: boolean;
  country_payout_ok?: boolean;
};

export type VerifyDurum = {
  status: VerifyDurumKodu;
  application: VerifyBasvuru | null;
  documents: Partial<Record<VerifyBelgeYuzu, boolean>>;
  belge_turleri: VerifyBelgeTuruDestegi[];
  selfie_kalan_deneme: number;
  selfie_deneme_limiti: number;
  saklama_gun: number;
  son_karar: VerifyKarar | null;
  itiraz: VerifyItiraz | null;
  odeme: VerifyOdemeOzeti;
};

export type VerifyOturum = {
  ok: boolean;
  session_id: string;
  nonce: string;
  challenge_sequence: VerifyAdim[];
  expires_at: string;
  kalan_deneme: number;
  sure_saniye: number;
};

export type VerifySelfieAdimi = {
  adim: VerifyAdim;
  tamamlandi: boolean;
};

export type VerifyBelgeKalitesi = {
  state: 'passed' | 'warned' | 'failed' | 'unknown';
  kodlar: string[];
  metrikler?: {
    genislik: number;
    yukseklik: number;
    parlaklik: number;
    kontrast: number;
    keskinlik: number;
    parlakOran: number;
    karanlikOran: number;
  };
};

export type VerifyCekimSonucu = {
  uri: string;
  genislik: number;
  yukseklik: number;
  mime: string;
  kalite: VerifyBelgeKalitesi;
  kaynak: 'camera' | 'library';
};

export type VerifyApiSonucu<T> =
  | { ok: true; veri: T }
  | { ok: false; kod: string; mesaj: string };

export const VERIFY_DURUMLARI: VerifyDurumKodu[] = [
  'not_started',
  'in_progress',
  'awaiting_document',
  'awaiting_selfie',
  'under_review',
  'additional_verification',
  'approved',
  'rejected',
  'appeal_review',
];
