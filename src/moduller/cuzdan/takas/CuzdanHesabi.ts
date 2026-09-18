import { supabase } from '../../../lib/supabase';
import type { WalletAccount } from './CuzdanTakasTipleri';

export async function CuzdanHesabiGarantile(): Promise<
  { ok: true; hesap: WalletAccount } | { ok: false; hata: string }
> {
  const { data, error } = await supabase.rpc('cuzdan_hesabi_garantile');
  if (error) return { ok: false, hata: error.message };
  return { ok: true, hesap: data as WalletAccount };
}

export async function CuzdanHesabiGetir(
  userId: string,
): Promise<WalletAccount | null> {
  const { data } = await supabase
    .from('wallet_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as WalletAccount) ?? null;
}
