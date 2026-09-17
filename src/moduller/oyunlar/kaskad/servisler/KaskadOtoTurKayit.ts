/**
 * Oto tur kalan sayısı — uygulama arka plana düşünce / öldürülünce kaybolmasın.
 * Yeni spin atmaz; yalnızca duraklatılmış sayacı hatırlar.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'tamuso.kaskad.oto_tur_v1';
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type KaskadOtoTurDurum = {
  userId: string;
  remaining: number;
  bet: number;
  updatedAt: number;
};

export async function loadKaskadOtoTur(
  userId: string,
): Promise<KaskadOtoTurDurum | null> {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KaskadOtoTurDurum>;
    if (parsed.userId !== userId) return null;
    const remaining = Math.floor(Number(parsed.remaining ?? 0));
    const bet = Math.floor(Number(parsed.bet ?? 0));
    const updatedAt = Number(parsed.updatedAt ?? 0);
    if (!(remaining > 0) || !(bet > 0)) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!(updatedAt > 0) || Date.now() - updatedAt > MAX_AGE_MS) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { userId, remaining, bet, updatedAt };
  } catch {
    return null;
  }
}

export async function saveKaskadOtoTur(input: {
  userId: string;
  remaining: number;
  bet: number;
}): Promise<void> {
  if (!input.userId) return;
  const remaining = Math.max(0, Math.floor(input.remaining));
  if (remaining <= 0) {
    await clearKaskadOtoTur();
    return;
  }
  try {
    const durum: KaskadOtoTurDurum = {
      userId: input.userId,
      remaining,
      bet: Math.max(0, Math.floor(input.bet)),
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(durum));
  } catch {
    /* depolama hatası oyunu durdurmaz */
  }
}

export async function clearKaskadOtoTur(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
