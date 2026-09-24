/**
 * E-posta 6 haneli OTP doğrulama (Supabase verifyOtp).
 */

import i18n from '../../../i18n';
import { supabase } from '../../../lib/supabase';

export type EmailOtpAmaci = 'signup' | 'recovery' | 'email_change';

export async function EmailOtpDogrula(input: {
  email: string;
  kod: string;
  amac: EmailOtpAmaci;
}): Promise<{ ok: boolean; hata?: string }> {
  const email = input.email.trim().toLowerCase();
  const token = input.kod.replace(/\D/g, '').slice(0, 8);
  if (!email.includes('@')) {
    return { ok: false, hata: i18n.t('auth.gecerliEposta') };
  }
  if (token.length < 6) {
    return { ok: false, hata: i18n.t('auth.kodGir') };
  }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: input.amac,
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('expired') || m.includes('otp_expired')) {
      return { ok: false, hata: i18n.t('auth.kodSuresiDoldu') };
    }
    if (m.includes('invalid') || m.includes('token')) {
      return { ok: false, hata: i18n.t('auth.kodHatali') };
    }
    return { ok: false, hata: i18n.t('auth.dogrulamaBasarisiz') };
  }
  return { ok: true };
}
