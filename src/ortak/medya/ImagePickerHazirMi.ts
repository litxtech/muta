import { Platform } from 'react-native';

/**
 * Expo Modules (SDK 50+) NativeModules'a yazmaz.
 * requireOptionalNativeModule ile gerçek bağlantıyı kontrol et.
 */
export function ImagePickerNativeHazirMi(): boolean {
  if (Platform.OS === 'web') return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo-modules-core') as {
      requireOptionalNativeModule: (name: string) => unknown;
    };
    return requireOptionalNativeModule('ExponentImagePicker') != null;
  } catch {
    return false;
  }
}

export async function ImagePickerModuluYukle(): Promise<
  | { ok: true; ImagePicker: typeof import('expo-image-picker') }
  | { ok: false; hata: string }
> {
  if (!ImagePickerNativeHazirMi()) {
    return {
      ok: false,
      hata: 'Medya seçici bu build’de yok. Yeni development build kur.',
    };
  }
  try {
    const ImagePicker = await import('expo-image-picker');
    return { ok: true, ImagePicker };
  } catch {
    return {
      ok: false,
      hata: 'expo-image-picker yüklenemedi. Development build yenile.',
    };
  }
}
