/**
 * E-posta 6 haneli OTP doğrulama (Supabase verifyOtp).
 */

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
    return { ok: false, hata: 'Geçerli e-posta gerekli.' };
  }
  if (token.length < 6) {
    return { ok: false, hata: '6 haneli doğrulama kodunu gir.' };
  }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: input.amac,
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('expired') || m.includes('otp_expired')) {
      return { ok: false, hata: 'Kodun süresi dolmuş. Yeni kod iste.' };
    }
    if (m.includes('invalid') || m.includes('token')) {
      return { ok: false, hata: 'Kod hatalı. Kontrol edip tekrar dene.' };
    }
    return { ok: false, hata: error.message };
  }
  return { ok: true };
}
