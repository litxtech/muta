/**
 * Multiplier HUD — toplam çarpan pulse.
 */

import React, { memo, useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  total: number;
};

function MultiplierRendererInner({ total }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.25, { duration: 120 }),
      withSpring(1, { damping: 10 }),
    );
  }, [scale, total]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text style={[styles.text, anim]}>{total}x</Animated.Text>
  );
}

export const MultiplierRenderer = memo(MultiplierRendererInner);

const styles = StyleSheet.create({
  text: {
    color: '#FFB3C9',
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '900',
  },
});
