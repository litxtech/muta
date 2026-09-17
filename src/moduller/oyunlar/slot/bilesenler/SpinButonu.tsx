/**
 * NOX REELS — gerçek art spin butonu.
 */

import React, { memo, useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SlotPhase } from '../tipler/SlotTipleri';
import { UiImages } from '../assets/VisualAssets';

type Props = {
  phase: SlotPhase;
  onPress: () => void;
  size?: number;
};

function SpinButonuInner({ phase, onPress, size = 108 }: Props) {
  const scale = useSharedValue(1);
  const ring = useSharedValue(0);
  const ready = phase === 'IDLE';
  const busy =
    phase === 'REQUESTING' ||
    phase === 'SPINNING' ||
    phase === 'STOPPING' ||
    phase === 'EVALUATING' ||
    phase === 'WIN_ANIMATION' ||
    phase === 'BIG_WIN' ||
    phase === 'BONUS_INTRO' ||
    phase === 'RECOVERING';

  useEffect(() => {
    if (busy) {
      ring.value = withRepeat(
        withTiming(360, { duration: 1400, easing: Easing.linear }),
        -1,
        false,
      );
    } else if (ready) {
      ring.value = withRepeat(
        withTiming(360, { duration: 6000, easing: Easing.linear }),
        -1,
        false,
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 900 }),
          withTiming(1, { duration: 900 }),
        ),
        -1,
        true,
      );
    } else {
      ring.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(1, { duration: 120 });
    }
  }, [busy, ready, ring, scale]);

  const wrap = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring.value}deg` }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, wrap]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            width: size * 1.16,
            height: size * 1.16,
            borderRadius: size,
            marginLeft: -size * 0.08,
            marginTop: -size * 0.08,
          },
          ringStyle,
        ]}
      />
      <Pressable
        disabled={!ready}
        onPressIn={() => {
          scale.value = withTiming(0.92, { duration: 70 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 110 });
        }}
        onPress={onPress}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: 'rgba(255,216,107,0.85)',
        }}
      >
        <Image
          source={UiImages.spinButton}
          style={{
            width: size,
            height: size,
            opacity: ready ? 1 : 0.45,
          }}
          resizeMode="cover"
          fadeDuration={0}
        />
        {!ready && busy ? (
          <View style={styles.overlay}>
            <Text style={styles.busy}>…</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export const SpinButonu = memo(SpinButonuInner);

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,216,107,0.4)',
    borderTopColor: 'rgba(255,216,107,0.95)',
    borderRightColor: 'transparent',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  busy: { color: '#FFE08A', fontSize: 28, fontWeight: '900' },
});
