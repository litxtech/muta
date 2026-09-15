import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export type UygulamaOrtami = 'development' | 'test' | 'production';

/**
 * Ortam degiskenlerini tek yerden okur.
 * Secret (service_role, LiveKit secret, APNs key) burada olmaz.
 */
export const OrtamDegiskenleri = {
  ortam: (process.env.EXPO_PUBLIC_APP_ENV ??
    extra.appEnv ??
    'development') as UygulamaOrtami,
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    (extra.supabaseUrl as string | undefined) ??
    '',
  supabaseAnonAnahtari:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    (extra.supabaseAnonKey as string | undefined) ??
    '',
  uygulamaAdi: process.env.EXPO_PUBLIC_APP_NAME ?? 'Tamuso',
  uygulamaSemasi: process.env.EXPO_PUBLIC_APP_SCHEME ?? 'muta',
  livekitUrl:
    process.env.EXPO_PUBLIC_LIVEKIT_URL ??
    (extra.livekitUrl as string | undefined) ??
    '',
  livekitTokenUrl:
    process.env.EXPO_PUBLIC_LIVEKIT_TOKEN_URL ??
    (extra.livekitTokenUrl as string | undefined) ??
    '',
};

export const uretimOrtamiMi = OrtamDegiskenleri.ortam === 'production';
