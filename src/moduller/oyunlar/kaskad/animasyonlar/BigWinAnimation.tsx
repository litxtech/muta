/**
 * Büyük kazanç overlay + sayı count-up.
 */

import React, { memo, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { WIN_COUNT_MS, WIN_TIER_LABELS } from '../sabitler/KaskadSabitleri';
import type { WinTier } from '../tipler/KaskadTipleri';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  visible: boolean;
  tier: WinTier;
  amount: number;
  onDone: () => void;
};

function durationForTier(tier: WinTier): number {
  if (tier === 'SUPERNOVA' || tier === 'GALACTIC') return WIN_COUNT_MS.epic;
  if (tier === 'COSMIC') return WIN_COUNT_MS.big;
  return WIN_COUNT_MS.normal;
}

function BigWinAnimationInner({ visible, tier, amount, onDone }: Props) {
  const scale = useSharedValue(0.6);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!visible || tier === 'NONE') return;
    scale.value = withSequence(
      withSpring(1.12, { damping: 8 }),
      withTiming(1, { duration: 200 }),
    );
    const dur = durationForTier(tier);
    const start = Date.now();
    const iv = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.floor(amount * eased));
      if (t >= 1) {
        clearInterval(iv);
        setTimeout(onDone, 400);
      }
    }, 32);
    return () => clearInterval(iv);
  }, [amount, onDone, scale, tier, visible]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!visible || tier === 'NONE') return null;

  return (
    <Modal transparent visible animationType="fade">
      <View style={styles.backdrop}>
        <Animated.View style={anim}>
          <LinearGradient
            colors={['#3B1F4A', '#E84091', '#F0B429']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <Text style={styles.tier}>{WIN_TIER_LABELS[tier]}</Text>
            <Text style={styles.amount}>{shown}</Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

export const BigWinAnimation = memo(BigWinAnimationInner);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    minWidth: 260,
    paddingVertical: 28,
    paddingHorizontal: 36,
    borderRadius: 24,
    alignItems: 'center',
  },
  tier: {
    color: '#fff',
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '900',
    letterSpacing: 2,
  },
  amount: {
    marginTop: 8,
    color: RenkTokenlari.accent,
    fontSize: 42,
    fontWeight: '900',
  },
});
