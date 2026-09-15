import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  score: number;
  label?: string;
  /** Son hamle kazancı — punch animasyonu */
  punch?: number | null;
};

export function SkorGostergesi({ score, label = 'SKOR', punch }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (punch == null || punch <= 0) return;
    scale.value = withSequence(
      withSpring(1.18, { damping: 8, stiffness: 220 }),
      withTiming(1, { duration: 180 }),
    );
  }, [punch, scale, score]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.box, anim]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{score.toLocaleString('tr-TR')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: RenkTokenlari.bgCard,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.sm,
    minWidth: 96,
  },
  label: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  value: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.accent,
  },
});
