/**
 * Creator Finance Center API — /admin/finance/yayinci
 *
 * Display-only + explicit admin action wrappers. Every amount, eligibility
 * decision and status transition is computed inside SECURITY DEFINER RPCs;
 * nothing financial is calculated on the client.
 *
 * Live money transfer is NOT automated here: an admin approves a payout batch,
 * then marks each item "sent" with the real bank/provider reference and later
 * "completed". `payout_auto_transfer_enabled` stays false until a provider and
 * legal checks are in place.
 */
import { supabase } from '../../../lib/supabase';

function asObj(data: unknown): any {
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

function asList(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>;
    if (Array.isArray(rec.items)) return rec.items as any[];
    if (Array.isArray(rec.rows)) return rec.rows as any[];
  }
  return [];
}

export type YayinciFinansOzet = {
  total_gift_revenue_usd: number;
  creator_earnings_usd: number;
  platform_share_usd: number;
  pending_usd: number;
  available_usd: number;
  on_hold_usd: number;
  in_payout_usd: number;
  paid_usd: number;
  ineligible_usd: number;
  this_month_creator_usd: number;
  this_month_platform_usd: number;
  this_month_gift_count: number;
  creators_with_earnings: number;
  creators_above_min: number;
  currency: string;
  creator_share: number;
  platform_share: number;
  payout_min_usd: number;
  payout_day: number;
  current_period_start: string;
  current_period_end: string;
  next_payout_date: string;
  open_risk_flags: number;
  open_disputes: number;
  pending_batches: number;
  paid_creators: number;
  creators_waiting: number;
};

export type YayinciOdemeAyar = {
  creator_share: number;
  platform_share: number;
  revenue_usd_per_coin: number;
  payout_min_usd: number;
  payout_day: number;
  payout_transfer_fee_usd: number;
  payout_auto_transfer_enabled: boolean;
  settlement_mode: string;
  updated_at: string | null;
  countries: any[];
  holidays: any[];
};

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

export async function AdminYayinciFinansOzetGetir(): Promise<YayinciFinansOzet> {
  const { data, error } = await supabase.rpc('admin_yayinci_finans_ozet');
  if (error) throw new Error(error.message);
  return asObj(data) as YayinciFinansOzet;
}

export async function AdminYayinciListesi(
  limit = 50,
  offset = 0,
  q?: string,
): Promise<any[]> {
  const { data, error } = await supabase.rpc('admin_yayinci_listesi', {
    p_limit: limit,
    p_offset: offset,
    p_q: q?.trim() ? q.trim() : null,
  });
  if (error) throw new Error(error.message);
  return asList(data);
}

export async function AdminYayinciKazancGunluk(from?: string, to?: string): Promise<any[]> {
  const { data, error } = await supabase.rpc('admin_yayinci_kazanc_gunluk', {
    p_from: from ?? null,
    p_to: to ?? null,
  });
  if (error) throw new Error(error.message);
  return asList(data);
}

export async function AdminYayinciKazancAylik(months = 12): Promise<any[]> {
  const { data, error } = await supabase.rpc('admin_yayinci_kazanc_aylik', {
    p_months: months,
  });
  if (error) throw new Error(error.message);
  return asList(data);
}

export async function AdminYayinciBekleyen(limit = 100): Promise<any[]> {
  const { data, error } = await supabase.rpc('admin_yayinci_bekleyen', { p_limit: limit });
  if (error) throw new Error(error.message);
  return asList(data);
}

/* ------------------------------------------------------------------ */
/* Onay kuyruğu — ödeme profili / belge / banka talimatı               */
/* ------------------------------------------------------------------ */

export type YayinciOnayTuru = 'profil' | 'belge' | 'hesap';

export type YayinciOnaySayilari = {
  profil: number;
  belge: number;
  hesap: number;
  kazanc: number;
  onay_bekleyen_toplam: number;
};

export type YayinciOnayOgesi = {
  tur: YayinciOnayTuru;
  user_id: string;
  kayit_id: string;
  ad: string | null;
  kullanici_adi: string | null;
  ulke: string | null;
  durum: string;
  gonderim: string | null;
  detay: Record<string, any>;
};

export type YayinciOnayKuyrugu = {
  sayilar: YayinciOnaySayilari;
  items: YayinciOnayOgesi[];
};

const BOS_SAYILAR: YayinciOnaySayilari = {
  profil: 0,
  belge: 0,
  hesap: 0,
  kazanc: 0,
  onay_bekleyen_toplam: 0,
};

export async function AdminYayinciOnaySayilari(): Promise<YayinciOnaySayilari> {
  const { data, error } = await supabase.rpc('admin_yayinci_onay_sayilari');
  if (error) throw new Error(error.message);
  return { ...BOS_SAYILAR, ...(asObj(data) as Partial<YayinciOnaySayilari>) };
}

export async function AdminYayinciOnayKuyrugu(
  tur?: YayinciOnayTuru | null,
  limit = 150,
): Promise<YayinciOnayKuyrugu> {
  const { data, error } = await supabase.rpc('admin_yayinci_onay_kuyrugu', {
    p_tur: tur ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const d = asObj(data);
  const sayilar = asObj(d.sayilar) as Partial<YayinciOnaySayilari>;
  return {
    sayilar: { ...BOS_SAYILAR, ...sayilar },
    items: Array.isArray(d.items) ? (d.items as YayinciOnayOgesi[]) : [],
  };
}

export async function AdminYayinciOdemeProfiliGetir(userId: string): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_odeme_profili_getir', {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciOdemeProfiliKarar(
  userId: string,
  status: 'verified' | 'rejected',
  note?: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_odeme_profili_karar', {
    p_user_id: userId,
    p_status: status,
    p_note: note?.trim() ? note.trim() : null,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciOdemeBelgesiKarar(
  documentId: string,
  status: 'under_review' | 'approved' | 'rejected',
  note?: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_odeme_belgesi_karar', {
    p_document_id: documentId,
    p_status: status,
    p_note: note?.trim() ? note.trim() : null,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

/**
 * Belge için kısa ömürlü imzalı bağlantı. Sunucu her erişimi finans denetim
 * kaydına yazar; bu yüzden yalnızca gerçek incelemede çağrılmalıdır.
 */
export async function AdminYayinciOdemeBelgesiImzaliUrl(
  documentId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('admin_yayinci_odeme_belgesi_erisim', {
    p_document_id: documentId,
    p_purpose: 'review',
  });
  if (error) throw new Error(error.message);
  const d = asObj(data);
  if (!d.bucket || !d.path) throw new Error('Belge yolu bulunamadı');
  const imza = await supabase.storage
    .from(String(d.bucket))
    .createSignedUrl(String(d.path), Number(d.expires_in ?? 300));
  if (imza.error) throw new Error(imza.error.message);
  return imza.data?.signedUrl ?? null;
}

export async function AdminYayinciOdemeListeleri(): Promise<any[]> {
  const { data, error } = await supabase.rpc('admin_yayinci_odeme_listeleri');
  if (error) throw new Error(error.message);
  return asList(data);
}

export async function AdminYayinciOdemeListesiDetay(batchId: string): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_odeme_listesi_detay', {
    p_batch_id: batchId,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciIadeListesi(): Promise<any[]> {
  const { data, error } = await supabase.rpc('admin_yayinci_iade_listesi');
  if (error) throw new Error(error.message);
  return asList(data);
}

export async function AdminYayinciRiskListesi(): Promise<any[]> {
  const { data, error } = await supabase.rpc('admin_yayinci_risk_listesi');
  if (error) throw new Error(error.message);
  return asList(data);
}

export async function AdminYayinciItirazListesi(): Promise<any[]> {
  const { data, error } = await supabase.rpc('admin_yayinci_itiraz_listesi');
  if (error) throw new Error(error.message);
  return asList(data);
}

export async function AdminYayinciRapor(month?: string): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_rapor', {
    p_month: month ?? null,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciDetay(userId: string): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_detay', { p_user_id: userId });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciOdemeAyarlariGetir(): Promise<YayinciOdemeAyar> {
  const { data, error } = await supabase.rpc('admin_yayinci_odeme_ayarlari_getir');
  if (error) throw new Error(error.message);
  return asObj(data) as YayinciOdemeAyar;
}

/* ------------------------------------------------------------------ */
/* Admin actions (server validated + audit logged)                     */
/* ------------------------------------------------------------------ */

export async function AdminYayinciDonemKapat(month: string): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_donem_kapat', {
    p_month: month,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciOdemeListesiHazirla(
  month: string,
  note?: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_odeme_listesi_hazirla', {
    p_month: month,
    p_note: note?.trim() ? note.trim() : null,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciOdemeBatchOnayla(
  batchId: string,
  note?: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_odeme_batch_onayla', {
    p_batch_id: batchId,
    p_note: note?.trim() ? note.trim() : null,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciOdemeBatchIptal(
  batchId: string,
  note: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_odeme_batch_iptal', {
    p_batch_id: batchId,
    p_note: note.trim(),
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciOdemeOgeIsle(
  itemId: string,
  action: 'sent' | 'completed' | 'failed',
  reference?: string,
  note?: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_odeme_oge_isle', {
    p_item_id: itemId,
    p_action: action,
    p_reference: reference?.trim() ? reference.trim() : null,
    p_note: note?.trim() ? note.trim() : null,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciIadeIsle(
  giftTransactionId: string,
  kind: 'refund' | 'chargeback',
  note: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_iade_isle', {
    p_gift_transaction_id: giftTransactionId,
    p_kind: kind,
    p_note: note.trim(),
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciItirazCoz(
  disputeId: string,
  status: 'reviewing' | 'resolved' | 'rejected',
  note: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_itiraz_coz', {
    p_dispute_id: disputeId,
    p_status: status,
    p_note: note.trim(),
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciKazancDuzelt(girdi: {
  creatorId: string;
  amountUsd: number;
  kind: 'correction' | 'fee' | 'dispute';
  reason: string;
  earningId?: string | null;
}): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_kazanc_duzelt', {
    p_creator_id: girdi.creatorId,
    p_amount_usd: girdi.amountUsd,
    p_kind: girdi.kind,
    p_reason: girdi.reason.trim(),
    p_earning_id: girdi.earningId ?? null,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciProgramDurum(
  userId: string,
  status: 'approved' | 'suspended' | 'rejected' | 'applied' | 'withdrawn',
  note?: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_program_durum', {
    p_user_id: userId,
    p_status: status,
    p_note: note?.trim() ? note.trim() : null,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminOdemeHesabiDogrula(
  accountId: string,
  status: 'verified' | 'rejected' | 'disabled',
  note?: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_odeme_hesabi_dogrula', {
    p_account_id: accountId,
    p_status: status,
    p_note: note?.trim() ? note.trim() : null,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export type OdemeTalimatiDetay = {
  id: string;
  user_id: string;
  method: string;
  scheme: string;
  country_code: string | null;
  currency: string;
  account_holder: string;
  bank_name: string | null;
  iban_masked: string | null;
  details: Record<string, string>;
  status: string;
};

/**
 * Tam ödeme talimatını döndürür. Sunucu her çağrıyı finans denetim kaydına
 * yazar; bu yüzden yalnızca gerçek ödeme yapılırken çağrılmalıdır.
 */
export async function AdminOdemeTalimatiGetir(
  accountId: string,
): Promise<OdemeTalimatiDetay> {
  const { data, error } = await supabase.rpc('admin_odeme_hesabi_detay', {
    p_account_id: accountId,
  });
  if (error) throw new Error(error.message);
  return asObj(data) as OdemeTalimatiDetay;
}

export async function AdminYayinciVergiDurum(
  userId: string,
  status: 'pending' | 'complete' | 'not_required',
  reference?: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_vergi_durum', {
    p_user_id: userId,
    p_status: status,
    p_reference: reference?.trim() ? reference.trim() : null,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminYayinciOdemeAyarlariGuncelle(
  payload: Record<string, unknown>,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_yayinci_odeme_ayarlari_guncelle', {
    p_payload: payload,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}

export async function AdminUlkeOdemeYontemiKaydet(
  countryCode: string,
  method: 'bank_transfer' | 'local_transfer' | 'wallet_transfer',
  payload: Record<string, unknown>,
): Promise<any> {
  const { data, error } = await supabase.rpc('admin_ulke_odeme_yontemi_kaydet', {
    p_country_code: countryCode.trim().toUpperCase(),
    p_method: method,
    p_payload: payload,
  });
  if (error) throw new Error(error.message);
  return asObj(data);
}
