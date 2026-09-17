import AsyncStorage from '@react-native-async-storage/async-storage';

/** Kalıcı: odadaki uzak ses hacmi 0..1 — oturumlar arası korunur */
const KEY_HACIM = 'tamuso.ses_odasi.uzak_ses_hacim';
/** Eski aç/kapa anahtarı — bir kez okunup migrate edilir */
const KEY_ESKI = 'tamuso.ses_odasi.uzak_ses_acik';

const VARSAYILAN = 1;

let bellek: number | null = null;

function normalize(v: number): number {
  if (!Number.isFinite(v)) return VARSAYILAN;
  return Math.max(0, Math.min(1, v));
}

export async function SesOdasiUzakSesHacmiAl(): Promise<number> {
  if (bellek != null) {
    if (bellek <= 0.02) {
      bellek = VARSAYILAN;
      try {
        await AsyncStorage.setItem(KEY_HACIM, String(bellek));
      } catch {
        /* ignore */
      }
    }
    return bellek;
  }
  try {
    const ham = await AsyncStorage.getItem(KEY_HACIM);
    if (ham != null) {
      const n = normalize(Number(ham));
      // 0 = önceki "kapalı" migrate / yanlış kayıt → odada "ses yok" sanılır
      if (n <= 0.02) {
        bellek = VARSAYILAN;
        await AsyncStorage.setItem(KEY_HACIM, String(bellek));
        return bellek;
      }
      bellek = n;
      return bellek;
    }
    const eski = await AsyncStorage.getItem(KEY_ESKI);
    if (eski != null) {
      bellek = eski === '1' ? 1 : VARSAYILAN;
      await AsyncStorage.setItem(KEY_HACIM, String(bellek));
      return bellek;
    }
  } catch {
    /* ignore */
  }
  bellek = VARSAYILAN;
  return bellek;
}

/** @deprecated SesOdasiUzakSesHacmiAl kullan */
export async function SesOdasiUzakSesAcikMi(): Promise<boolean> {
  return (await SesOdasiUzakSesHacmiAl()) > 0.02;
}

export async function SesOdasiUzakSesHacmiKaydet(hacim: number): Promise<void> {
  bellek = normalize(hacim);
  try {
    await AsyncStorage.setItem(KEY_HACIM, String(bellek));
  } catch {
    /* ignore */
  }
}

/** @deprecated SesOdasiUzakSesHacmiKaydet kullan */
export async function SesOdasiUzakSesKaydet(acik: boolean): Promise<void> {
  await SesOdasiUzakSesHacmiKaydet(acik ? 1 : 0);
}
