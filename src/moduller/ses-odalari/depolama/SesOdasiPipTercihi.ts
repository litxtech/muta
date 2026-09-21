import AsyncStorage from '@react-native-async-storage/async-storage';

/** Kalıcı: ses odası Android Picture-in-Picture — varsayılan açık (YouTube gibi) */
const KEY = 'tamuso.ses_odasi.pip_acik';

const VARSAYILAN = true;

let bellek: boolean | null = null;

export async function SesOdasiPipAcikMi(): Promise<boolean> {
  if (bellek != null) return bellek;
  try {
    const ham = await AsyncStorage.getItem(KEY);
    if (ham != null) {
      bellek = ham !== '0';
      return bellek;
    }
  } catch {
    /* ignore */
  }
  bellek = VARSAYILAN;
  return bellek;
}

export async function SesOdasiPipKaydet(acik: boolean): Promise<void> {
  bellek = acik;
  try {
    await AsyncStorage.setItem(KEY, acik ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Senkron okuma — bellek yoksa varsayılan (açık) */
export function SesOdasiPipBellekten(): boolean {
  return bellek ?? VARSAYILAN;
}
