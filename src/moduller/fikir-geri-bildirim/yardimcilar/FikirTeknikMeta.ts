import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** Güvenli teknik metadata — token/şifre/PII yok */
export function FikirTeknikMetaAl(): {
  platform: string;
  app_version: string | null;
  build_number: string | null;
  os_version: string | null;
} {
  const app =
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    null;
  const build =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    Constants.nativeBuildVersion ??
    null;

  return {
    platform: Platform.OS,
    app_version: app ? String(app) : null,
    build_number: build != null ? String(build) : null,
    os_version: String(Platform.Version ?? ''),
  };
}
