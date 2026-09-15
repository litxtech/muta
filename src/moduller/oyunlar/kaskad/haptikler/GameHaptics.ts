/**
 * Haptic — önemli anlarda kısa titreşim; spam yok.
 */

import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tamuso.kozmik_kaskad.haptics';
let enabled = true;
let lastAt = 0;
const MIN_GAP_MS = 90;

export async function loadKaskadHapticsEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    enabled = v !== '0';
  } catch {
    enabled = true;
  }
  return enabled;
}

export async function setKaskadHapticsEnabled(on: boolean): Promise<void> {
  enabled = on;
  await AsyncStorage.setItem(KEY, on ? '1' : '0');
}

async function fire(
  style: 'light' | 'medium' | 'heavy',
): Promise<void> {
  if (!enabled) return;
  const now = Date.now();
  if (now - lastAt < MIN_GAP_MS) return;
  lastAt = now;
  try {
    if (style === 'light') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (style === 'medium') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  } catch {
    /* ignore */
  }
}

export const GameHaptics = {
  spin: () => fire('light'),
  match: () => fire('light'),
  multiplier: () => fire('medium'),
  scatter: () => fire('medium'),
  bigWin: () => fire('heavy'),
  bonus: () => fire('heavy'),
} as const;
