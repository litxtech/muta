import { supabase } from '../../../lib/supabase';
import {
  TelefonAuthEmaili,
  TelefonNumarasiniNormalizeEt,
} from '../telefon/TelefonNumarasiniNormalizeEt';

export async function EmailIleKayitOl(input: {
  email?: string;
  phone: string;
  password: string;
  username: string;
  displayName: string;
  gender?: string;
  /** YYYY-MM-DD — 18+ zorunlu */
  birthDate?: string;
}): Promise<{ error?: string; needsConfirm?: boolean }> {
  const tel = TelefonNumarasiniNormalizeEt(input.phone);
  if (!tel.ok) return { error: tel.hata };

  const { data: musait, error: musaitErr } = await supabase.rpc(
    'telefon_kayit_musait_mi',
    { p_telefon: tel.e164 },
  );
  if (musaitErr) return { error: musaitErr.message };
  if (musait === false) {
    return { error: 'Bu telefon numarası zaten kayıtlı.' };
  }

  const emailHam = (input.email ?? '').trim().toLowerCase();
  const email =
    emailHam.includes('@') ? emailHam : TelefonAuthEmaili(tel.e164);

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        username: input.username.trim().toLowerCase(),
        display_name: input.displayName.trim(),
        gender: input.gender,
        phone_e164: tel.e164,
        birth_date: input.birthDate ?? null,
        is_guest: false,
      },
      // 6 haneli OTP — link yerine e-posta şablonunda {{ .Token }} kullanılır
    },
  });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('already') || m.includes('registered')) {
      return { error: 'Bu e-posta veya telefon zaten kayıtlı.' };
    }
    return { error: error.message };
  }

  // Trigger phone yazamadıysa (eski kurulum) güncelle
  if (data.user?.id) {
    await supabase
      .from('profiles')
      .update({ phone_e164: tel.e164 })
      .eq('id', data.user.id)
      .is('phone_e164', null);
  }

  // Sanal e-postada confirm gerekmez; hemen oturum aç
  const sanal = email.endsWith('@phone.tamuso.local');
  if (sanal && !data.session) {
    const { error: girisErr } = await supabase.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (girisErr) {
      // Confirm zorunluysa dashboard'da kapatılmalı veya mail doğrulanmalı
      return {
        error:
          'Telefon kaydı oluşturuldu ancak oturum açılamadı. E-posta doğrulama açıksa kapatın veya destek ile iletişime geçin.',
      };
    }
    return {};
  }

  return { needsConfirm: !sanal && !data.session };
}
