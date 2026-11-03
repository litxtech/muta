import { supabase } from '../../../lib/supabase';

/** Kullanıcının cüzdan hesabı (numara + marka + KYC durumu). */
export type CuzdanHesap = {
  user_id: string;
  wallet_number: string;
  wallet_brand_name: string;
  legal_first_name: string | null;
  legal_last_name: string | null;
  kyc_status: 'none' | 'pending' | 'approved' | 'rejected';
};

/** Cüzdan numarası yoksa sunucuda oluşturur (idempotent). */
export async function CuzdanHesabiGarantile(): Promise<
  { ok: true; hesap: CuzdanHesap } | { ok: false; hata: string }
> {
  const { data, error } = await supabase.rpc('cuzdan_hesabi_garantile');
  if (error) return { ok: false, hata: error.message };
  return { ok: true, hesap: data as CuzdanHesap };
}
