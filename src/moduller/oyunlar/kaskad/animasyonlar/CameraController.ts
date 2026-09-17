/**
 * CameraController — gerçek 3D kamera yok; 2D composition üzerinde
 * scale / translate ile kamera hissi preset'leri.
 */

import { useCallback } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export type CameraPreset =
  | 'CAMERA_NORMAL'
  | 'CAMERA_MULTIPLIER'
  | 'CAMERA_BONUS'
  | 'CAMERA_BIG_WIN'
  | 'CAMERA_RETURN';

const PRESETS: Record<CameraPreset, { scale: number; translateY: number; ms: number }> = {
  CAMERA_NORMAL: { scale: 1, translateY: 0, ms: 350 },
  CAMERA_MULTIPLIER: { scale: 1.03, translateY: -4, ms: 380 },
  CAMERA_BONUS: { scale: 1.05, translateY: -8, ms: 600 },
  CAMERA_BIG_WIN: { scale: 1.045, translateY: -6, ms: 500 },
  CAMERA_RETURN: { scale: 1, translateY: 0, ms: 450 },
};

export function useCameraEffect(enabled = true) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const setPreset = useCallback(
    (preset: CameraPreset) => {
      if (!enabled) return;
      const p = PRESETS[preset];
      scale.value = withTiming(p.scale, {
        duration: p.ms,
        easing: Easing.out(Easing.quad),
      });
      translateY.value = withTiming(p.translateY, {
        duration: p.ms,
        easing: Easing.out(Easing.quad),
      });
    },
    [enabled, scale, translateY],
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  return { style, setPreset };
}
