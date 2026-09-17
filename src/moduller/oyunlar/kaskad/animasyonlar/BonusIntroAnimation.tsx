/**
 * Bonus intro sinematik — "PORTAL AÇILDI" + free spin sayısı.
 * Portal büyür, enerji girdabı döner, karakter BONUS_TRIGGER state'ine geçer.
 */

import React, { memo, useEffect } from 'react';
import { Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { BonusAward, PerformanceProfile } from '../tipler/KaskadTipleri';
import { ParticleBurst } from './ParticleController';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';

const INTRO_MS = 2400;

type Props = {
  visible: boolean;
  bonus: BonusAward | null;
  performance?: PerformanceProfile;
  onDone: () => void;
};

function BonusIntroAnimationInner({
  visible,
  bonus,
  performance = 'HIGH',
  onDone,
}: Props) {
  const scale = useSharedValue(0.3);
  const spin = useSharedValue(0);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!visible || !bonus) return;
    scale.value = 0.3;
    scale.value = withSequence(
      withTiming(1.25, { duration: 520, easing: Easing.out(Easing.back(1.4)) }),
      withTiming(1, { duration: 260 }),
    );
    spin.value = withRepeat(
      withTiming(360, { duration: 2600, easing: Easing.linear }),
      -1,
      false,
    );
    const t = setTimeout(onDone, INTRO_MS);
    return () => clearTimeout(t);
  }, [bonus, onDone, scale, spin, visible]);

  const portalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${spin.value}deg` }],
  }));

  if (!visible || !bonus) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <ParticleBurst
          preset="SCATTER_PORTAL"
          performance={performance}
          x={width / 2}
          y={height * 0.36}
        />
        <Animated.View style={[styles.portalRing, portalStyle]}>
          <View style={styles.portalInner} />
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(360)} style={styles.title}>
          PORTAL AÇILDI
        </Animated.Text>
        <Animated.Text entering={FadeIn.delay(560)} style={styles.spins}>
          {bonus.freeSpins} FREE SPIN
        </Animated.Text>
        <Animated.Text entering={FadeIn.delay(720)} style={styles.meta}>
          {bonus.scatterCount} Portal Sembolü
        </Animated.Text>
      </View>
    </Modal>
  );
}

export const BonusIntroAnimation = memo(BonusIntroAnimationInner);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,4,18,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 5,
    borderColor: RenkTokenlari.violet,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(139,92,246,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(196,181,253,0.7)',
  },
  title: {
    marginTop: 24,
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h1.fontSize,
    fontWeight: '900',
    letterSpacing: 3,
  },
  spins: {
    marginTop: 10,
    color: RenkTokenlari.accent,
    fontSize: 30,
    fontWeight: '900',
  },
  meta: {
    marginTop: 8,
    color: RenkTokenlari.textMuted,
    fontSize: TipografiTokenlari.caption.fontSize,
  },
});
