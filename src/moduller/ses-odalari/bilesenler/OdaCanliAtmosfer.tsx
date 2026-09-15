import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';

type Props = {
  yogunluk?: 'hafif' | 'normal';
};

function Nokta({
  left,
  top,
  size,
  delay,
  color,
}: {
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  delay: number;
  color: string;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2800 + delay, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [delay, t]);

  const stil = useAnimatedStyle(() => ({
    opacity: 0.15 + t.value * 0.45,
    transform: [
      { translateY: -8 * t.value },
      { scale: 0.85 + t.value * 0.35 },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.nokta,
        {
          left,
          top,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        stil,
      ]}
    />
  );
}

/** Sesli oda sahnesi — canlı atmosfer (hafif parçacıklar) */
export function OdaCanliAtmosfer({ yogunluk = 'normal' }: Props) {
  const noktalar = useMemo(() => {
    const n = yogunluk === 'hafif' ? 6 : 10;
    const renkler = [
      RenkTokenlari.primary,
      RenkTokenlari.accent,
      RenkTokenlari.mint,
      RenkTokenlari.violet,
    ];
    return Array.from({ length: n }, (_, i) => ({
      key: `a_${i}`,
      left: `${8 + ((i * 17) % 84)}%` as `${number}%`,
      top: `${10 + ((i * 23) % 70)}%` as `${number}%`,
      size: 3 + (i % 4),
      delay: i * 180,
      color: renkler[i % renkler.length],
    }));
  }, [yogunluk]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);

  const aura = useAnimatedStyle(() => ({
    opacity: 0.08 + pulse.value * 0.1,
    transform: [{ scale: 0.95 + pulse.value * 0.08 }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.aura, aura]} />
      {noktalar.map(({ key, ...n }) => (
        <Nokta key={key} {...n} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  aura: {
    position: 'absolute',
    alignSelf: 'center',
    top: '18%',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: RenkTokenlari.primary,
  },
  nokta: {
    position: 'absolute',
  },
});
