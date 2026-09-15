import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PUSH = 'ayarlar.push_enabled';
const KEY_LANG = 'ayarlar.dil';

export type KullaniciAyarlari = {
  pushEnabled: boolean;
  dil: string;
};

export async function KullaniciAyarlariniGetir(): Promise<KullaniciAyarlari> {
  const [push, dil] = await Promise.all([
    AsyncStorage.getItem(KEY_PUSH),
    AsyncStorage.getItem(KEY_LANG),
  ]);
  return {
    pushEnabled: push !== '0',
    dil: dil ?? 'tr',
  };
}

export async function PushBildirimAyariniKaydet(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY_PUSH, enabled ? '1' : '0');
}

export async function DilAyariniKaydet(dil: string): Promise<void> {
  await AsyncStorage.setItem(KEY_LANG, dil);
}
