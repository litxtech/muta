import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../../lib/supabase';
import { GenelGirisHatasiMesaji } from './GenelGirisHatasiMesaji';

export type AppleGirisSonuc =
  | { ok: true }
  | { ok: false; hata: string; iptal?: boolean };

/**
 * Native Sign in with Apple → Supabase signInWithIdToken.
 * Secret key gerekmez (native). Bundle ID'ler Supabase Client IDs listesinde olmali.
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

    // Apple ad/soyadı yalnızca ilk yetkilendirmede gelir
    if (credential.fullName) {
      const parts = [
        credential.fullName.givenName,
        credential.fullName.middleName,
        credential.fullName.familyName,
      ].filter(Boolean) as string[];
      if (parts.length > 0) {
        await supabase.auth.updateUser({
          data: {
            full_name: parts.join(' '),
            given_name: credential.fullName.givenName,
            family_name: credential.fullName.familyName,
          },
        });
      }
    }

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
