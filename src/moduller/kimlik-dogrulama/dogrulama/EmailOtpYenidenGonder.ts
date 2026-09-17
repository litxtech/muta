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
    if (error) return { ok: false, hata: emailGonderimHatasi(error.message) };
    return { ok: true };
  }

  // recovery
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return { ok: false, hata: emailGonderimHatasi(error.message) };
  return { ok: true };
}

function emailGonderimHatasi(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes('rate') ||
    m.includes('security purposes') ||
    m.includes('after') ||
    m.includes('429')
  ) {
    return 'Çok sık kod istendi. 60 saniye bekleyip tekrar dene. Spam klasörünü de kontrol et.';
  }
  if (m.includes('smtp') || m.includes('error sending')) {
    return 'E-posta sunucusu kodu iletemedi. Biraz sonra tekrar dene veya destek ile iletişime geç.';
  }
  return message;
}
