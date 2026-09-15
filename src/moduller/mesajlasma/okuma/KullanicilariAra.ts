import { supabase } from '../../../lib/supabase';

export type ArananKullanici = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  public_user_id: string | null;
  is_verified: boolean;
};

function aramaMetniniHazirla(ham: string): string {
  return ham
    .trim()
    .replace(/[%_,]/g, '')
    .slice(0, 40);
}

/**
 * Kullanıcı önerisi — engelli kullanicilar sunucuda elenir.
 */
export async function KullanicilariAra(input: {
  sorgu: string;
  haricUserId?: string | null;
  limit?: number;
}): Promise<ArananKullanici[]> {
  const q = aramaMetniniHazirla(input.sorgu);
  if (q.length < 1) return [];

  const { data, error } = await supabase.rpc('kullanici_ara', {
    p_query: q,
    p_limit: input.limit ?? 20,
  });

  if (error) {
    // Eski sunucu fallback
    const desen = `${q}%`;
    let istek = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, public_user_id, is_verified')
      .is('deleted_at', null)
      .or(
        `username.ilike.${desen},display_name.ilike.${desen},public_user_id.ilike.${desen}`,
      )
      .order('display_name', { ascending: true })
      .limit(input.limit ?? 20);
    if (input.haricUserId) istek = istek.neq('id', input.haricUserId);
    const fb = await istek;
    if (fb.error) throw fb.error;
    return (fb.data as ArananKullanici[]) ?? [];
  }

  let rows = (data as ArananKullanici[]) ?? [];
  if (input.haricUserId) {
    rows = rows.filter((r) => r.id !== input.haricUserId);
  }
  return rows;
}
