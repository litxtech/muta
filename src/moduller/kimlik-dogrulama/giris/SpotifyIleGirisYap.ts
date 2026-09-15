import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from '../../../lib/supabase';
import { OrtamDegiskenleri } from '../../../yapilandirma/OrtamDegiskenleri';

type WebBrowserModulu = typeof import('expo-web-browser');

let webBrowserPromise: Promise<WebBrowserModulu> | null = null;

function webBrowserAl(): Promise<WebBrowserModulu> {
  if (!webBrowserPromise) {
    webBrowserPromise = import('expo-web-browser').then((mod) => {
      try {
        mod.maybeCompleteAuthSession();
      } catch {
        // Native modül yoksa (eski dev client) sessiz geç
      }
      return mod;
    });
  }
  return webBrowserPromise;
}

export type SpotifyGirisSonuc =
  | { ok: true }
  | { ok: false; hata: string; iptal?: boolean };

const SPOTIFY_SCOPES = 'user-read-email user-read-private';

function oauthRedirectUri(): string {
  return makeRedirectUri({
    scheme: OrtamDegiskenleri.uygulamaSemasi || 'muta',
    path: 'auth/callback',
  });
}

async function oturumuUrlDenOlustur(url: string): Promise<void> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    throw new Error(errorCode);
  }

  const code = params.code;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (!access_token) {
    throw new Error('OAuth yanıtında oturum bilgisi yok.');
  }

  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token ?? '',
  });
  if (error) throw error;
}

/** Spotify ad / avatar varsa profili zenginleştir (ilk kayıt). */
async function spotifyProfiliniTamamla(): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return;

  const meta = user.user_metadata ?? {};
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    null;
  const avatarUrl =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    null;

  if (!displayName && !avatarUrl) return;

  const patch: { display_name?: string; avatar_url?: string } = {};
  if (displayName) patch.display_name = displayName;
  if (avatarUrl) patch.avatar_url = avatarUrl;

  await supabase.from('profiles').update(patch).eq('id', user.id);
}

/**
 * Supabase Spotify OAuth (PKCE) → uygulama şemasına dönüş.
 * Supabase Auth → Redirect URLs: `muta://**` (veya `muta://auth/callback`) ekli olmalı.
 * Spotify Developer Dashboard callback: `https://<project>.supabase.co/auth/v1/callback`
 */
export async function SpotifyIleGirisYap(): Promise<SpotifyGirisSonuc> {
  const redirectTo = oauthRedirectUri();

  try {
    const WebBrowser = await webBrowserAl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        redirectTo,
        scopes: SPOTIFY_SCOPES,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { ok: false, hata: 'Spotify girişi başlatılamadı. Tekrar dene.' };
    }
    if (!data.url) {
      return { ok: false, hata: 'Spotify yetkilendirme adresi alınamadı.' };
    }

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (res.type === 'cancel' || res.type === 'dismiss') {
      return { ok: false, hata: 'İptal edildi', iptal: true };
    }
    if (res.type !== 'success' || !('url' in res) || !res.url) {
      return { ok: false, hata: 'Spotify girişi tamamlanamadı.' };
    }

    await oturumuUrlDenOlustur(res.url);
    await spotifyProfiliniTamamla();
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Spotify girişi başarısız';
    if (msg.includes('ExpoWebBrowser') || msg.includes('native module')) {
      return {
        ok: false,
        hata:
          'Spotify için yeni development build gerekli (expo-web-browser).',
      };
    }
    return {
      ok: false,
      hata:
        msg.includes('redirect') || msg.includes('Redirect')
          ? 'Yönlendirme ayarı eksik. Supabase Redirect URLs içine muta://** ekle.'
          : 'Spotify girişi başarısız. Tekrar dene.',
    };
  }
}
