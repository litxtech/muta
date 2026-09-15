import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';

type CubukProps = {
  maxH: number;
  delayMs: number;
  renk: string;
};

function SesCubugu({ maxH, delayMs, renk }: CubukProps) {
  const h = useSharedValue(0.35);

  useEffect(() => {
    h.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: 280 + delayMs * 0.15,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0.28, {
            duration: 320 + delayMs * 0.12,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0.72, {
            duration: 240,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0.4, {
            duration: 260,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, h]);

  const stil = useAnimatedStyle(() => ({
    height: Math.max(3, h.value * maxH),
    opacity: 0.55 + h.value * 0.45,
  }));

  return (
    <Animated.View
      style={[
        styles.cubuk,
        { backgroundColor: renk, maxHeight: maxH },
        stil,
      ]}
    />
  );
}

type Props = {
  yukseklik?: number;
  renk?: string;
};

/** Mini equalizer — canlı ses odası imzası */
export function AnaSayfaSesCubuklari({
  yukseklik = 12,
  renk = RenkTokenlari.primarySoft,
}: Props) {
  return (
    <View style={[styles.wrap, { height: yukseklik }]}>
      {[0, 70, 140, 40, 110].map((d, i) => (
        <SesCubugu key={i} maxH={yukseklik} delayMs={d} renk={renk} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  cubuk: {
    width: 2.5,
    borderRadius: 2,
  },
});
