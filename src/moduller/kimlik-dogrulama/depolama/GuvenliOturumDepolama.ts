import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * iOS: AFTER_FIRST_UNLOCK — cihaz kilitliyken de autoRefreshToken okuyabilsin.
 * Varsayılan WHEN_UNLOCKED → "User interaction is not allowed" (Keychain).
 * Mevcut anahtarların accessibility'si SecItemUpdate ile değişmez; yazmadan önce silinir.
 */
const IOS_KEYCHAIN: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/**
 * Supabase Auth storage adapter.
 * Native: SecureStore (Keychain/Keystore).
 * Web: AsyncStorage fallback (SecureStore web sinirli).
 */
export const GuvenliOturumDepolama = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    try {
      return await SecureStore.getItemAsync(key, IOS_KEYCHAIN);
    } catch {
      // Kilitli cihaz / geçici Keychain — autoRefresh tick sessizce geçsin
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
      await SecureStore.setItemAsync(key, value, IOS_KEYCHAIN);
    } catch {
      /* autoRefresh yeniden dener */
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* ignore */
    }
  },
};
