import type { ConfigContext, ExpoConfig } from 'expo/config';
import fs from 'node:fs';

const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME ?? 'Tamuso';
const SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME ?? 'muta';

const envBadge =
  APP_ENV === 'production' ? '' : APP_ENV === 'test' ? ' (Test)' : ' (Dev)';
const displayName = `${APP_NAME}${envBadge}`;

/** Android FCM: EAS env veya proje kökü google-services.json */
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ||
  (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: displayName,
  slug: 'muta',
  owner: 'mutaq',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme: SCHEME,
  ios: {
    supportsTablet: false,
    usesAppleSignIn: true,
    bundleIdentifier: 'com.litxtech.muta',
    // Push: ilk device build'de "Push Notifications? No" secildi.
    // Sonraki build'de credential yenilenince Push capability + APNs acilmali.
    entitlements: {
      'aps-environment':
        APP_ENV === 'production' ? 'production' : 'development',
    },
    infoPlist: {
      CFBundleDisplayName: displayName,
      CFBundleName: APP_NAME,
      UIBackgroundModes: ['remote-notification', 'audio'],
      NSCameraUsageDescription:
        'Allow $(PRODUCT_NAME) to access your camera for live video.',
      NSMicrophoneUsageDescription:
        'Allow $(PRODUCT_NAME) to access your microphone for voice rooms and live.',
      NSBluetoothAlwaysUsageDescription:
        'Allow $(PRODUCT_NAME) to use Bluetooth audio devices during calls.',
      NSBluetoothPeripheralUsageDescription:
        'Allow $(PRODUCT_NAME) to connect to Bluetooth headsets.',
      ITSAppUsesNonExemptEncryption: false,
      LSApplicationQueriesSchemes: ['whatsapp', 'whatsapp-business'],
    },
  },
  android: {
    label: displayName,
    userInterfaceStyle: 'dark',
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      backgroundColor: '#0B0614',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    package: 'com.litxtech.muta',
    // Firebase Cloud Messaging (FCM) — google-services.json zorunlu (build)
    ...(googleServicesFile ? { googleServicesFile } : {}),
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.WAKE_LOCK',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
    ],
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
    'expo-web-browser',
    'expo-iap',
    'expo-system-ui',
    'expo-sharing',
    [
      '@livekit/react-native-expo-plugin',
      {
        android: {
          // Android→iOS ses için CommunicationAudioType zorunlu
          audioType: 'communication',
        },
      },
    ],
    './plugins/withSesOdasiForegroundService.js',
    '@config-plugins/react-native-webrtc',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow $(PRODUCT_NAME) to access your photos for profile and cover images.',
        cameraPermission:
          'Allow $(PRODUCT_NAME) to access your camera for live video.',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission:
          'Allow $(PRODUCT_NAME) to access your microphone for voice rooms and live.',
        enableBackgroundPlayback: true,
        enableBackgroundRecording: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow $(PRODUCT_NAME) to access your camera for live video, KYC and wallet QR scan.',
        microphonePermission:
          'Allow $(PRODUCT_NAME) to access your microphone for voice rooms and live.',
        recordAudioAndroid: true,
        barcodeScannerEnabled: true,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
        },
        ios: {
          deploymentTarget: '16.4',
        },
      },
    ],
    [
      'expo-notifications',
      {
        color: '#E84091',
        defaultChannel: 'genel',
        sounds: ['./assets/sounds/mesaj_uc_ton.wav'],
      },
    ],
    'expo-video',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0B0614',
        // Android styles her zaman @drawable/splashscreen_logo bekler;
        // image yoksa drawable üretilmez ve processDebugResources patlar.
        image: './assets/splash-icon.png',
        imageWidth: 200,
        dark: {
          backgroundColor: '#0B0614',
          image: './assets/splash-icon.png',
        },
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
    rtcProvider: 'livekit',
    androidFcmEnabled: !!googleServicesFile,
    eas: {
      projectId: '36cb815b-2891-4075-a1a8-89902e491af5',
    },
  },
});
