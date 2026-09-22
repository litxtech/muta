import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANAHTAR = 'muta_guest_session_v1';

const IOS_KEYCHAIN: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export type MisafirCihazOturumKaydi = {
  access_token: string;
  refresh_token: string;
  user_id: string;
  device_id: string;
  kaydedildi_at: number;
};

async function oku(key: string) {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  try {
    return await SecureStore.getItemAsync(key, IOS_KEYCHAIN);
  } catch {
    return null;
  }
}

async function yaz(key: string, value: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
  await SecureStore.setItemAsync(key, value, IOS_KEYCHAIN);
}

async function sil(key: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* ignore */
  }
}

/** Misafir çıkışında binding silinmez; oturum token’ları burada saklanır. */
export async function MisafirCihazOturumuKaydet(
  kayit: Omit<MisafirCihazOturumKaydi, 'kaydedildi_at'>,
): Promise<void> {
  const payload: MisafirCihazOturumKaydi = {
    ...kayit,
    kaydedildi_at: Date.now(),
  };
  await yaz(ANAHTAR, JSON.stringify(payload));
}

export async function MisafirCihazOturumuOku(): Promise<MisafirCihazOturumKaydi | null> {
  try {
    const ham = await oku(ANAHTAR);
    if (!ham) return null;
    const j = JSON.parse(ham) as MisafirCihazOturumKaydi;
    if (!j?.access_token || !j?.refresh_token || !j?.user_id) return null;
    return j;
  } catch {
    return null;
  }
}

export async function MisafirCihazOturumuTemizle(): Promise<void> {
  try {
    await sil(ANAHTAR);
  } catch {
    /* ignore */
  }
}
