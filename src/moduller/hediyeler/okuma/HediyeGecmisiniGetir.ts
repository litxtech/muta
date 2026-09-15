import { supabase } from '../../../lib/supabase';

export type HediyeGecmisiKaydi = {
  id: string;
  yon: 'gonderilen' | 'alinan';
  coins_spent: number;
  diamonds_earned: number;
  quantity: number;
  created_at: string;
  room_id: string | null;
  gift: { id: string; name: string; emoji: string; rarity: string } | null;
  karsi_profil: {
    id: string;
    display_name: string | null;
    username: string | null;
  } | null;
  oda: { id: string; title: string | null } | null;
};

/**
 * Kullanicinin gonderdigi + aldigi hediyeler (kim, ne, ne zaman, hangi oda).
 */
export async function HediyeGecmisiniGetir(
  userId: string,
  limit = 40,
): Promise<HediyeGecmisiKaydi[]> {
  const { data, error } = await supabase
    .from('gift_transactions')
    .select(
      `
      id,
      coins_spent,
      diamonds_earned,
      quantity,
      created_at,
      room_id,
      sender_id,
      receiver_id,
      gift:gifts ( id, name, emoji, rarity ),
      sender:profiles!sender_id ( id, display_name, username ),
      receiver:profiles!receiver_id ( id, display_name, username ),
      oda:rooms ( id, title )
    `,
    )
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data as any[]) ?? []).map((row) => {
    const gonderen = userId === row.sender_id;
    const karsi = gonderen ? row.receiver : row.sender;
    return {
      id: row.id as string,
      yon: gonderen ? ('gonderilen' as const) : ('alinan' as const),
      coins_spent: Number(row.coins_spent ?? 0),
      diamonds_earned: Number(row.diamonds_earned ?? 0),
      quantity: Number(row.quantity ?? 1),
      created_at: row.created_at as string,
      room_id: (row.room_id as string | null) ?? null,
      gift: row.gift ?? null,
      karsi_profil: karsi
        ? {
            id: karsi.id,
            display_name: karsi.display_name,
            username: karsi.username,
          }
        : null,
      oda: row.oda ?? null,
    };
  });
}
