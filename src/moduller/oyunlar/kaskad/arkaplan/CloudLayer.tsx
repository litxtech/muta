/**
 * CloudLayer — yatay süzülen yumuşak bulut katmanı (parallax parçası).
 */

import React, { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** Tam tur süresi — küçük değer = yakın katman (hızlı) */
  driftMs: number;
  opacity: number;
  top: number;
  height: number;
  color: string;
  reduceMotion?: boolean;
};

function CloudLayerInner({ driftMs, opacity, top, height, color, reduceMotion }: Props) {
  const { width } = useWindowDimensions();
  const shift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      shift.value = 0;
      return;
    }
    shift.value = withRepeat(
      withTiming(1, { duration: driftMs, easing: Easing.linear }),
      -1,
      false,
    );
  }, [driftMs, reduceMotion, shift]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: -width + shift.value * width }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.row, { top, height, opacity }, anim]}
    >
      {[0, 1, 2, 3].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.blob,
            {
              width: width * 0.55,
              height,
              borderRadius: height / 2,
              backgroundColor: color,
              marginLeft: i === 0 ? 0 : width * 0.28,
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

export const CloudLayer = memo(CloudLayerInner);

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    width: '300%',
  },
  blob: {},
});
