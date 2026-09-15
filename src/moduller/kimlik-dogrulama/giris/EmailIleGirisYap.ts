import { supabase } from '../../../lib/supabase';
import { GenelGirisHatasiMesaji } from './GenelGirisHatasiMesaji';
import {
  KimlikTelefonGibiMi,
  TelefonAuthEmaili,
  TelefonNumarasiniNormalizeEt,
} from '../telefon/TelefonNumarasiniNormalizeEt';

/**
 * E-posta, telefon, kullanıcı adı veya public ID + şifre ile giriş.
 */
export async function EmailIleGirisYap(
  kimlik: string,
  password: string,
): Promise<{ error?: string }> {
  const ham = kimlik.trim();
  if (!ham || !password) {
    return { error: GenelGirisHatasiMesaji() };
  }

  let email: string | null = null;

  // Telefon → önce normalize + RPC; yedek sanal e-posta
  if (KimlikTelefonGibiMi(ham)) {
    const tel = TelefonNumarasiniNormalizeEt(ham);
    if (tel.ok) {
      const { data } = await supabase.rpc('giris_icin_email_coz', {
        p_kimlik: tel.e164,
      });
      if (typeof data === 'string' && data.includes('@')) {
        email = data;
      } else {
        email = TelefonAuthEmaili(tel.e164);
      }
    }
  }

  if (!email) {
    const { data, error: cozErr } = await supabase.rpc('giris_icin_email_coz', {
      p_kimlik: ham,
    });
    if (!cozErr && typeof data === 'string' && data.includes('@')) {
      email = data;
    } else if (ham.includes('@')) {
      email = ham.toLowerCase();
    }
  }

  if (!email) {
    return { error: GenelGirisHatasiMesaji() };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: GenelGirisHatasiMesaji(error.message) };
  return {};
}
