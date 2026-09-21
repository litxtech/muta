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
    // Fallback: kendi engellediklerimizi ve bizi engelleyenleri çıkar
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    const desen = `${q}%`;
    let istek = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, public_user_id, is_verified')
      .is('deleted_at', null)
      .or(
        `username.ilike.${desen},display_name.ilike.${desen},public_user_id.ilike.${desen}`,
      )
      .order('display_name', { ascending: true })
      .limit((input.limit ?? 20) + 30);
    if (input.haricUserId) istek = istek.neq('id', input.haricUserId);
    const fb = await istek;
    if (fb.error) throw fb.error;
    let rows = (fb.data as ArananKullanici[]) ?? [];
    if (uid) {
      const { data: blocks } = await supabase
        .from('user_blocks')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
      const engelli = new Set<string>();
      for (const b of blocks ?? []) {
        if (b.blocker_id === uid) engelli.add(b.blocked_id);
        if (b.blocked_id === uid) engelli.add(b.blocker_id);
      }
      rows = rows.filter((r) => !engelli.has(r.id));
    }
    return rows.slice(0, input.limit ?? 20);
  }

  let rows = (data as ArananKullanici[]) ?? [];
  if (input.haricUserId) {
    rows = rows.filter((r) => r.id !== input.haricUserId);
  }
  return rows;
}
