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
import { CharacterImages } from '../assets/VisualAssets';
import type { PerformanceProfile, ZeusPhase } from '../tipler/ZeusTipleri';

type Props = {
  phase: ZeusPhase;
  bonusMode?: boolean;
  size?: number;
  performance?: PerformanceProfile;
  reduceMotion?: boolean;
};

function ZeusKarakterInner({
  phase,
  bonusMode = false,
  size = 148,
  performance = 'HIGH',
  reduceMotion = false,
}: Props) {
  const breath = useSharedValue(0);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || performance === 'LOW') {
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [breath, performance, reduceMotion]);

  useEffect(() => {
    if (
      phase === 'FREE_SPIN_TRIGGER' ||
      phase === 'BIG_WIN' ||
      phase === 'RETRIGGER' ||
      phase === 'MULTIPLIER'
    ) {
      flash.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0, { duration: 520 }),
      );
    }
  }, [flash, phase]);

  const pose = useAnimatedStyle(() => ({
    transform: [
      { translateY: -breath.value * 6 },
      { scale: 1 + breath.value * 0.02 + flash.value * 0.04 },
    ],
  }));

  const aura = useAnimatedStyle(() => ({
    opacity: 0.28 + breath.value * 0.25 + flash.value * 0.45,
  }));

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { width: size, height: size * 1.28 }]}
    >
      <Animated.View
        style={[
          styles.aura,
          {
            backgroundColor: bonusMode
              ? 'rgba(77,168,255,0.55)'
              : 'rgba(232,197,71,0.45)',
          },
          aura,
        ]}
      />
      <Animated.View style={pose}>
        <Image
          source={CharacterImages.zeusIdle}
          style={{
            width: size,
            height: size * 1.28,
            backgroundColor: 'transparent',
          }}
          resizeMode="contain"
          fadeDuration={0}
        />
      </Animated.View>
    </View>
  );
}

export const ZeusKarakter = memo(ZeusKarakterInner);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  aura: {
    position: 'absolute',
    bottom: 8,
    width: '78%',
    height: '42%',
    borderRadius: 999,
  },
});
