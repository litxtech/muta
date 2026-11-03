/**
 * Tamuso Verify — istemci API katmanı.
 *
 * Kurallar:
 *  - Durum alanları istemciden yazılmaz; her geçiş sunucu RPC'sindedir.
 *  - Belge yolu kullanıcı + başvuru ile kapsüllenir: <uid>/<application_id>/...
 *  - Yükleme özel (public=false) kovaya yapılır, istemci dosyayı geri okuyamaz.
 */
import { supabase } from '../../lib/supabase';
import { DepoyaMedyaYukle } from '../../ortak/medya/DepoyaMedyaYukle';
import type {
  VerifyAdim,
  VerifyBelgeKalitesi,
  VerifyBelgeTuru,
  VerifyBelgeTuruDestegi,
  VerifyBelgeYuzu,
  VerifyDurum,
  VerifyItiraz,
  VerifyOturum,
  VerifySelfieAdimi,
} from './tipler';

export const VERIFY_BUCKET = 'tamuso-verify-docs';
export const VERIFY_MAKS_BAYT = 8 * 1024 * 1024;

function hataMesaji(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'unknown_error';
}

function rpcHatasi(error: { message?: string } | null): { kod: string; mesaj: string } {
  const ham = (error?.message ?? 'unknown_error').trim();
  // Sunucu raise exception '<kod>' biçiminde döner; mesajın ilk satırı koddur.
  const kod = ham.split('\n')[0].trim();
  return { kod, mesaj: ham };
}

async function mevcutKullaniciId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  const id = data.user?.id;
  if (!id) throw new Error('not_authenticated');
  return id;
}

/** <uid>/<application_id>/<yüz>-<zaman>.jpg */
export function verifyBelgeYolu(
  uid: string,
  applicationId: string,
  yuz: VerifyBelgeYuzu,
): string {
  const uzanti = 'jpg';
  return `${uid}/${applicationId}/${yuz}-${Date.now()}.${uzanti}`;
}

export async function VerifyDurumuGetir(): Promise<VerifyDurum> {
  const { data, error } = await supabase.rpc('identity_durumum');
  if (error) throw new Error(rpcHatasi(error).kod);
  const d = (data ?? {}) as Partial<VerifyDurum>;
  return {
    status: (d.status as VerifyDurum['status']) ?? 'not_started',
    application: d.application ?? null,
    documents: d.documents ?? {},
    belge_turleri: (d.belge_turleri as VerifyBelgeTuruDestegi[]) ?? [],
    selfie_kalan_deneme: Number(d.selfie_kalan_deneme ?? 0),
    selfie_deneme_limiti: Number(d.selfie_deneme_limiti ?? 3),
    saklama_gun: Number(d.saklama_gun ?? 180),
    son_karar: d.son_karar ?? null,
    itiraz: d.itiraz ?? null,
    odeme: d.odeme ?? {},
  };
}

export async function VerifyBasvuruBaslat(girdi: {
  countryCode: string;
  docType: VerifyBelgeTuru;
  consentVersion: string;
}): Promise<{ appId: string; created: boolean; status: string }> {
  const { data, error } = await supabase.rpc('identity_basvuru_baslat', {
    p_country_code: girdi.countryCode.toUpperCase(),
    p_doc_type: girdi.docType,
    p_consent_version: girdi.consentVersion,
  });
  if (error) throw new Error(rpcHatasi(error).kod);
  const d = (data ?? {}) as {
    created?: boolean;
    application?: { id?: string; status?: string };
  };
  const appId = d.application?.id;
  if (!appId) throw new Error('application_missing');
  return {
    appId,
    created: Boolean(d.created),
    status: String(d.application?.status ?? 'awaiting_document'),
  };
}

export async function VerifyBelgeYukle(girdi: {
  applicationId: string;
  side: 'front' | 'back';
  uri: string;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  kalite: VerifyBelgeKalitesi;
  kaynak: 'camera' | 'library';
}): Promise<{ status: string; documentId?: string }> {
  const uid = await mevcutKullaniciId();
  const path = verifyBelgeYolu(uid, girdi.applicationId, girdi.side);

  const yukleme = await DepoyaMedyaYukle(supabase as never, {
    bucket: VERIFY_BUCKET,
    path,
    uri: girdi.uri,
    mime: girdi.mime ?? 'image/jpeg',
    tur: 'image',
    maxBytes: VERIFY_MAKS_BAYT,
    upsert: false,
  });

  if (!yukleme.ok) {
    throw new Error(`upload_failed:${yukleme.hata}`);
  }

  const { data, error } = await supabase.rpc('identity_belge_kaydet', {
    p_application_id: girdi.applicationId,
    p_side: girdi.side,
    p_storage_path: yukleme.path,
    p_quality: girdi.kalite as never,
    p_capture_source: girdi.kaynak,
    p_width: girdi.width ?? null,
    p_height: girdi.height ?? null,
    p_byte_size: null,
    p_mime: yukleme.contentType ?? 'image/jpeg',
    p_ocr: null,
  });

  if (error) {
    // Meta veri yazılamazsa yetim dosyayı temizle (en iyi çaba).
    void supabase.storage.from(VERIFY_BUCKET).remove([yukleme.path]);
    throw new Error(rpcHatasi(error).kod);
  }

  const d = (data ?? {}) as { status?: string; document_id?: string };
  return { status: String(d.status ?? ''), documentId: d.document_id };
}

export async function VerifyBelgeKaldir(documentId: string): Promise<void> {
  const { error } = await supabase.rpc('identity_belge_kaldir', {
    p_document_id: documentId,
  });
  if (error) throw new Error(rpcHatasi(error).kod);
}

export async function VerifySelfieOturumuBaslat(
  applicationId: string,
): Promise<VerifyOturum> {
  const { data, error } = await supabase.rpc('identity_selfie_oturumu_baslat', {
    p_application_id: applicationId,
  });
  if (error) throw new Error(rpcHatasi(error).kod);
  const d = (data ?? {}) as Partial<VerifyOturum>;
  if (!d.session_id || !d.nonce) throw new Error('session_missing');
  return {
    ok: true,
    session_id: d.session_id,
    nonce: d.nonce,
    challenge_sequence: (d.challenge_sequence as VerifyAdim[]) ?? ['center'],
    expires_at: String(d.expires_at ?? ''),
    kalan_deneme: Number(d.kalan_deneme ?? 0),
    sure_saniye: Number(d.sure_saniye ?? 180),
  };
}

export async function VerifySelfieGonder(girdi: {
  applicationId: string;
  sessionId: string;
  nonce: string;
  uri: string;
  challengeSequence: VerifyAdim[];
  tamamlanan: VerifyAdim[];
  kalite: VerifyBelgeKalitesi;
  width?: number | null;
  height?: number | null;
  cihazMeta?: Record<string, unknown>;
}): Promise<{ status: string; kalanDeneme: number }> {
  const uid = await mevcutKullaniciId();
  const path = verifyBelgeYolu(uid, girdi.applicationId, 'selfie');

  const yukleme = await DepoyaMedyaYukle(supabase as never, {
    bucket: VERIFY_BUCKET,
    path,
    uri: girdi.uri,
    mime: 'image/jpeg',
    tur: 'image',
    maxBytes: VERIFY_MAKS_BAYT,
    upsert: false,
  });
  if (!yukleme.ok) throw new Error(`upload_failed:${yukleme.hata}`);

  const adimlar: VerifySelfieAdimi[] = girdi.challengeSequence.map((adim) => ({
    adim,
    tamamlandi: girdi.tamamlanan.includes(adim),
  }));

  const { data, error } = await supabase.rpc('identity_selfie_tamamla', {
    p_session_id: girdi.sessionId,
    p_nonce: girdi.nonce,
    p_storage_path: yukleme.path,
    p_challenges: adimlar as never,
    p_quality: girdi.kalite as never,
    p_device_meta: (girdi.cihazMeta ?? {}) as never,
    p_width: girdi.width ?? null,
    p_height: girdi.height ?? null,
    p_byte_size: null,
  });

  if (error) {
    void supabase.storage.from(VERIFY_BUCKET).remove([yukleme.path]);
    throw new Error(rpcHatasi(error).kod);
  }

  const d = (data ?? {}) as { status?: string; kalan_deneme?: number };
  return {
    status: String(d.status ?? 'in_progress'),
    kalanDeneme: Number(d.kalan_deneme ?? 0),
  };
}

export async function VerifyBasvuruGonder(girdi: {
  applicationId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  ocr?: Record<string, unknown> | null;
  ocrState?: 'not_attempted' | 'failed' | 'manual' | 'read';
}): Promise<{ status: string }> {
  const { data, error } = await supabase.rpc('identity_basvuru_gonder', {
    p_application_id: girdi.applicationId,
    p_first_name: girdi.firstName.trim(),
    p_last_name: girdi.lastName.trim(),
    p_birth_date: girdi.birthDate,
    p_ocr: (girdi.ocr ?? null) as never,
    p_ocr_state: girdi.ocrState ?? 'not_attempted',
  });
  if (error) throw new Error(rpcHatasi(error).kod);
  const d = (data ?? {}) as { status?: string };
  return { status: String(d.status ?? 'under_review') };
}

export async function VerifyItirazOlustur(
  applicationId: string,
  message: string,
): Promise<VerifyItiraz | null> {
  const { data, error } = await supabase.rpc('identity_itiraz_olustur', {
    p_application_id: applicationId,
    p_message: message.trim(),
  });
  if (error) throw new Error(rpcHatasi(error).kod);
  const d = (data ?? {}) as { ok?: boolean; status?: string; appeal_id?: string };
  if (!d.ok) return null;
  return {
    id: String(d.appeal_id ?? ''),
    status: 'open',
    message: message.trim(),
    resolution_note: null,
    created_at: new Date().toISOString(),
    reviewed_at: null,
  };
}

export async function VerifyHamBelgeSilmeTalebi(
  applicationId: string,
): Promise<{ silinenKayit: number }> {
  const { data, error } = await supabase.rpc('identity_ham_belge_silme_talebi', {
    p_application_id: applicationId,
  });
  if (error) throw new Error(rpcHatasi(error).kod);
  const d = (data ?? {}) as { silinen_kayit?: number };
  return { silinenKayit: Number(d.silinen_kayit ?? 0) };
}

/** Başvuru değiştiğinde (yönetici kararı vb.) durumu tazelemek için abonelik. */
export function VerifyDurumDinle(
  userId: string,
  geriCagri: () => void,
): () => void {
  const kanal = supabase
    .channel(`verify-durum-${userId}`)
    .on(
      'postgres_changes' as never,
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'identity_applications',
        filter: `user_id=eq.${userId}`,
      } as never,
      () => geriCagri(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(kanal);
  };
}

/** Ülke bazlı desteklenen belge türlerini sunucudan okur. */
export async function VerifyBelgeTurleriGetir(
  countryCode: string,
): Promise<VerifyBelgeTuruDestegi[]> {
  const { data, error } = await supabase.rpc('identity_belge_turleri', {
    p_country_code: countryCode.toUpperCase(),
  });
  if (error) return [];
  return ((data ?? []) as VerifyBelgeTuruDestegi[]).map((r) => ({
    doc_type: r.doc_type,
    sides_required: Number(r.sides_required ?? 1),
    mrz_supported: Boolean(r.mrz_supported),
  }));
}

export { hataMesaji, rpcHatasi };

/**
 * Kullanıcının profilindeki ülke kodu (yoksa TR).
 * Belge türü desteği ülkeye göre sunucuda belirlenir.
 */
export async function VerifyUlkeKoduGetir(): Promise<string> {
  try {
    const uid = await mevcutKullaniciId();
    const { data } = await supabase
      .from('profiles')
      .select('country_code')
      .eq('id', uid)
      .maybeSingle();
    const kod = String((data as { country_code?: string | null } | null)?.country_code ?? '')
      .trim()
      .toUpperCase();
    return /^[A-Z]{2}$/.test(kod) ? kod : 'TR';
  } catch {
    return 'TR';
  }
}

/**
 * Kendi başvuru satırını dinler. Kullanıcı kimliği oturumdan çözülür;
 * bileşen tarafında ek auth çağrısı gerekmez.
 */
export function VerifyDurumDinleBenim(geriCagri: () => void): () => void {
  let iptal = false;
  let birak: (() => void) | null = null;
  void (async () => {
    try {
      const uid = await mevcutKullaniciId();
      if (iptal) return;
      birak = VerifyDurumDinle(uid, geriCagri);
    } catch {
      /* oturum yoksa dinleme kurulmaz */
    }
  })();
  return () => {
    iptal = true;
    birak?.();
  };
}
