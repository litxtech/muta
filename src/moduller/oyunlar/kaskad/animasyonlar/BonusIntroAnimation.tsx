/**
 * Bonus intro sinematik — kısa portal patlaması.
 */

import React, { memo, useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { BonusAward } from '../tipler/KaskadTipleri';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  visible: boolean;
  bonus: BonusAward | null;
  onDone: () => void;
};

function BonusIntroAnimationInner({ visible, bonus, onDone }: Props) {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible || !bonus) return;
    opacity.value = withTiming(1, { duration: 220 });
    scale.value = withSequence(
      withTiming(1.2, { duration: 380 }),
      withTiming(1, { duration: 200 }),
    );
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [bonus, onDone, opacity, scale, visible]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible || !bonus) return null;

  return (
    <Modal transparent visible animationType="fade">
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, anim]}>
          <Text style={styles.portal}>◉</Text>
          <Text style={styles.title}>BONUS AÇILDI</Text>
          <Text style={styles.spins}>{bonus.freeSpins} ÜCRETSİZ SPİN</Text>
          <Text style={styles.meta}>{bonus.scatterCount} Portal</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

export const BonusIntroAnimation = memo(BonusIntroAnimationInner);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,4,18,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { alignItems: 'center', padding: 24 },
  portal: { fontSize: 64, color: RenkTokenlari.violet },
  title: {
    marginTop: 12,
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h1.fontSize,
    fontWeight: '900',
    letterSpacing: 2,
  },
  spins: {
    marginTop: 8,
    color: RenkTokenlari.accent,
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '800',
  },
  meta: {
    marginTop: 6,
    color: RenkTokenlari.textMuted,
    fontSize: TipografiTokenlari.caption.fontSize,
  },
});
