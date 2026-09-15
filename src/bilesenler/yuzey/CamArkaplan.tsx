/**
 * iOS: BlurView. Android: opak yüzey (BlurView dark tint sadece gri gölge verir).
 */

import React from 'react';
import {
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';

type Props = {
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  style?: StyleProp<ViewStyle>;
  /** Android / blur yokken */
  fallbackColor?: string;
  /** Backdrop olarak absoluteFill kullanıldığında dokunuşları alt katmana bırak */
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

export function CamArkaplan({
  intensity = 40,
  tint = 'dark',
  style,
  fallbackColor = RenkTokenlari.bgElevated,
  pointerEvents,
}: Props) {
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={intensity}
        tint={tint}
        style={style}
        pointerEvents={pointerEvents}
      />
    );
  }
  return (
    <View
      pointerEvents={pointerEvents}
      style={[{ backgroundColor: fallbackColor }, style]}
    />
  );
}
