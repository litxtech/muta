/**
 * Zeus ön yükleme — hücre boyutunda GPU warm (1×1 kutuda decode yetmez).
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { GAME_DISPLAY_NAME, GAME_SUBTITLE } from '../config/ZeusSabitleri';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import { CharacterImages, SymbolImages, UiImages } from '../assets/VisualAssets';
import { zeusVisualsCached } from '../assets/preloadZeusAssets';

type Props = {
  progress: number;
  onImagesWarmed?: () => void;
};

const AVATAR = 112;
const WARM_SIZE = 72;
const WARM_TIMEOUT_MS = 520;
const SYMBOL_SOURCES = Object.values(SymbolImages);

function ZeusOnYuklemeInner({ progress, onImagesWarmed }: Props) {
  const pulse = useSharedValue(0.96);
  const pending = useRef(SYMBOL_SOURCES.length + 2);
  const notified = useRef(false);
  const onWarmedRef = useRef(onImagesWarmed);
  onWarmedRef.current = onImagesWarmed;

  const notify = useCallback(() => {
    if (notified.current) return;
    notified.current = true;
    onWarmedRef.current?.();
  }, []);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.96, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [pulse]);

  useEffect(() => {
    if (zeusVisualsCached()) notify();
    const t = setTimeout(notify, WARM_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [notify]);

  const onWarmLoad = useCallback(() => {
    pending.current -= 1;
    if (pending.current <= 0) notify();
  }, [notify]);

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const pct = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#070B18', '#2A1258', '#070B18']}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.avatarWrap, avatarStyle]}>
        <Image
          source={CharacterImages.zeusIdle}
          style={styles.avatarImg}
          resizeMode="contain"
          resizeMethod="resize"
          fadeDuration={0}
          onLoad={onWarmLoad}
        />
      </Animated.View>
      <Text style={styles.logo}>{GAME_DISPLAY_NAME}</Text>
      <Text style={styles.subtitle}>{GAME_SUBTITLE.toUpperCase()}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.pct}>{pct}%</Text>
      <View style={styles.warm} pointerEvents="none" collapsable={false}>
        {SYMBOL_SOURCES.map((src, i) => (
          <Image
            key={i}
            source={src}
            style={styles.warmImg}
            resizeMode="contain"
            resizeMethod="resize"
            fadeDuration={0}
            onLoad={onWarmLoad}
          />
        ))}
        <Image
          source={UiImages.spinButton}
          style={styles.warmImg}
          resizeMode="contain"
          resizeMethod="resize"
          fadeDuration={0}
          onLoad={onWarmLoad}
        />
      </View>
    </View>
  );
}

export const ZeusOnYukleme = memo(ZeusOnYuklemeInner);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  avatarWrap: { width: AVATAR, height: AVATAR * 1.25 },
  avatarImg: { width: AVATAR, height: AVATAR * 1.25 },
  logo: {
    color: '#F6E27A',
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: 4,
  },
  subtitle: {
    color: 'rgba(232,197,71,0.75)',
    fontSize: TipografiTokenlari.caption.fontSize,
    letterSpacing: 2,
    fontWeight: '700',
  },
  barTrack: {
    width: 180,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: 8,
  },
  barFill: {
    height: 6,
    backgroundColor: '#E8C547',
  },
  pct: {
    color: '#E8E0D4',
    fontWeight: '700',
    fontSize: 12,
  },
  warm: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0.01,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: WARM_SIZE * 4,
  },
  warmImg: { width: WARM_SIZE, height: WARM_SIZE },
});
