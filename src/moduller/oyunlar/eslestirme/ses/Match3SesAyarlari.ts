/**
 * Match-3 ses / müzik / haptic tercihleri — AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@tamuso/match3/ses-ayarlari';

export type Match3SesAyarlari = {
  sfx: boolean;
  music: boolean;
  haptic: boolean;
};

const DEFAULTS: Match3SesAyarlari = {
  sfx: true,
  music: true,
  haptic: true,
};

export async function loadMatch3SesAyarlari(): Promise<Match3SesAyarlari> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Match3SesAyarlari>;
    return {
      sfx: parsed.sfx ?? DEFAULTS.sfx,
      music: parsed.music ?? DEFAULTS.music,
      haptic: parsed.haptic ?? DEFAULTS.haptic,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveMatch3SesAyarlari(
  patch: Partial<Match3SesAyarlari>,
): Promise<Match3SesAyarlari> {
  const current = await loadMatch3SesAyarlari();
  const next: Match3SesAyarlari = { ...current, ...patch };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* depolama hatası yutulur */
  }
  return next;
}
