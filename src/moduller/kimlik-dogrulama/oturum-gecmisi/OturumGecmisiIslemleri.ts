import { supabase } from '../../../lib/supabase';
import {
  OturumGecmisineKaydet,
  OturumGecmisindenKaldir,
  OturumGecmisiTokeniniGetir,
  OturumGecmisiTokeniniTemizle,
} from './OturumGecmisiDepolama';
import type { OturumGecmisiKaydi } from './tipler';
import type { Profile } from '../../../types/models';
import type { Session } from '@supabase/supabase-js';

function kimlikOlustur(
  session: Session,
  profile: Profile | null,
): string | null {
  const email = session.user.email?.trim();
  if (email) return email;
  const uname = profile?.username?.trim();
  if (uname) return uname;
  return null;
}

/**
 * Manuel çıkış öncesi — misafir değilse lobide avatar olarak sakla.
 * Local signOut refresh token'ı sunucuda iptal etmez.
 */
export async function AktifOturumuGecmiseKaydet(input: {
  session: Session | null;
  profile: Profile | null;
}): Promise<void> {
  const { session } = input;
  if (!session?.refresh_token || !session.access_token) return;

  let profile = input.profile;
  if (!profile) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    profile = (data as Profile) ?? null;
  }

  if (!profile || profile.is_guest) return;
  if (profile.deleted_at || profile.banned_at) {
    await OturumGecmisindenKaldir(session.user.id);
    return;
  }

  await OturumGecmisineKaydet({
    userId: session.user.id,
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    kimlik: kimlikOlustur(session, profile),
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  });
}

export type OturumGecmisindenGirisSonuc =
  | { ok: true }
  | {
      ok: false;
      hata: string;
      needsPassword?: boolean;
      kimlik?: string | null;
    };

/** Kayıtlı hesaba tek dokunuşla gir — token geçersizse şifre ister. */
export async function OturumGecmisindenGirisYap(
  kayit: OturumGecmisiKaydi,
): Promise<OturumGecmisindenGirisSonuc> {
  const token = await OturumGecmisiTokeniniGetir(kayit.userId);
  if (!token) {
    return {
      ok: false,
      hata: 'Oturum süresi dolmuş. Şifrenle tekrar giriş yap.',
      needsPassword: true,
      kimlik: kayit.kimlik ?? kayit.username,
    };
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
  });

  if (error || !data.session) {
    await OturumGecmisiTokeniniTemizle(kayit.userId);
    return {
      ok: false,
      hata: 'Oturum süresi dolmuş. Şifrenle tekrar giriş yap.',
      needsPassword: true,
      kimlik: kayit.kimlik ?? kayit.username,
    };
  }

  // Taze token'ları sakla (yenileme sonrası)
  if (data.session.refresh_token && data.session.access_token) {
    await OturumGecmisineKaydet({
      userId: kayit.userId,
      username: kayit.username,
      displayName: kayit.displayName,
      avatarUrl: kayit.avatarUrl,
      kimlik: kayit.kimlik,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  }

  return { ok: true };
}
