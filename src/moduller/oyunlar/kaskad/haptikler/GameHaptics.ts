/**
 * Haptic — önemli anlarda kısa titreşim; spam yok.
 * AnimationDirector eventlerine subscribe olur → ses/görüntü ile senkron.
 */

import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  GameEventName,
  GameEventPayload,
} from '../animasyonlar/AnimationDirector';

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
  try {
    await AsyncStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function isKaskadHapticsEnabled(): boolean {
  return enabled;
}

async function fire(style: 'light' | 'medium' | 'heavy'): Promise<void> {
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
  bigMultiplier: () => fire('heavy'),
  scatter: () => fire('medium'),
  bigWin: () => fire('heavy'),
  bonus: () => fire('heavy'),
} as const;

/** AnimationDirector event → haptic eşlemesi */
export function kaskadHapticEventListener(
  event: GameEventName,
  payload: GameEventPayload,
): void {
  switch (event) {
    case 'SPIN_START':
      void GameHaptics.spin();
      break;
    case 'MATCH_START':
      void GameHaptics.match();
      break;
    case 'MULTIPLIER_REVEAL':
      if ((payload.maxMultiplier ?? 0) >= 25) void GameHaptics.bigMultiplier();
      else void GameHaptics.multiplier();
      break;
    case 'SCATTER_LAND':
      void GameHaptics.scatter();
      break;
    case 'BONUS_TRIGGER':
    case 'RETRIGGER':
      void GameHaptics.bonus();
      break;
    case 'BIG_WIN':
      void GameHaptics.bigWin();
      break;
    default:
      break;
  }
}
