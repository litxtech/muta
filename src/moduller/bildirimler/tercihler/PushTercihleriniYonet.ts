import { supabase } from '../../../lib/supabase';
import type { PushTercihAnahtari, PushTercihleri } from './PushTercihTipleri';

const BOS: Omit<PushTercihleri, 'user_id' | 'updated_at'> = {
  all_enabled: true,
  messages: true,
  gifts: true,
  live: true,
  rooms: true,
  social: true,
  wallet: true,
  system: true,
};

export async function PushTercihleriniGetir(): Promise<PushTercihleri> {
  const { data, error } = await supabase.rpc('benim_push_tercihlerimi_getir');
  if (error) throw error;
  return data as PushTercihleri;
}

export async function PushTercihiniKaydet(
  key: PushTercihAnahtari,
  value: boolean,
): Promise<PushTercihleri> {
  const payload: Record<string, boolean> = { [`p_${key}`]: value };
  const { data, error } = await supabase.rpc('benim_push_tercihlerimi_kaydet', payload);
  if (error) throw error;
  return data as PushTercihleri;
}

export async function PushTercihleriniTopluKaydet(
  patch: Partial<Record<PushTercihAnahtari, boolean>>,
): Promise<PushTercihleri> {
  const { data, error } = await supabase.rpc('benim_push_tercihlerimi_kaydet', {
    p_all_enabled: patch.all_enabled ?? null,
    p_messages: patch.messages ?? null,
    p_gifts: patch.gifts ?? null,
    p_live: patch.live ?? null,
    p_rooms: patch.rooms ?? null,
    p_social: patch.social ?? null,
    p_wallet: patch.wallet ?? null,
    p_system: patch.system ?? null,
  });
  if (error) throw error;
  return data as PushTercihleri;
}

export function VarsayilanPushTercihleri(userId = ''): PushTercihleri {
  return {
    user_id: userId,
    updated_at: new Date().toISOString(),
    ...BOS,
  };
}
