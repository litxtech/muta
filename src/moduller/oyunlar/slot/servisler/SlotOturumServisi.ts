/**
 * NOX REELS — oturum yardımcıları (bakiye okuma).
 */

import { supabase } from '../../../../lib/supabase';

export async function slotBakiyesiniGetir(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('wallets')
    .select('coins')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return 0;
  return Number((data as { coins?: number } | null)?.coins ?? 0);
}
