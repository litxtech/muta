import { supabase } from '../../../lib/supabase';

export type OutboxBildirim = {
  id: string;
  category: string;
  title: string;
  body: string | null;
  status: string;
  created_at: string;
  deep_link: string | null;
};

export async function BildirimKuyrugumuGetir(limit = 30): Promise<OutboxBildirim[]> {
  const { data, error } = await supabase
    .from('notification_outbox')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as OutboxBildirim[]) ?? [];
}

export async function BildirimKuyrugaEkleDev(input: {
  title: string;
  body?: string;
  category?: string;
}): Promise<{ ok: boolean; hata?: string }> {
  const { error } = await supabase.rpc('bildirim_kuyruga_ekle_dev', {
    p_title: input.title,
    p_body: input.body ?? null,
    p_category: input.category ?? 'system',
  });
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
