import { supabase } from '../../../lib/supabase';
import { GenelGirisHatasiMesaji } from './GenelGirisHatasiMesaji';

export type GirisKimlikTuru = 'email' | 'phone' | 'public_id';

/**
 * Email / telefon / Public ID + sifre ile giris.
 * Public ID cozumu profiles uzerinden (RLS: authenticated oncesi email cozumu
 * Edge Function gerektirir; FAZ 2'de email yolu tam, public_id icin lookup RPC).
 */
export async function EmailIleGirisYap(
  email: string,
  password: string,
): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { error: GenelGirisHatasiMesaji(error.message) };
  return {};
}
