import { supabase } from '../../../lib/supabase';
import type { Profile } from '../../../types/models';

export async function ProfilGetir(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function PublicIdIleProfilGetir(publicId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('public_user_id', publicId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}
