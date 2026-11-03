/**
 * Tamuso Verify — yönetici (Kimlik Doğrulama Merkezi) veri katmanı.
 *
 * Tüm okuma/yazma işlemleri sunucu RPC'lerinden geçer:
 *  - Yetki kontrolü sunucudadır (`identity_yetki`), istemci yalnızca yönlendirir.
 *  - Ham belge yolu yalnızca `admin_identity_belge_erisim` ile açılır; bu RPC
 *    her erişimi `identity_access_audit` tablosuna yazar.
 *  - Karar (onay/red) doğrudan uygulanmaz: `admin_identity_islem` ikinci onay
 *    gerekiyorsa işlemi beklemeye alır.
 */
import { supabase } from '../../../lib/supabase';

/* ------------------------------------------------------------------ */
/* Tipler                                                             */
/* ------------------------------------------------------------------ */

export type KimlikDashboard = {
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

export type KimlikBasvuru = {
  id: string;
  user_id: string;
  status: string;
  country_code: string | null;
  doc_type: string | null;
  declared_first_name: string | null;
  declared_last_name: string | null;
  selfie_attempts: number;
  submitted_at: string | null;
  decided_at: string | null;
  pending_action: string | null;
  created_at: string;
  updated_at: string;
  display_name: string | null;
  username: string | null;
  public_user_id: string | null;
};

export type KimlikBelge = {
  id: string;
  side: 'front' | 'back' | 'selfie';
  mime: string | null;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  capture_source: string | null;
  quality_state: string | null;
  quality: Record<string, unknown>;
  ocr_fields: Record<string, unknown>;
  created_at: string;
};

export type KimlikOlay = {
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

export type KimlikDetay = {
  application: {
    id: string;
    user_id: string;
    status: string;
    country_code: string | null;
    doc_type: string | null;
    sides_required: number;
    declared_first_name: string | null;
    declared_last_name: string | null;
    declared_birth_date: string | null;
    ocr_state: string | null;
    selfie_attempts: number;
    consent_version: string | null;
    consent_accepted_at: string | null;
    submitted_at: string | null;
    reviewer_id: string | null;
    decided_at: string | null;
    decision_reason: string | null;
    decision_note: string | null;
    last_review_note: string | null;
    pending_action: string | null;
    pending_actor: string | null;
    pending_reason: string | null;
    created_at: string;
    updated_at: string;
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
  documents: KimlikBelge[];
  session: {
    id: string;
    state: string;
    challenge_sequence: string[] | null;
    attempts: number;
    fraud_signals: Record<string, unknown> | null;
    device_meta: Record<string, unknown> | null;
    expires_at: string | null;
    consumed_at: string | null;
    created_at: string;
  } | null;
  decision: {
    decision: string;
    reason_code: string | null;
    reason: string | null;
    liveness_claim: string | null;
    face_match_performed: boolean;
    decided_by_human: boolean;
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
  events: KimlikOlay[];
  odeme_uygunluk: Record<string, unknown>;
};

export type KimlikItiraz = {
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
  country_code: string | null;
  doc_type: string | null;
  application_status: string | null;
};

export type KimlikIslem = 'start_review' | 'approve' | 'reject'
  | 'request_document' | 'request_selfie' | 'additional_verification';

export type KimlikSonuc<T = unknown> =
  | { ok: true; veri: T }
  | { ok: false; kod: string; hata: string };

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                        */
/* ------------------------------------------------------------------ */

function sunucuKodu(error: { message?: string; code?: string } | null): string {
  const ham = (error?.message ?? '').trim();
  const ilk = ham.split('\n')[0].trim();
  if (ilk && /^[a-z0-9_:]+$/i.test(ilk)) return ilk;
  return error?.code ?? 'rpc_error';
}

function asObj<T>(v: unknown, yedek: T): T {
  if (v && typeof v === 'object') return v as T;
  return yedek;
}

async function oku<R>(fn: () => PromiseLike<{ data: R | null; error: any }>, yedek: R): Promise<R> {
  const { data, error } = await fn();
  if (error) throw new Error(sunucuKodu(error));
  return data ?? yedek;
}

async function yaz<R>(fn: () => PromiseLike<{ data: R | null; error: any }>): Promise<KimlikSonuc<R>> {
  try {
    const { data, error } = await fn();
    if (error) {
      return { ok: false, kod: sunucuKodu(error), hata: error.message ?? 'RPC failed' };
    }
    return { ok: true, veri: data as R };
  } catch (e) {
    return {
      ok: false,
      kod: 'network_error',
      hata: e instanceof Error ? e.message : 'Beklenmeyen hata',
    };
  }
}

/** Sunucu hata kodunu kullanıcıya gösterilecek Türkçe metne çevirir. */
export function kimlikHataMetni(kod: string): string {
  switch (kod) {
    case 'Forbidden':
      return 'Bu işlem için yetkiniz yok.';
    case 'Not authenticated':
      return 'Oturumunuz sona erdi, tekrar giriş yapın.';
    case 'Not found':
      return 'Başvuru bulunamadı.';
    case 'already_decided':
      return 'Bu başvuru için karar zaten verilmiş.';
    case 'invalid_state':
      return 'Başvuru bu işlem için uygun durumda değil.';
    case 'not_submitted_yet':
      return 'Başvuru henüz gönderilmedi.';
    case 'reason_required':
      return 'Gerekçe yazmadan karar verilemez.';
    case 'document_required':
      return 'Onay için ön yüz belgesi gerekli.';
    case 'document_back_required':
      return 'Onay için arka yüz belgesi gerekli.';
    case 'selfie_required':
      return 'Onay için canlı selfie gerekli.';
    case 'second_approval_self':
      return 'Kendi talebinizi onaylayamazsınız; ikinci yönetici gerekli.';
    case 'second_approval_required':
      return 'İkinci yönetici onayı bekleniyor.';
    case 'pending_action_exists':
      return 'Bu başvuruda bekleyen farklı bir işlem var.';
    case 'no_pending_action':
      return 'Bekleyen ikinci onay yok.';
    case 'appeal_closed':
      return 'İtiraz kapanmış.';
    case 'note_required':
      return 'En az 5 karakterlik not girin.';
    case 'invalid_decision':
      return 'Geçersiz itiraz kararı.';
    case 'invalid_action':
      return 'Geçersiz işlem.';
    default:
      return 'İşlem tamamlanamadı.';
  }
}

/* ------------------------------------------------------------------ */
/* Okuma                                                              */
/* ------------------------------------------------------------------ */

export function KimlikDashboardGetir(): Promise<KimlikDashboard> {
  return oku(() => supabase.rpc('admin_identity_dashboard'), {} as KimlikDashboard);
}

export async function KimlikBasvurulariGetir(
  status: string | null,
  search: string | null,
  limit = 40,
  offset = 0,
): Promise<{ toplam: number; kayitlar: KimlikBasvuru[] }> {
  const veri = await oku(
    () =>
      supabase.rpc('admin_identity_basvurular', {
        p_status: status,
        p_search: search,
        p_limit: limit,
        p_offset: offset,
      }),
    { toplam: 0, kayitlar: [] } as { toplam: number; kayitlar: KimlikBasvuru[] },
  );
  const o = asObj(veri as unknown, { toplam: 0, kayitlar: [] });
  return {
    toplam: Number(o.toplam ?? 0),
    kayitlar: Array.isArray(o.kayitlar) ? (o.kayitlar as KimlikBasvuru[]) : [],
  };
}

export function KimlikBasvuruDetayGetir(id: string): Promise<KimlikDetay> {
  return oku(() => supabase.rpc('admin_identity_basvuru_detay', { p_application_id: id }), {} as KimlikDetay);
}

export async function KimlikItirazlariGetir(status: string | null, limit = 40): Promise<KimlikItiraz[]> {
  const veri = await oku(
    () => supabase.rpc('admin_identity_itirazlar', { p_status: status, p_limit: limit }),
    { kayitlar: [] } as { kayitlar: KimlikItiraz[] },
  );
  const o = asObj(veri as unknown, { kayitlar: [] });
  return Array.isArray(o.kayitlar) ? o.kayitlar : [];
}

export async function KimlikDenetimGetir(applicationId?: string | null): Promise<KimlikOlay[]> {
  const veri = await oku(
    () =>
      supabase.rpc('admin_identity_denetim', {
        p_application_id: applicationId ?? null,
        p_limit: 100,
      }),
    { kayitlar: [] } as { kayitlar: any[] },
  );
  const o = asObj(veri as unknown, { kayitlar: [] });
  return Array.isArray(o.kayitlar) ? (o.kayitlar as KimlikOlay[]) : [];
}

/**
 * Belge için kısa ömürlü imzalı URL üretir.
 * Yol istemciye yalnızca denetim kaydı üreten RPC ile verilir.
 */
export async function KimlikBelgeUrlGetir(documentId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('admin_identity_belge_erisim', {
    p_document_id: documentId,
    p_purpose: 'review',
  });
  if (error) throw new Error(sunucuKodu(error));
  const o = asObj(data as unknown, {} as { bucket?: string; path?: string; expires_in?: number });
  if (!o.bucket || !o.path) return null;
  const imza = await supabase.storage
    .from(o.bucket)
    .createSignedUrl(o.path, Number(o.expires_in ?? 300));
  if (imza.error) throw new Error(imza.error.message);
  return imza.data?.signedUrl ?? null;
}

/* ------------------------------------------------------------------ */
/* Yazma                                                              */
/* ------------------------------------------------------------------ */

export function KimlikIslemUygula(
  applicationId: string,
  action: KimlikIslem,
  reason?: string | null,
  reasonCode?: string | null,
  note?: string | null,
): Promise<KimlikSonuc<{ ok?: boolean; status?: string; bekliyor?: boolean; mesaj?: string }>> {
  return yaz(() =>
    supabase.rpc('admin_identity_islem', {
      p_application_id: applicationId,
      p_action: action,
      p_reason_code: reasonCode ?? null,
      p_reason: reason ?? null,
      p_note: note ?? null,
    }),
  );
}

export function KimlikIkinciOnay(applicationId: string, onay: boolean): Promise<KimlikSonuc> {
  return yaz(() =>
    supabase.rpc('admin_identity_ikinci_onay', {
      p_application_id: applicationId,
      p_onay: onay,
    }),
  );
}

export function KimlikItirazKarar(
  appealId: string,
  decision: 'reopen' | 'rejected',
  note: string,
): Promise<KimlikSonuc> {
  return yaz(() =>
    supabase.rpc('admin_identity_itiraz_karar', {
      p_appeal_id: appealId,
      p_decision: decision,
      p_note: note,
    }),
  );
}

export type KimlikAyarlar = {
  selfie_deneme_limiti: number;
  selfie_oturum_saniye: number;
  belge_saklama_gun: number;
  ikinci_onay_zorunlu: boolean;
  updated_at?: string;
};

export function KimlikAyarlarGetir(): Promise<KimlikAyarlar> {
  return oku(() => supabase.rpc('admin_identity_ayarlar'), {} as KimlikAyarlar);
}

export function KimlikAyarGuncelle(girdi: {
  selfieDenemeLimiti?: number | null;
  selfieOturumSaniye?: number | null;
  belgeSaklamaGun?: number | null;
  ikinciOnayZorunlu?: boolean | null;
}): Promise<KimlikSonuc<KimlikAyarlar>> {
  return yaz(() =>
    supabase.rpc('admin_identity_ayar_guncelle', {
      p_selfie_deneme_limiti: girdi.selfieDenemeLimiti ?? null,
      p_selfie_oturum_saniye: girdi.selfieOturumSaniye ?? null,
      p_belge_saklama_gun: girdi.belgeSaklamaGun ?? null,
      p_ikinci_onay_zorunlu: girdi.ikinciOnayZorunlu ?? null,
    }),
  );
}
