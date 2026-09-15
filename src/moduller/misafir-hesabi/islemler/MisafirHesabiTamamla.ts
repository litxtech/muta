import { supabase } from '../../../lib/supabase';
import { OrtamDegiskenleri } from '../../../yapilandirma/OrtamDegiskenleri';

function kullaniciAdiNormalize(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/i\u0307/g, 'i') // İ → i̇ (combining)
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16);
}

function benzersizKullaniciAdi(ad: string, soyad: string, uid?: string): string {
  const base =
    kullaniciAdiNormalize(`${ad}${soyad}`) ||
    kullaniciAdiNormalize(ad) ||
    'user';
  const suffix = (uid ?? Date.now().toString(36))
    .replace(/-/g, '')
    .slice(-6);
  const combined = `${base}${suffix}`.slice(0, 24);
  return combined.length >= 3 ? combined : `user${suffix}`;
}

async function profilMisafirBayraginiDusur(input: {
  uid: string;
  displayName: string;
  username: string;
}): Promise<{ ok: true } | { ok: false; hata: string }> {
  const { error: rpcError } = await supabase.rpc('misafir_hesabi_tamamlandi', {
    p_display_name: input.displayName,
    p_username: input.username,
  });
  if (!rpcError) return { ok: true };

  console.warn('[MisafirHesabiTamamla] profil RPC:', rpcError.message);

  const adaylar = [
    input.username,
    `${input.username}${Math.floor(Math.random() * 90 + 10)}`.slice(0, 24),
    `u${input.uid.replace(/-/g, '').slice(0, 12)}`,
  ];

  let sonHata = rpcError.message;
  for (const username of adaylar) {
    const { data, error: upErr } = await supabase
      .from('profiles')
      .update({
        is_guest: false,
        display_name: input.displayName,
        username,
      })
      .eq('id', input.uid)
      .select('id')
      .maybeSingle();

    if (!upErr && data?.id) return { ok: true };
    if (upErr) {
      sonHata = upErr.message;
      if (upErr.code !== '23505' && !/duplicate|unique/i.test(upErr.message)) {
        break;
      }
    }
  }

  const { data: minimal, error: minimalErr } = await supabase
    .from('profiles')
    .update({
      is_guest: false,
      display_name: input.displayName,
    })
    .eq('id', input.uid)
    .select('id')
    .maybeSingle();

  if (!minimalErr && minimal?.id) return { ok: true };

  return {
    ok: false,
    hata: `Hesap bağlandı ama profil güncellenemedi: ${minimalErr?.message || sonHata}`,
  };
}

/**
 * Guest → Registered: ayni internal UUID korunur (anonymous upgrade).
 * Profil is_guest=false mutlaka yazilir; session anonymous bayragi
 * e-posta onayina kadar kalabilir — UI profil bayragina bakar.
 */
export async function MisafirHesabiTamamla(input: {
  ad: string;
  soyad: string;
  email: string;
  password: string;
}): Promise<{ ok: boolean; hata?: string; needsConfirm?: boolean }> {
  const displayName = `${input.ad.trim()} ${input.soyad.trim()}`.trim();
  const email = input.email.trim().toLowerCase();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, hata: userErr?.message ?? 'Oturum yok' };
  }

  const mevcut = userData.user;
  const uid = mevcut.id;
  const username = benzersizKullaniciAdi(input.ad, input.soyad, uid);

  const emailZatenVar = Boolean(
    mevcut.email ||
      mevcut.identities?.some((i) => i.provider === 'email'),
  );

  // Yarıda kalmış yükseltme: auth tamam, profil değil → sadece profili düzelt
  if (!emailZatenVar) {
    const { data, error } = await supabase.auth.updateUser({
      email,
      password: input.password,
      data: {
        is_guest: false,
        display_name: displayName,
        username,
        first_name: input.ad.trim(),
        last_name: input.soyad.trim(),
      },
    });

    if (error) return { ok: false, hata: error.message };

    const profil = await profilMisafirBayraginiDusur({
      uid: data.user?.id ?? uid,
      displayName,
      username,
    });
    if (!profil.ok) return { ok: false, hata: profil.hata };

    return {
      ok: true,
      needsConfirm: !data.user?.email_confirmed_at,
    };
  }

  // E-posta bağlı ama şifre / meta eksik olabilir
  const { error: metaErr } = await supabase.auth.updateUser({
    password: input.password,
    data: {
      is_guest: false,
      display_name: displayName,
      username,
      first_name: input.ad.trim(),
      last_name: input.soyad.trim(),
    },
  });
  if (metaErr && !/same password|should be different/i.test(metaErr.message)) {
    // Şifre aynıysa devam; diğer hatalarda yine profili dene
    console.warn('[MisafirHesabiTamamla] meta/şifre:', metaErr.message);
  }

  const profil = await profilMisafirBayraginiDusur({
    uid,
    displayName,
    username,
  });
  if (!profil.ok) return { ok: false, hata: profil.hata };

  return {
    ok: true,
    needsConfirm: !mevcut.email_confirmed_at,
  };
}

export function MisafirEmailDogrulamaYonlendirmesi(): string {
  return `${OrtamDegiskenleri.uygulamaSemasi}://auth/callback`;
}
