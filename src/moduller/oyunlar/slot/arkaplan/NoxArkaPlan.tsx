/**
 * NOX REELS — tam ekran gece atmosferi.
 */

import React, { memo, useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BackgroundImages } from '../assets/VisualAssets';
import type { SlotQualityMode } from '../tipler/SlotTipleri';

type Props = {
  quality?: SlotQualityMode;
  bonus?: boolean;
};

function NoxArkaPlanInner({ quality = 'HIGH', bonus = false }: Props) {
  const pulse = useSharedValue(0);
  const low = quality === 'LOW';

  useEffect(() => {
    if (low) {
      pulse.value = 0.3;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [low, pulse]);

  const veil = useAnimatedStyle(() => ({
    opacity: 0.12 + pulse.value * (bonus ? 0.22 : 0.12),
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={BackgroundImages.nightSky}
        style={styles.bg}
        resizeMode="cover"
        fadeDuration={0}
      />
      <LinearGradient
        colors={[
          'rgba(6,4,18,0.55)',
          'rgba(12,8,28,0.35)',
          'rgba(4,6,14,0.75)',
        ]}
        style={StyleSheet.absoluteFill}
      />
      {!low ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: bonus
                ? 'rgba(232,121,249,0.18)'
                : 'rgba(124,58,237,0.14)',
            },
            veil,
          ]}
        />
      ) : null}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.65)']}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export const NoxArkaPlan = memo(NoxArkaPlanInner);

const styles = StyleSheet.create({
  bg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
});
