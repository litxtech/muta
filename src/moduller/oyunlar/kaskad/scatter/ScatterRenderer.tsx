/**
 * Scatter / Portal renderer — pulse glow.
 */

import React, { memo, useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';

type Props = {
  size: number;
  nearMiss?: boolean;
};

function ScatterRendererInner({ size, nearMiss }: Props) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: nearMiss ? 220 : 700 }),
        withTiming(1, { duration: nearMiss ? 220 : 700 }),
      ),
      -1,
      false,
    );
  }, [nearMiss, scale]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text
      style={[
        styles.icon,
        anim,
        { fontSize: size * 0.55, color: RenkTokenlari.violet },
      ]}
    >
      ◉
    </Animated.Text>
  );
}

export const ScatterRenderer = memo(ScatterRendererInner);

const styles = StyleSheet.create({
  icon: { fontWeight: '900', textAlign: 'center' },
});
