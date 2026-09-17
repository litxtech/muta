/**
 * Buz cam arka plan — iOS gerçek blur; Android yarı saydam frosted cam.
 * `hafif`: Android'de BlurView yok (hediye/coin sheet — GPU donması önler).
 */

import React from 'react';
import {
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView, type BlurTint } from 'expo-blur';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';

type Props = {
  intensity?: number;
  tint?: BlurTint;
  style?: StyleProp<ViewStyle>;
  /** Android / blur yokken — düşük alfa = daha cam */
  fallbackColor?: string;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  /** true: Android BlurView atla (sheet/modal için) */
  hafif?: boolean;
};

export function CamArkaplan({
  intensity = 80,
  tint,
  style,
  fallbackColor,
  pointerEvents,
  hafif = false,
}: Props) {
  const aktifTint = tint ?? RenkTokenlari.blurTint;
  const aktifFallback =
    fallbackColor ??
    (Platform.OS === 'android'
      ? RenkTokenlari.tabBarOverlay
      : RenkTokenlari.bgGlass);

  // iOS: saf BlurView — altındaki feed bulanık görünür
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={intensity}
        tint={aktifTint}
        style={style}
        pointerEvents={pointerEvents}
      />
    );
  }

  // Android hafif: tek solid katman — BlurView GPU'yu kilitlemesin
  if (hafif) {
    return (
      <View
        pointerEvents={pointerEvents}
        style={[{ backgroundColor: aktifFallback }, style]}
      />
    );
  }

  // Android: BlurTarget yokken native blur düşer; ince frosted katman
  return (
    <View pointerEvents={pointerEvents} style={[{ overflow: 'hidden' }, style]}>
      <BlurView
        intensity={Math.min(intensity, 28)}
        tint={aktifTint}
        style={FILL}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={[FILL, { backgroundColor: aktifFallback }]}
      />
    </View>
  );
}

const FILL = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
