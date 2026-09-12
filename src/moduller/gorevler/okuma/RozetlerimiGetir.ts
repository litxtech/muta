import { supabase } from '../../../lib/supabase';

export type KullaniciRozeti = {
  user_id: string;
  badge_code: string;
  awarded_at: string;
  badges?: { name: string; rarity: string; description: string | null } | null;
};

export async function RozetlerimiGetir(): Promise<KullaniciRozeti[]> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('user_badges')
    .select('*, badges(name, rarity, description)')
    .eq('user_id', uid)
    .order('awarded_at', { ascending: false });
  if (error) throw error;
  return (data as KullaniciRozeti[]) ?? [];
}
