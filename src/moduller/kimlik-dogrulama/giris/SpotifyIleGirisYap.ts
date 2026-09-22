import { supabase } from '../../../lib/supabase';
import { OrtamDegiskenleri } from '../../../yapilandirma/OrtamDegiskenleri';
import { OAuthProfiliniTamamla } from './OAuthProfiliniTamamla';

type WebBrowserModulu = typeof import('expo-web-browser');

let webBrowserPromise: Promise<WebBrowserModulu> | null = null;

/**
 * expo-auth-session / expo-web-browser native'i olmayan eski binary'de
 * modül yüklenirken çökmesin diye her şey runtime'da import edilir.
 */
function webBrowserAl(): Promise<WebBrowserModulu> {
  if (!webBrowserPromise) {
    webBrowserPromise = import('expo-web-browser')
      .then((mod) => {
        try {
          mod.maybeCompleteAuthSession();
        } catch {
          /* native yok */
        }
        return mod;
      })
      .catch((e) => {
        webBrowserPromise = null;
        throw e;
      });
  }
  return webBrowserPromise;
}

export type SpotifyGirisSonuc =
  | { ok: true }
  | { ok: false; hata: string; iptal?: boolean };

const SPOTIFY_SCOPES = 'user-read-email user-read-private';

function oauthRedirectUri(): string {
  const scheme = OrtamDegiskenleri.uygulamaSemasi || 'muta';
  return `${scheme}://auth/callback`;
}

function queryParamsAl(url: string): {
  params: Record<string, string>;
  errorCode?: string;
} {
  const params: Record<string, string> = {};
  try {
    const qIndex = url.indexOf('?');
    const hIndex = url.indexOf('#');
    const query =
      qIndex >= 0
        ? url.slice(qIndex + 1, hIndex >= 0 && hIndex > qIndex ? hIndex : undefined)
        : '';
    const hash =
      hIndex >= 0
        ? url.slice(hIndex + 1, qIndex >= 0 && qIndex > hIndex ? qIndex : undefined)
        : '';
    const raw = [query, hash].filter(Boolean).join('&');
    for (const part of raw.split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      const key = decodeURIComponent(eq >= 0 ? part.slice(0, eq) : part);
      const val = decodeURIComponent(eq >= 0 ? part.slice(eq + 1) : '');
      if (key) params[key] = val;
    }
  } catch {
    /* bozuk URL */
  }
  const errorCode = params.error || params.error_code || undefined;
  return { params, errorCode };
}

async function oturumuUrlDenOlustur(url: string): Promise<void> {
  const { params, errorCode } = queryParamsAl(url);
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
  await OAuthProfiliniTamamla();
}

function nativeModulHatasiMi(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return (
    msg.includes('ExpoWebBrowser') ||
    msg.includes('Cannot find native module') ||
    msg.includes('native module')
  );
}

/**
 * Supabase Spotify OAuth (PKCE) → uygulama şemasına dönüş.
 * Native expo-web-browser yoksa kontrollü hata döner (uygulama çökmez).
 */
export async function SpotifyIleGirisYap(): Promise<SpotifyGirisSonuc> {
  const redirectTo = oauthRedirectUri();

  let WebBrowser: WebBrowserModulu;
  try {
    WebBrowser = await webBrowserAl();
  } catch (e) {
    if (nativeModulHatasiMi(e)) {
      return {
        ok: false,
        hata:
          'Spotify için yeni development build gerekli (expo-web-browser).',
      };
    }
    return { ok: false, hata: 'Spotify tarayıcısı açılamadı.' };
  }

  try {
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
    if (nativeModulHatasiMi(e)) {
      return {
        ok: false,
        hata:
          'Spotify için yeni development build gerekli (expo-web-browser).',
      };
    }
    const msg = e instanceof Error ? e.message : 'Spotify girişi başarısız';
    return {
      ok: false,
      hata:
        msg.includes('redirect') || msg.includes('Redirect')
          ? 'Yönlendirme ayarı eksik. Supabase Redirect URLs içine muta://** ekle.'
          : 'Spotify girişi başarısız. Tekrar dene.',
    };
  }
}
