/**
 * NOX REELS — Image tabanlı premium sembol.
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
import type { SlotQualityMode, SlotSymbolId } from '../tipler/SlotTipleri';
import { SymbolImages } from '../assets/VisualAssets';
import { SYMBOL_DEFS } from '../sabitler/SlotAyarlari';

type Props = {
  id: SlotSymbolId;
  size: number;
  dimmed?: boolean;
  winning?: boolean;
  quality?: SlotQualityMode;
};

function SembolInner({
  id,
  size,
  dimmed = false,
  winning = false,
  quality = 'HIGH',
}: Props) {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0);
  const special = id === 'WILD' || id === 'SCATTER';
  const tint = SYMBOL_DEFS[id].tint;
  const radius = Math.round(size * 0.16);
  const low = quality === 'LOW';

  useEffect(() => {
    if (!winning) {
      pulse.value = withTiming(1, { duration: 100 });
      glow.value = withTiming(0, { duration: 100 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 280, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 280, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 320 }),
        withTiming(0.35, { duration: 320 }),
      ),
      -1,
      true,
    );
  }, [winning, pulse, glow]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: dimmed ? 0.28 : 1,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.55,
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, anim]}>
      {!low && (winning || special) ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              backgroundColor: tint,
            },
            glowStyle,
          ]}
        />
      ) : null}

      <View
        style={[
          styles.frame,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderColor: winning
              ? 'rgba(255,216,107,0.95)'
              : special
                ? `${tint}CC`
                : 'rgba(255,255,255,0.14)',
            borderWidth: winning || special ? 1.5 : 1,
          },
        ]}
      >
        <Image
          source={SymbolImages[id]}
          style={{ width: size, height: size, borderRadius: radius }}
          resizeMode="cover"
          fadeDuration={0}
        />
        {!low ? (
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.22)', 'transparent', 'transparent']}
            style={[styles.shine, { borderRadius: radius }]}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

export const Sembol = memo(SembolInner);

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: 'rgba(8,10,20,0.85)',
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
