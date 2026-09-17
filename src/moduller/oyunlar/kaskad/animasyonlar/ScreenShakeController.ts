/**
 * ScreenShakeController — reusable shake preset'leri.
 * Normal sembol kazanımında KULLANILMAZ; büyük multiplier / bonus /
 * legendary win anlarına ayrılmıştır.
 */

import { useCallback } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export type ShakePreset = 'SMALL' | 'MEDIUM' | 'LARGE';

const PRESETS: Record<ShakePreset, { amplitude: number; steps: number; stepMs: number }> = {
  SMALL: { amplitude: 3, steps: 4, stepMs: 45 },
  MEDIUM: { amplitude: 6, steps: 6, stepMs: 45 },
  LARGE: { amplitude: 10, steps: 8, stepMs: 50 },
};

export function useScreenShake(enabled = true) {
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  const shake = useCallback(
    (preset: ShakePreset) => {
      if (!enabled) return;
      const p = PRESETS[preset];
      const seqX: number[] = [];
      const seqY: number[] = [];
      for (let i = 0; i < p.steps; i += 1) {
        const decay = 1 - i / p.steps;
        seqX.push((i % 2 === 0 ? 1 : -1) * p.amplitude * decay);
        seqY.push((i % 2 === 0 ? -0.6 : 0.6) * p.amplitude * decay);
      }
      seqX.push(0);
      seqY.push(0);
      offsetX.value = withSequence(
        ...seqX.map((v) =>
          withTiming(v, { duration: p.stepMs, easing: Easing.linear }),
        ),
      );
      offsetY.value = withSequence(
        ...seqY.map((v) =>
          withTiming(v, { duration: p.stepMs, easing: Easing.linear }),
        ),
      );
    },
    [enabled, offsetX, offsetY],
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
    ],
  }));

  return { style, shake };
}
