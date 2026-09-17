/**
 * 3-2-1-GO geri sayım + haptic.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  running: boolean;
  onDone: () => void;
};

const STEPS = ['3', '2', '1', 'BAŞLA!'] as const;

export function GeriSayim({ running, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    if (!running) {
      setIndex(0);
      return;
    }

    let cancelled = false;
    let step = 0;
    setIndex(0);

    const tick = async () => {
      if (cancelled) return;
      setIndex(step);
      scale.value = withSequence(
        withTiming(1.2, { duration: 120 }),
        withTiming(1, { duration: 180 }),
      );

      if (step < 3) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      step += 1;
      if (step >= STEPS.length) {
        setTimeout(() => {
          if (!cancelled) onDone();
        }, 450);
        return;
      }
      setTimeout(() => {
        void tick();
      }, 800);
    };

    void tick();
    return () => {
      cancelled = true;
    };
  }, [running, onDone, scale]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!running) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.Text style={[styles.text, anim]}>{STEPS[index]}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 16, 24, 0.55)',
    zIndex: 40,
  },
  text: {
    ...TipografiTokenlari.hero,
    fontSize: 72,
    color: RenkTokenlari.accent,
  },
});
