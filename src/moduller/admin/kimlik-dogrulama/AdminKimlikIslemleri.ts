/**
 * Tamuso Verify — web admin istemci katmanı (yalnızca RPC + kısa ömürlü URL).
 *
 * Belge görüntüsü hiçbir zaman doğrudan okunmaz: önce `admin_identity_belge_erisim`
 * denetim kaydı yazar ve depolama yolunu döner; ardından 300 sn ömürlü imzalı URL
 * üretilir. Public URL üretilmez.
 */
import { supabase } from '../../../lib/supabase';

export const VERIFY_DOC_BUCKET = 'tamuso-verify-docs';
export const IMZALI_URL_SANIYE = 300;

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

export type AdminVerifyOzet = {
  toplam: number;
  bugun: number;
  inceleme_bekleyen: number;
  eksik_belge: number;
  selfie_bekleyen: number;
  ek_dogrulama: number;
  onaylanan: number;
  reddedilen: number;
  itiraz: number;
  ikinci_onay_bekleyen: number;
  bugun_karar: number;
  ortalama_inceleme_saat: number;
  acik_itiraz: number;
  bugun_yukleme: number;
  saklama_gun: number;
  ikinci_onay_zorunlu: boolean;
  belge_goruntuleme_yetkisi: boolean;
  onay_yetkisi: boolean;
  red_yetkisi: boolean;
  ayar_yetkisi: boolean;
};

export type AdminVerifyKayit = {
  id: string;
  user_id: string;
  status: VerifyDurumKodu;
  country_code: string;
  doc_type: string;
  declared_first_name: string | null;
  declared_last_name: string | null;
  selfie_attempts: number | null;
  submitted_at: string | null;
  decided_at: string | null;
  pending_action: string | null;
  created_at: string;
  updated_at: string | null;
  display_name: string | null;
  username: string | null;
  public_user_id: string | null;
};

export type AdminVerifyBelge = {
  id: string;
  side: 'front' | 'back' | 'selfie';
  mime: string;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  capture_source: string;
  quality_state: string;
  quality: Record<string, unknown> | null;
  ocr_fields: Record<string, unknown> | null;
  created_at: string;
};

export type AdminVerifyOlay = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
};

export type AdminVerifyDetay = {
  application: {
    id: string;
    user_id: string;
    status: VerifyDurumKodu;
    country_code: string;
    doc_type: string;
    sides_required: number;
    declared_first_name: string | null;
    declared_last_name: string | null;
    declared_birth_date: string | null;
    ocr_state: string | null;
    selfie_attempts: number | null;
    consent_version: string | null;
    consent_accepted_at: string | null;
    age_confirmed_at: string | null;
    submitted_at: string | null;
    reviewer_id: string | null;
    decided_at: string | null;
    decision_reason: string | null;
    decision_note: string | null;
    last_review_note: string | null;
    pending_action: string | null;
    pending_actor: string | null;
    pending_reason: string | null;
    pending_at: string | null;
    created_at: string;
    updated_at: string | null;
  };
  profile: {
    id?: string;
    display_name?: string | null;
    username?: string | null;
    public_user_id?: string | null;
    avatar_url?: string | null;
    birth_date?: string | null;
    is_guest?: boolean;
    created_at?: string;
  };
  wallet: {
    wallet_number?: string | null;
    brand?: string | null;
    legal_first_name?: string | null;
    legal_last_name?: string | null;
    kyc_status?: string | null;
  } | null;
  documents: AdminVerifyBelge[];
  session: {
    id: string;
    state: string;
    challenge_sequence: string[];
    attempts: number;
    fraud_signals: Record<string, unknown> | null;
    device_meta: Record<string, unknown> | null;
    expires_at: string;
    consumed_at: string | null;
    created_at: string;
  } | null;
  decision: {
    decision: string;
    reason_code: string | null;
    reason: string | null;
    liveness_claim: string | null;
    face_match_performed: boolean | null;
    decided_by_human: boolean | null;
    created_at: string;
  } | null;
  appeal: {
    id: string;
    status: string;
    message: string;
    resolution_note: string | null;
    created_at: string;
    reviewed_at: string | null;
  } | null;
  events: AdminVerifyOlay[];
  odeme_uygunluk: Record<string, unknown>;
};

export type AdminVerifyItiraz = {
  id: string;
  application_id: string;
  message: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  user_id: string;
  display_name: string | null;
  username: string | null;
  country_code: string;
  doc_type: string;
  application_status: string;
};

export type AdminVerifyDenetim = {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  actor_name: string | null;
  application_id: string | null;
  document_id: string | null;
  action: string;
  purpose: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AdminVerifyAyarlar = {
  selfie_deneme_limiti: number;
  selfie_oturum_saniye: number;
  belge_saklama_gun: number;
  ikinci_onay_zorunlu: boolean;
  updated_at: string;
};

/** Onaylanan kullanıcılar sayfası — onaylı başvurunun tüm yönetici bilgileri. */
export type AdminVerifyOnayliKullanici = {
  id: string;
  user_id: string;
  status: VerifyDurumKodu;
  country_code: string;
  doc_type: string;
  declared_first_name: string | null;
  declared_last_name: string | null;
  declared_birth_date: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  decision_note: string | null;
  last_review_note: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  created_at: string;
  updated_at: string | null;
  display_name: string | null;
  username: string | null;
  public_user_id: string | null;
  avatar_url: string | null;
  phone_e164: string | null;
  email: string | null;
  profile_country_code: string | null;
  profile_birth_date: string | null;
  is_guest: boolean;
  profile_created_at: string | null;
  wallet_number: string | null;
  wallet_brand: string | null;
  legal_first_name: string | null;
  legal_last_name: string | null;
  kyc_status: string | null;
  decision: string | null;
  reason_code: string | null;
  reason: string | null;
  decision_at: string | null;
  decision_reviewer_id: string | null;
  decision_reviewer_name: string | null;
  document_count: number;
  has_front: boolean;
  has_back: boolean;
  has_selfie: boolean;
};

export type AdminVerifyOnayliOzet = {
  onayli_toplam: number;
  bugun_onay: number;
  bu_hafta_onay: number;
  bu_ay_onay: number;
  yeni_basvuru: number;
  inceleme_bekleyen: number;
  bugun_basvuru: number;
  eksik_belge: number;
  selfie_bekleyen: number;
  ek_dogrulama: number;
  acik_itiraz: number;
};

export type AdminIslemTuru =
  | 'start_review'
  | 'request_document'
  | 'request_selfie'
  | 'additional_verification'
  | 'approve'
  | 'reject';

function hata(e: { message?: string } | null): string {
  const ham = (e?.message ?? 'unknown_error').trim();
  return ham.split('\n')[0].trim() || 'unknown_error';
}

export async function AdminVerifyDashboard(): Promise<AdminVerifyOzet> {
  const { data, error } = await supabase.rpc('admin_identity_dashboard');
  if (error) throw new Error(hata(error));
  return data as AdminVerifyOzet;
}

export async function AdminVerifyKuyruk(girdi?: {
  durum?: VerifyDurumKodu | null;
  arama?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ toplam: number; kayitlar: AdminVerifyKayit[] }> {
  const { data, error } = await supabase.rpc('admin_identity_basvurular', {
    p_status: girdi?.durum ?? null,
    p_search: girdi?.arama?.trim() || null,
    p_limit: girdi?.limit ?? 40,
    p_offset: girdi?.offset ?? 0,
  });
  if (error) throw new Error(hata(error));
  const d = (data ?? {}) as { toplam?: number; kayitlar?: AdminVerifyKayit[] };
  return { toplam: Number(d.toplam ?? 0), kayitlar: d.kayitlar ?? [] };
}

/**
 * Onaylı başvuruların tam listesi. Yanıttaki `ozet` bekleyen (yeni) başvuru
 * sayılarını da taşır; sayfa bu sayede yeni başvuru var mı diye kendi kendine
 * kontrol edebilir.
 */
export async function AdminVerifyOnaylananlar(girdi?: {
  arama?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{
  toplam: number;
  kayitlar: AdminVerifyOnayliKullanici[];
  ozet: AdminVerifyOnayliOzet;
}> {
  const { data, error } = await supabase.rpc('admin_identity_onaylananlar', {
    p_search: girdi?.arama?.trim() || null,
    p_limit: girdi?.limit ?? 50,
    p_offset: girdi?.offset ?? 0,
  });
  if (error) throw new Error(hata(error));
  const d = (data ?? {}) as {
    toplam?: number;
    kayitlar?: AdminVerifyOnayliKullanici[];
    ozet?: Partial<AdminVerifyOnayliOzet>;
  };
  const sifir: AdminVerifyOnayliOzet = {
    onayli_toplam: 0,
    bugun_onay: 0,
    bu_hafta_onay: 0,
    bu_ay_onay: 0,
    yeni_basvuru: 0,
    inceleme_bekleyen: 0,
    bugun_basvuru: 0,
    eksik_belge: 0,
    selfie_bekleyen: 0,
    ek_dogrulama: 0,
    acik_itiraz: 0,
  };
  return {
    toplam: Number(d.toplam ?? 0),
    kayitlar: d.kayitlar ?? [],
    ozet: { ...sifir, ...(d.ozet ?? {}) },
  };
}

export async function AdminVerifyDetay(id: string): Promise<AdminVerifyDetay> {
  const { data, error } = await supabase.rpc('admin_identity_basvuru_detay', {
    p_application_id: id,
  });
  if (error) throw new Error(hata(error));
  return data as AdminVerifyDetay;
}

/**
 * Belge görüntüsü için kısa ömürlü imzalı URL.
 * Denetim kaydı RPC içinde yazılır (her çağrıda).
 */
export async function AdminVerifyBelgeUrl(
  documentId: string,
  amac = 'review',
): Promise<{ url: string; side: string; expiresIn: number }> {
  const { data, error } = await supabase.rpc('admin_identity_belge_erisim', {
    p_document_id: documentId,
    p_purpose: amac,
  });
  if (error) throw new Error(hata(error));
  const d = (data ?? {}) as { bucket?: string; path?: string; side?: string; expires_in?: number };
  if (!d.path) throw new Error('path_missing');

  const imzali = await supabase.storage
    .from(d.bucket ?? VERIFY_DOC_BUCKET)
    .createSignedUrl(d.path, d.expires_in ?? IMZALI_URL_SANIYE);

  if (imzali.error || !imzali.data?.signedUrl) {
    throw new Error(imzali.error?.message ?? 'signed_url_failed');
  }
  return {
    url: imzali.data.signedUrl,
    side: String(d.side ?? ''),
    expiresIn: Number(d.expires_in ?? IMZALI_URL_SANIYE),
  };
}

export async function AdminVerifyIslem(
  id: string,
  action: AdminIslemTuru,
  girdi?: { reasonCode?: string | null; reason?: string | null; note?: string | null },
): Promise<{ bekliyor: boolean; mesaj: string | null; status: string | null }> {
  const { data, error } = await supabase.rpc('admin_identity_islem', {
    p_application_id: id,
    p_action: action,
    p_reason_code: girdi?.reasonCode ?? null,
    p_reason: girdi?.reason ?? null,
    p_note: girdi?.note ?? null,
  });
  if (error) throw new Error(hata(error));
  const d = (data ?? {}) as { bekliyor?: boolean; mesaj?: string; status?: string };
  return {
    bekliyor: Boolean(d.bekliyor),
    mesaj: d.mesaj ?? null,
    status: d.status ?? null,
  };
}

export async function AdminVerifyIkinciOnay(
  id: string,
  onay: boolean,
): Promise<{ status: string | null }> {
  const { data, error } = await supabase.rpc('admin_identity_ikinci_onay', {
    p_application_id: id,
    p_onay: onay,
  });
  if (error) throw new Error(hata(error));
  const d = (data ?? {}) as { status?: string };
  return { status: d.status ?? null };
}

export async function AdminVerifyItirazlar(girdi?: {
  durum?: string | null;
  limit?: number;
}): Promise<AdminVerifyItiraz[]> {
  const { data, error } = await supabase.rpc('admin_identity_itirazlar', {
    p_status: girdi?.durum ?? null,
    p_limit: girdi?.limit ?? 40,
  });
  if (error) throw new Error(hata(error));
  return ((data ?? {}) as { kayitlar?: AdminVerifyItiraz[] }).kayitlar ?? [];
}

export async function AdminVerifyItirazKarar(
  appealId: string,
  decision: 'reopen' | 'uphold' | 'rejected',
  note: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_identity_itiraz_karar', {
    p_appeal_id: appealId,
    p_decision: decision,
    p_note: note,
  });
  if (error) throw new Error(hata(error));
}

export async function AdminVerifyDenetim(
  applicationId?: string | null,
  limit = 100,
): Promise<AdminVerifyDenetim[]> {
  const { data, error } = await supabase.rpc('admin_identity_denetim', {
    p_application_id: applicationId ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(hata(error));
  return ((data ?? {}) as { kayitlar?: AdminVerifyDenetim[] }).kayitlar ?? [];
}

export async function AdminVerifyAyarlar(): Promise<AdminVerifyAyarlar | null> {
  const { data, error } = await supabase.rpc('admin_identity_ayarlar');
  if (error) throw new Error(hata(error));
  if (!data) return null;
  return data as AdminVerifyAyarlar;
}

export async function AdminVerifyAyarGuncelle(girdi: {
  selfieDenemeLimiti?: number | null;
  selfieOturumSaniye?: number | null;
  belgeSaklamaGun?: number | null;
  ikinciOnayZorunlu?: boolean | null;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_identity_ayar_guncelle', {
    p_selfie_deneme_limiti: girdi.selfieDenemeLimiti ?? null,
    p_selfie_oturum_saniye: girdi.selfieOturumSaniye ?? null,
    p_belge_saklama_gun: girdi.belgeSaklamaGun ?? null,
    p_ikinci_onay_zorunlu: girdi.ikinciOnayZorunlu ?? null,
  });
  if (error) throw new Error(hata(error));
}

/* ------------------------------------------------------------------ */
/* Etiket yardımcıları                                                 */
/* ------------------------------------------------------------------ */

export const VERIFY_DURUM_ETIKET: Record<VerifyDurumKodu, string> = {
  not_started: 'Başlatılmadı',
  in_progress: 'Devam ediyor',
  awaiting_document: 'Belge bekleniyor',
  awaiting_selfie: 'Selfie bekleniyor',
  under_review: 'İncelemede',
  additional_verification: 'Ek doğrulama',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  appeal_review: 'İtiraz incelemesi',
};

export const VERIFY_BELGE_ETIKET: Record<string, string> = {
  id_card: 'Kimlik kartı',
  passport: 'Pasaport',
  drivers_license: 'Sürücü belgesi',
  residence_permit: 'Oturum kartı',
};

/** RPC hata kodlarını operatör diline çevir. */
export function VerifyHataMetni(e: unknown): string {
  const ham = e instanceof Error ? e.message : String(e ?? '');
  const ilk = ham.split('\n')[0].trim();
  const kod = ilk.toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, string> = {
    forbidden: 'Bu işlem için yetkiniz yok.',
    not_authorized: 'Bu işlem için yetkiniz yok.',
    permission_denied: 'Bu işlem için yetkiniz yok.',
    not_authenticated: 'Oturum bulunamadı; yeniden giriş yapın.',
    invalid_state: 'Başvuru bu işlem için uygun durumda değil.',
    invalid_decision: 'Geçersiz karar.',
    reason_required: 'Gerekçe zorunlu.',
    reason_code_required: 'Ret için gerekçe kodu seçin.',
    second_approval_self: 'Kendi kararınızı ikinci onay olarak onaylayamazsınız.',
    requires_second_approval:
      'İkinci yönetici onayı zorunlu; karar teyit kuyruğuna gönderildi.',
    application_not_found: 'Başvuru bulunamadı.',
    not_found: 'Kayıt bulunamadı.',
    document_not_found: 'Belge bulunamadı.',
    signed_url_failed: 'Güvenli bağlantı üretilemedi.',
    path_missing: 'Belge yolu bulunamadı.',
    appeal_not_found: 'İtiraz bulunamadı.',
    note_required: 'Not en az 5 karakter olmalı.',
  };
  return map[kod] ?? map[ilk.toLowerCase()] ?? ilk ?? 'İşlem tamamlanamadı.';
}

/** Yetki kaynaklı mı — ekranda yönlendirme göstermek için. */
export function VerifyYetkiHatasi(e: unknown): boolean {
  const ham = e instanceof Error ? e.message : String(e ?? '');
  const kod = ham.split('\n')[0].trim().toLowerCase();
  return kod === 'forbidden' || kod === 'permission_denied' || kod === 'not_authorized';
}

export const VERIFY_ISLEM_ETIKET: Record<string, string> = {
  start_review: 'İncelemeye al',
  request_document: 'Ek belge iste',
  request_selfie: 'Yeniden selfie iste',
  additional_verification: 'Ek doğrulama',
  approve: 'Onayla',
  reject: 'Reddet',
};

export const VERIFY_RED_KODLARI: { kod: string; etiket: string }[] = [
  { kod: 'blurry_document', etiket: 'Belge okunamıyor / bulanık' },
  { kod: 'document_expired', etiket: 'Belge süresi geçmiş' },
  { kod: 'document_tampered', etiket: 'Belgede tahrifat şüphesi' },
  { kod: 'face_mismatch', etiket: 'Belge fotoğrafı ile selfie uyuşmuyor' },
  { kod: 'selfie_quality', etiket: 'Selfie kalitesi yetersiz' },
  { kod: 'data_mismatch', etiket: 'Beyan edilen bilgiler belgeyle uyuşmuyor' },
  { kod: 'duplicate_identity', etiket: 'Aynı kimlik başka hesapta kullanılmış' },
  { kod: 'minor', etiket: '18 yaş altı' },
  { kod: 'fraud_signal', etiket: 'Sahtecilik sinyali' },
  { kod: 'other', etiket: 'Diğer' },
];
