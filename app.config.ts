import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME ?? 'Muta';
const SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME ?? 'muta';

const envBadge =
  APP_ENV === 'production' ? '' : APP_ENV === 'test' ? ' (Test)' : ' (Dev)';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `${APP_NAME}${envBadge}`,
  slug: 'muta',
  owner: 'mutaq',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme: SCHEME,
  ios: {
    supportsTablet: true,
    usesAppleSignIn: true,
    bundleIdentifier:
      APP_ENV === 'production'
        ? 'com.mutaq.muta'
        : APP_ENV === 'test'
          ? 'com.mutaq.muta.test'
          : 'com.mutaq.muta.dev',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0B0614',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    package:
      APP_ENV === 'production'
        ? 'com.mutaq.muta'
        : APP_ENV === 'test'
          ? 'com.mutaq.muta.test'
          : 'com.mutaq.muta.dev',
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-dev-client',
    'expo-apple-authentication',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0B0614',
        image: './assets/splash-icon.png',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appEnv: APP_ENV,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    livekitUrl: process.env.EXPO_PUBLIC_LIVEKIT_URL,
    livekitTokenUrl: process.env.EXPO_PUBLIC_LIVEKIT_TOKEN_URL,
    eas: {
      projectId: '36cb815b-2891-4075-a1a8-89902e491af5',
    },
  },
});
