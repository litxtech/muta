import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CIHAZ_ID_ANAHTARI = 'muta_device_id_v1';

async function depodanOku(key: string) {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function depoyaYaz(key: string, value: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

/** Stabil cihaz kimligi — push / session / risk sinyali icin */
export async function CihazKimliginiGetir(): Promise<string> {
  const mevcut = await depodanOku(CIHAZ_ID_ANAHTARI);
  if (mevcut) return mevcut;
  const yeni = `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await depoyaYaz(CIHAZ_ID_ANAHTARI, yeni);
  return yeni;
}

export function CihazPlatformunuGetir(): 'ios' | 'android' | 'web' | 'unknown' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

export function UygulamaVersiyonunuGetir(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}
