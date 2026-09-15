/**
 * E-posta OTP yeniden gönder (kayıt / şifre sıfırlama).
 */

import { supabase } from '../../../lib/supabase';
import type { EmailOtpAmaci } from './EmailOtpDogrula';

export async function EmailOtpYenidenGonder(input: {
  email: string;
  amac: EmailOtpAmaci;
}): Promise<{ ok: boolean; hata?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) {
    return { ok: false, hata: 'Geçerli e-posta gerekli.' };
  }

  if (input.amac === 'signup' || input.amac === 'email_change') {
    const { error } = await supabase.auth.resend({
      type: input.amac === 'email_change' ? 'email_change' : 'signup',
      email,
    });
    if (error) return { ok: false, hata: error.message };
    return { ok: true };
  }

  // recovery
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return { ok: false, hata: error.message };
  return { ok: true };
}
