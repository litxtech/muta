import React, { memo, useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BackgroundImages } from '../assets/VisualAssets';
import { ZEUS_PALETTE } from '../config/ZeusSabitleri';
import type { PerformanceProfile, ZeusPhase } from '../tipler/ZeusTipleri';

type Props = {
  bonusMode: boolean;
  performance: PerformanceProfile;
  reduceMotion?: boolean;
  phase?: ZeusPhase;
};

function ZeusArkaPlanInner({
  bonusMode,
  performance,
  reduceMotion = false,
  phase = 'READY',
}: Props) {
  const pulse = useSharedValue(0);
  const stormFlash = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || performance === 'LOW') {
      pulse.value = 0.35;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [performance, pulse, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || performance === 'LOW') return;
    if (
      phase === 'EXPLOSION' ||
      phase === 'MULTIPLIER' ||
      phase === 'BIG_WIN' ||
      phase === 'FREE_SPIN_TRIGGER'
    ) {
      stormFlash.value = 0;
      stormFlash.value = withSequence(
        withTiming(0.92, { duration: 45 }),
        withTiming(0.12, { duration: 90 }),
        withDelay(
          55,
          withSequence(
            withTiming(0.68, { duration: 35 }),
            withTiming(0, { duration: 260 }),
          ),
        ),
      );
    }
  }, [performance, phase, reduceMotion, stormFlash]);

  const veil = useAnimatedStyle(() => ({
    opacity: 0.08 + pulse.value * (bonusMode ? 0.14 : 0.08),
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: stormFlash.value,
  }));
  const boltStyle = useAnimatedStyle(() => ({
    opacity: stormFlash.value * 0.95,
    transform: [
      { translateY: (1 - stormFlash.value) * -18 },
      { scaleY: 0.8 + stormFlash.value * 0.2 },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={BackgroundImages.olympusSky}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        fadeDuration={0}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: bonusMode
              ? 'rgba(12, 4, 28, 0.72)'
              : 'rgba(4, 6, 14, 0.68)',
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: bonusMode
              ? ZEUS_PALETTE.electricBlue
              : ZEUS_PALETTE.gold,
          },
          veil,
        ]}
      />
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.skyFlash, flashStyle]}
      />
      <Animated.View style={[styles.bolt, styles.boltLeft, boltStyle]}>
        <View style={[styles.boltSegment, styles.boltA]} />
        <View style={[styles.boltSegment, styles.boltB]} />
        <View style={[styles.boltSegment, styles.boltC]} />
      </Animated.View>
      <Animated.View style={[styles.bolt, styles.boltRight, boltStyle]}>
        <View style={[styles.boltSegment, styles.boltA]} />
        <View style={[styles.boltSegment, styles.boltB]} />
        <View style={[styles.boltSegment, styles.boltC]} />
      </Animated.View>
    </View>
  );
}

export const ZeusArkaPlan = memo(ZeusArkaPlanInner);

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: -40,
    left: '18%',
    right: '18%',
    height: 220,
    borderRadius: 160,
    opacity: 0.2,
  },
  skyFlash: {
    backgroundColor: 'rgba(186, 224, 255, 0.55)',
  },
  bolt: {
    position: 'absolute',
    top: 70,
    width: 38,
    height: 190,
  },
  boltLeft: {
    left: '7%',
    transform: [{ rotate: '-9deg' }],
  },
  boltRight: {
    right: '8%',
    transform: [{ rotate: '12deg' }, { scaleX: -0.82 }],
  },
  boltSegment: {
    position: 'absolute',
    width: 5,
    borderRadius: 4,
    backgroundColor: '#EAF8FF',
    shadowColor: '#4DA8FF',
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  boltA: {
    top: 0,
    left: 19,
    height: 68,
    transform: [{ rotate: '17deg' }],
  },
  boltB: {
    top: 59,
    left: 10,
    height: 67,
    transform: [{ rotate: '-18deg' }],
  },
  boltC: {
    top: 116,
    left: 20,
    height: 75,
    transform: [{ rotate: '20deg' }],
  },
});
