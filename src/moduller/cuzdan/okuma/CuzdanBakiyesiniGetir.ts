import { supabase } from '../../../lib/supabase';
import type { Wallet } from '../../../types/models';

export async function CuzdanBakiyesiniGetir(userId: string): Promise<Wallet | null> {
  const { data, error } = await supabase
    .from('wallets')
    .select('user_id, coins, diamonds, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Wallet) ?? null;
}

export async function HostKazanciniGetir(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('host_earnings')
    .select('diamonds')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.diamonds ?? 0;
}
