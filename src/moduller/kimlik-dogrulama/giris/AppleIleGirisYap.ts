import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../../lib/supabase';
import { GenelGirisHatasiMesaji } from './GenelGirisHatasiMesaji';
import { OAuthProfiliniTamamla } from './OAuthProfiliniTamamla';

export type AppleGirisSonuc =
  | { ok: true }
  | { ok: false; hata: string; iptal?: boolean };

/**
 * Native Sign in with Apple → Supabase signInWithIdToken.
 * İlk yetkilendirmede Apple adı + e-posta profile yazılır.
 */
export async function AppleIleGirisYap(): Promise<AppleGirisSonuc> {
  if (Platform.OS !== 'ios') {
    return { ok: false, hata: 'Apple ile giriş yalnızca iOS’ta desteklenir.' };
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    return { ok: false, hata: 'Bu cihazda Sign in with Apple yok.' };
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { ok: false, hata: 'Apple identity token alınamadı.' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) {
      return { ok: false, hata: GenelGirisHatasiMesaji(error.message) };
    }

    // Apple ad/soyadı + e-posta yalnızca ilk yetkilendirmede gelir
    const parts = credential.fullName
      ? ([
          credential.fullName.givenName,
          credential.fullName.middleName,
          credential.fullName.familyName,
        ].filter(Boolean) as string[])
      : [];
    const appleAd = parts.length > 0 ? parts.join(' ') : null;
    const appleMail =
      typeof credential.email === 'string' && credential.email.includes('@')
        ? credential.email.trim()
        : null;

    if (appleAd || appleMail) {
      const data: Record<string, string> = {};
      if (appleAd) {
        data.full_name = appleAd;
        data.display_name = appleAd;
      }
      if (credential.fullName?.givenName) {
        data.given_name = credential.fullName.givenName;
      }
      if (credential.fullName?.familyName) {
        data.family_name = credential.fullName.familyName;
      }
      if (appleMail) data.email = appleMail;
      try {
        await supabase.auth.updateUser({ data });
      } catch {
        /* metadata opsiyonel */
      }
    }

    await OAuthProfiliniTamamla({
      displayName: appleAd,
      emailHint: appleMail,
    });

    return { ok: true };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'ERR_REQUEST_CANCELED') {
      return { ok: false, hata: 'İptal edildi', iptal: true };
    }
    return {
      ok: false,
      hata: GenelGirisHatasiMesaji(err.message ?? 'Apple girişi başarısız'),
    };
  }
}
