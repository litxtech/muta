/**
 * Yayıncı Kazanç ve Aylık Ödeme — istemci okuma/yazma katmanı.
 *
 * Tüm finansal hesaplamalar sunucudaki SECURITY DEFINER RPC'lerde yapılır.
 * Bu dosyada tutar toplama, oran uygulama veya kur çevirme YOKTUR; yalnızca
 * sunucunun döndürdüğü değerler biçimlendirilir.
 */
import { supabase } from '../../../lib/supabase';
import { FinansIdempotencyAnahtariOlustur } from '../islemler/FinansIdempotencyAnahtariOlustur';

export type YayinciKazancDurumu =
  | 'ineligible'
  | 'pending'
  | 'available'
  | 'in_payout'
  | 'paid'
  | 'on_hold';

export type YayinciKazancKanal =
  | 'live'
  | 'voice_room'
  | 'post'
  | 'message'
  | 'call'
  | 'other';

export type YayinciUygunlukVerify = {
  identity_status: string | null;
  document_level: string | null;
  document_level_ok: boolean | null;
  kodlar: string[];
};

export type YayinciUygunluk = {
  user_id: string;
  is_adult: boolean;
  program_status: string;
  program_approved: boolean;
  kyc_status: string;
  /** Kimlik doğrulama kaynağı — Tamuso Verify */
  kyc_source?: string;
  kyc_verified: boolean;
  payout_account_status: string;
  payout_account_verified: boolean;
  tax_status: string;
  tax_complete: boolean;
  open_high_risk: boolean;
  eligible: boolean;
  verify?: YayinciUygunlukVerify;
};

export type YayinciKazancOzeti = {
  currency: 'USD';
  eligible_gross_usd: number;
  creator_share_usd: number;
  deductions_usd: number;
  pending_usd: number;
  available_usd: number;
  on_hold_usd: number;
  in_payout_usd: number;
  paid_usd: number;
  ineligible_count: number;
  lifetime_creator_usd: number;
  by_channel: Partial<Record<YayinciKazancKanal, number>>;
  creator_share: number;
  platform_share: number;
  payout_min_usd: number;
  payout_fee_usd: number;
  payout_day: number;
  current_period_start: string;
  current_period_end: string;
  next_processing_date: string;
  next_payout_date: string;
  adjustments_usd: number;
  diamonds: number;
  minimum_reached: boolean;
  amount_to_minimum_usd: number;
  withdrawals_enabled: boolean;
  payout_method: 'bank_transfer';
  program_status: string;
  tax_status: string;
  eligibility: YayinciUygunluk;
  open_request: YayinciOdemeTalebi | null;
};

export type YayinciKazancKaydi = {
  id: string;
  created_at: string;
  source_type: string;
  channel: YayinciKazancKanal | null;
  coin_source: 'purchased' | 'game' | 'bonus' | string;
  coins: number;
  gross_usd: number;
  creator_rate: number;
  creator_usd: number;
  agency_usd: number;
  platform_usd: number;
  deductions_usd: number;
  net_usd: number;
  eligible: boolean;
  ineligible_reason: string | null;
  status: YayinciKazancDurumu;
  period_start: string;
  period_end: string;
  payer_name: string | null;
};

export type YayinciGunlukNokta = {
  day: string;
  creator_usd: number;
  gross_usd: number;
  gift_count: number;
};

export type YayinciHaftalikNokta = {
  week_start: string;
  creator_usd: number;
  gift_count: number;
};

export type YayinciAylikNokta = {
  month_start: string;
  creator_usd: number;
  gross_usd: number;
  gift_count: number;
};

export type YayinciGrafikler = {
  days: number;
  daily: YayinciGunlukNokta[];
  weekly: YayinciHaftalikNokta[];
  monthly: YayinciAylikNokta[];
  by_channel: Partial<Record<YayinciKazancKanal, number>>;
};

export type YayinciOdemeGecmisi = {
  id: string;
  batch_id: string;
  batch_created_at: string;
  period_month: string;
  payout_date: string;
  amount_usd: number;
  fee_usd: number;
  net_usd: number;
  currency: string;
  status: 'pending' | 'approved' | 'sent' | 'paid' | 'failed' | 'removed' | string;
  iban_masked: string | null;
  external_reference: string | null;
  paid_at: string | null;
};

export type YayinciOdemeTalebi = {
  id?: string;
  user_id?: string;
  amount_usd: number;
  fee_usd: number;
  net_usd: number;
  status: string;
  method?: string;
  payout_scheme?: string | null;
  payout_details_masked?: Record<string, string> | null;
  iban_masked?: string | null;
  period_end?: string;
  created_at?: string;
  updated_at?: string;
  failure_reason?: string | null;
};

/** Ülke/yöntem başına ödeme talimatı alan tanımı (sunucu doğrulaması). */
export type YayinciOdemeAlani = {
  key: string;
  required?: boolean;
  pattern?: string;
  enum?: string[];
  max_length?: number;
  min_length?: number;
  numeric?: boolean;
  /** Kullanıcıya gösterilecek örnek değer (ör. IBAN örneği). */
  example?: string;
  /** Alan altı ipucu anahtarı (yayinciK.ipucu...) sunucudan gelmez; istemci eşler. */
  hint?: string;
  /** Alan tipi: text | iban | swift | clabe | numeric ... */
  type?: string;
};

/** Ülke banka/cüzdan rehber satırı. */
export type YayinciBanka = {
  code: string;
  name: string;
  short_name: string | null;
  kind: 'bank' | 'wallet' | 'network' | string;
};

/** Ülke bazlı para birimi ve IBAN kuralı. */
export type YayinciOdemeUlkeKurallari = {
  country_code?: string;
  currency?: string;
  iban_length?: number | null;
  iban_example?: string | null;
  account_min_length?: number | null;
  account_max_length?: number | null;
  note?: string | null;
};

export type YayinciOdemeSemasi = {
  scheme: 'iban' | 'us_ach' | 'local_account' | 'wallet' | string;
  bank_name_required?: boolean;
  fields: YayinciOdemeAlani[];
};

export type YayinciOdemeHesabi = {
  exists: boolean;
  id?: string;
  method?: 'bank_transfer' | 'local_transfer' | 'wallet_transfer';
  scheme?: 'iban' | 'us_ach' | 'local_account' | 'wallet' | string;
  country_code?: string | null;
  currency?: string;
  account_holder?: string | null;
  bank_name?: string | null;
  /** Rehberden seçilen banka/cüzdan kodu. */
  bank_code?: string | null;
  iban_masked?: string | null;
  details_masked?: Record<string, string> | null;
  status?: string;
  verified_at?: string | null;
  last_changed_at?: string | null;
};

export type YayinciSozlesme = {
  id: string;
  version: number;
  title: string;
  summary_md: string | null;
  policy_code: string | null;
  effective_from: string;
};

export type YayinciProgramDurumu = {
  enrollment: {
    user_id: string;
    status: string;
    country_code: string | null;
    tax_status: string;
    contract_version_id: string | null;
    contract_accepted_at: string | null;
    age_confirmed_at: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  contract: YayinciSozlesme | null;
  eligibility: YayinciUygunluk;
  payout_calendar: {
    payout_day: number;
    next_payout_date: string;
    minimum_usd: number;
  };
};

export type YayinciItiraz = {
  id: string;
  user_id: string;
  batch_item_id: string | null;
  earning_id: string | null;
  kind: 'payout' | 'earning' | 'refund' | 'account';
  subject: string;
  body: string;
  status: 'open' | 'reviewing' | 'resolved' | 'rejected';
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type YayinciUlkeOdemeDurumu = {
  country_code: string;
  supported: boolean;
  generic?: boolean;
  methods: {
    method: string;
    provider: string | null;
    currency: string;
    min_payout_usd: number;
    is_enabled: boolean;
    auto_payout: boolean;
    scheme?: string | null;
    fields?: YayinciOdemeAlani[];
    requirements?: YayinciOdemeSemasi | null;
    /** Bu kanal için seçilebilir banka/cüzdan listesi. */
    banks?: YayinciBanka[];
  }[];
  field_schemas?: Record<string, YayinciOdemeAlani[]>;
  /** Kanal bazlı olmayan, tüm kanallar için ortak listeler. */
  banks?: { bank?: YayinciBanka[]; wallet?: YayinciBanka[] } | YayinciBanka[];
  rules?: YayinciOdemeUlkeKurallari | null;
  note: string | null;
};

function asObj(data: unknown): any {
  return data && typeof data === 'object' ? data : {};
}

function hataCevir(error: { message?: string; code?: string } | null): never {
  throw new Error(error?.message ?? 'RPC failed');
}

/* ------------------------------------------------------------------ */
/* Okuma                                                               */
/* ------------------------------------------------------------------ */

export async function YayinciKazancOzetiGetir(): Promise<YayinciKazancOzeti> {
  const { data, error } = await supabase.rpc('yayinci_kazanc_ozeti');
  if (error) hataCevir(error);
  return asObj(data) as YayinciKazancOzeti;
}

export async function YayinciKazancKayitlariniGetir(opts?: {
  channel?: YayinciKazancKanal | null;
  status?: YayinciKazancDurumu | null;
  limit?: number;
  offset?: number;
}): Promise<YayinciKazancKaydi[]> {
  const { data, error } = await supabase.rpc('yayinci_kazanc_kayitlari_v2', {
    p_channel: opts?.channel ?? null,
    p_status: opts?.status ?? null,
    p_limit: opts?.limit ?? 50,
    p_offset: opts?.offset ?? 0,
  });
  if (error) hataCevir(error);
  return (data ?? []) as YayinciKazancKaydi[];
}

export async function YayinciKazancGrafikleriGetir(days = 30): Promise<YayinciGrafikler> {
  const { data, error } = await supabase.rpc('yayinci_kazanc_grafikleri', {
    p_days: days,
  });
  if (error) hataCevir(error);
  return asObj(data) as YayinciGrafikler;
}

export async function YayinciOdemeGecmisiniGetir(): Promise<YayinciOdemeGecmisi[]> {
  const { data, error } = await supabase.rpc('yayinci_odeme_gecmisi');
  if (error) hataCevir(error);
  return (data ?? []) as YayinciOdemeGecmisi[];
}

export async function YayinciProgramDurumuGetir(): Promise<YayinciProgramDurumu> {
  const { data, error } = await supabase.rpc('yayinci_program_durumu');
  if (error) hataCevir(error);
  return asObj(data) as YayinciProgramDurumu;
}

export async function YayinciUygunlukGetir(): Promise<YayinciUygunluk> {
  const { data, error } = await supabase.rpc('yayinci_uygunluk_durumu', {
    p_user: null,
  });
  if (error) hataCevir(error);
  return asObj(data) as YayinciUygunluk;
}

export async function YayinciOdemeHesabiGetir(): Promise<YayinciOdemeHesabi> {
  const { data, error } = await supabase.rpc('yayinci_odeme_hesabi_getir');
  if (error) hataCevir(error);
  return asObj(data) as YayinciOdemeHesabi;
}

export async function YayinciItirazlarimGetir(): Promise<YayinciItiraz[]> {
  const { data, error } = await supabase.rpc('yayinci_itirazlarim');
  if (error) hataCevir(error);
  return (data ?? []) as YayinciItiraz[];
}

/**
 * Ödeme yapılacak ülkeyi sunucudan çözer.
 *
 * Sıra: kayıtlı ödeme hesabı → yayıncı programı kaydı → kimlik başvurusu →
 * profil ülkesi. Hiçbiri yoksa null döner; ekran o zaman varsayılan ülkeyi
 * kullanır. Ülke seçimi bu değerle başlar, böylece kullanıcı profilinde
 * seçtiği ülkenin banka rehberini ve alan şemasını ilk açılışta görür.
 */
export async function YayinciOdemeUlkeCoz(): Promise<string | null> {
  const { data, error } = await supabase.rpc('yayinci_odeme_ulke_coz', {
    p_user: null,
  });
  if (error) return null;
  const kod = String(data ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(kod) ? kod : null;
}

export async function YayinciUlkeOdemeDurumuGetir(
  countryCode: string,
): Promise<YayinciUlkeOdemeDurumu> {
  const { data, error } = await supabase.rpc('yayinci_odeme_ulke_durumu', {
    p_country_code: countryCode,
  });
  if (error) hataCevir(error);
  return asObj(data) as YayinciUlkeOdemeDurumu;
}

/* ------------------------------------------------------------------ */
/* Yazma                                                               */
/* ------------------------------------------------------------------ */

export type YayinciIslemSonucu<T = unknown> =
  | { ok: true; veri: T }
  | { ok: false; kod: string; hata: string };

/**
 * Sunucu `raise exception '<kod>'` ile döner; PostgREST mesajın ilk satırına
 * kodu koyar. Eski kod `error.code` (P0001) okuduğu için istemci hatayı
 * ayırt edemiyordu — burada gerçek sunucu kodunu çıkarıyoruz.
 */
export function sunucuHataKodu(error: { message?: string; code?: string } | null): string {
  const ham = (error?.message ?? '').trim();
  const ilk = ham.split('\n')[0].trim();
  if (ilk && /^[a-z0-9_:]+$/i.test(ilk)) return ilk;
  return error?.code ?? 'rpc_error';
}

async function yaz<R>(
  fn: () => PromiseLike<{ data: R | null; error: any }>,
): Promise<YayinciIslemSonucu<R>> {
  try {
    const { data, error } = await fn();
    if (error) {
      return {
        ok: false,
        kod: sunucuHataKodu(error),
        hata: error.message ?? 'RPC failed',
      };
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

export function YayinciProgramBasvuru(
  countryCode: string,
  taxConfirmed: boolean,
): Promise<YayinciIslemSonucu> {
  return yaz(() =>
    supabase.rpc('yayinci_program_basvuru', {
      p_country_code: countryCode,
      p_tax_confirmed: taxConfirmed,
    }),
  );
}

export function YayinciSozlesmeKabul(version?: number): Promise<YayinciIslemSonucu> {
  return yaz(() =>
    supabase.rpc('yayinci_sozlesme_kabul', {
      p_version: version ?? null,
    }),
  );
}

export function YayinciOdemeHesabiKaydet(girdi: {
  accountHolder: string;
  bankName: string;
  /** Yalnızca geriye dönük uyumluluk için; yeni akışta boş bırakılır. */
  iban?: string;
  countryCode: string;
  currency: string;
  method?: 'bank_transfer' | 'local_transfer' | 'wallet_transfer';
  scheme?: string;
  details?: Record<string, string>;
  /** Ülke banka rehberinden seçilen banka/cüzdan kodu. */
  bankCode?: string | null;
}): Promise<YayinciIslemSonucu<YayinciOdemeHesabi>> {
  return yaz(() =>
    supabase.rpc('yayinci_odeme_hesabi_kaydet', {
      p_account_holder: girdi.accountHolder,
      p_bank_name: girdi.bankName,
      p_iban: girdi.iban ?? null,
      p_country_code: girdi.countryCode,
      p_currency: girdi.currency,
      p_method: girdi.method ?? 'bank_transfer',
      p_scheme: girdi.scheme ?? null,
      p_details: girdi.details ?? {},
      p_bank_code: girdi.bankCode ?? null,
    }),
  );
}

/**
 * Para çekme (ödeme) talebi oluşturur.
 *
 * Sunucu `yayinci_odeme_talebi_olustur` şu kodlarla reddedebilir:
 *  - withdrawals_unavailable / open_request_exists
 *  - kyc_required / identity_required / identity_document_level_insufficient
 *  - bank_account_required / below_minimum / security_review
 *  - adult_required / country_payout_not_supported
 *
 * KYC kapısı sunucuda zorunludur; istemci yalnızca kullanıcıyı doğrulamaya
 * yönlendirmek için bu kodları okur.
 */
export function YayinciOdemeTalebiOlustur(
  idempotencyKey?: string,
): Promise<YayinciIslemSonucu<YayinciOdemeTalebi>> {
  const anahtar = idempotencyKey ?? FinansIdempotencyAnahtariOlustur('creator_payout');
  return yaz(() =>
    supabase.rpc('yayinci_odeme_talebi_olustur', {
      p_idempotency_key: anahtar,
    }),
  );
}

/** Açık/geçmiş ödeme talepleri (varsa sunucu RPC'si). */
export function YayinciOdemeTaleplerim(): Promise<YayinciIslemSonucu<YayinciOdemeTalebi[]>> {
  return yaz(() => supabase.rpc('yayinci_odeme_taleplerim'));
}

export function YayinciItirazOlustur(girdi: {
  kind: 'payout' | 'earning' | 'refund' | 'account';
  subject: string;
  body: string;
  batchItemId?: string | null;
  earningId?: string | null;
}): Promise<YayinciIslemSonucu<YayinciItiraz>> {
  return yaz(() =>
    supabase.rpc('yayinci_itiraz_olustur', {
      p_kind: girdi.kind,
      p_subject: girdi.subject,
      p_body: girdi.body,
      p_batch_item_id: girdi.batchItemId ?? null,
      p_earning_id: girdi.earningId ?? null,
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Biçimlendirme yardımcıları                                          */
/* ------------------------------------------------------------------ */

const USD_BICIM = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function UsdYazi(n: number | null | undefined): string {
  return USD_BICIM.format(Number(n ?? 0));
}

export function KazancDurumAnahtari(
  durum: string,
):
  | 'yayinciK.durumOnaylanan'
  | 'yayinciK.durumBekleyen'
  | 'yayinciK.durumHazir'
  | 'yayinciK.durumOdemede'
  | 'yayinciK.durumOdendi'
  | 'yayinciK.durumIncelemede' {
  switch (durum) {
    case 'pending':
      return 'yayinciK.durumBekleyen';
    case 'available':
      return 'yayinciK.durumHazir';
    case 'in_payout':
      return 'yayinciK.durumOdemede';
    case 'paid':
      return 'yayinciK.durumOdendi';
    case 'on_hold':
      return 'yayinciK.durumIncelemede';
    default:
      return 'yayinciK.durumOnaylanan';
  }
}

export function DurumRengi(
  durum: string,
  renk: {
    mint: string;
    accent: string;
    danger: string;
    violet: string;
    textMuted: string;
  },
): string {
  switch (durum) {
    case 'available':
    case 'paid':
      return renk.mint;
    case 'in_payout':
      return renk.accent;
    case 'on_hold':
      return renk.danger;
    case 'pending':
      return renk.violet;
    default:
      return renk.textMuted;
  }
}
