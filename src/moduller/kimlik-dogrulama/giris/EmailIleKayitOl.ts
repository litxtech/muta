import { supabase } from '../../../lib/supabase';
import {
  TelefonAuthEmaili,
  TelefonNumarasiniNormalizeEt,
} from '../telefon/TelefonNumarasiniNormalizeEt';

export async function EmailIleKayitOl(input: {
  email?: string;
  /** Opsiyonel — admin ayarına göre */
  phone?: string;
  password: string;
  username: string;
  displayName: string;
  gender?: string;
  /** YYYY-MM-DD — verilirse 18+ kontrolü trigger'da da yapılır */
  birthDate?: string;
  customFields?: Record<string, string>;
}): Promise<{ error?: string; needsConfirm?: boolean }> {
  const phoneHam = (input.phone ?? '').trim();
  let e164: string | null = null;

  if (phoneHam) {
    const tel = TelefonNumarasiniNormalizeEt(phoneHam);
    if (!tel.ok) return { error: tel.hata };

    const { data: musait, error: musaitErr } = await supabase.rpc(
      'telefon_kayit_musait_mi',
      { p_telefon: tel.e164 },
    );
    if (musaitErr) return { error: musaitErr.message };
    if (musait === false) {
      return { error: 'Bu telefon numarası zaten kayıtlı.' };
    }
    e164 = tel.e164;
  }

  const emailHam = (input.email ?? '').trim().toLowerCase();
  const gercekEmail = emailHam.includes('@') ? emailHam : null;

  if (!e164 && !gercekEmail) {
    return {
      error: 'Telefon veya geçerli bir e-posta gerekli.',
    };
  }

  const email = gercekEmail ?? TelefonAuthEmaili(e164!);

  const meta: Record<string, unknown> = {
    username: input.username.trim().toLowerCase(),
    display_name: input.displayName.trim(),
    is_guest: false,
  };
  if (input.gender) meta.gender = input.gender;
  if (e164) meta.phone_e164 = e164;
  if (input.birthDate) meta.birth_date = input.birthDate;
  if (input.customFields && Object.keys(input.customFields).length > 0) {
    meta.custom_fields = input.customFields;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: meta,
    },
  });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('already') || m.includes('registered')) {
      return { error: 'Bu e-posta veya telefon zaten kayıtlı.' };
    }
    return { error: error.message };
  }

  if (data.user?.id && e164) {
    await supabase
      .from('profiles')
      .update({ phone_e164: e164 })
      .eq('id', data.user.id)
      .is('phone_e164', null);
  }

  const sanal = email.endsWith('@phone.tamuso.local');
  if (sanal && !data.session) {
    const { error: girisErr } = await supabase.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (girisErr) {
      return {
        error:
          'Telefon kaydı oluşturuldu ancak oturum açılamadı. E-posta doğrulama açıksa kapatın veya destek ile iletişime geçin.',
      };
    }
    return {};
  }

  return { needsConfirm: !sanal && !data.session };
}
