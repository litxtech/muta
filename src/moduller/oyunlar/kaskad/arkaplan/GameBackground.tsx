/**
 * GameBackground — prosedürel fırtına gökyüzü + parallax bulut + kıvılcım.
 */

import React, { memo, useEffect, useMemo } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { PerformanceProfile } from '../tipler/KaskadTipleri';
import { BackgroundImages } from '../assets/VisualAssets';
import { CloudLayer } from './CloudLayer';

type Props = {
  bonusMode: boolean;
  performance: PerformanceProfile;
  reduceMotion?: boolean;
};

function Spark({
  x,
  y,
  size,
  delay,
  color,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 4200 + delay * 0.3, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [delay, t]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.15 + t.value * 0.7,
    transform: [
      { translateY: -t.value * 28 },
      { scale: 0.7 + t.value * 0.5 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spark,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
        },
        style,
      ]}
    />
  );
}

function GameBackgroundInner({ bonusMode, performance, reduceMotion }: Props) {
  const { width, height } = useWindowDimensions();
  const layers = performance === 'LOW' ? 0 : performance === 'MEDIUM' ? 1 : 1;
  const cloudColor = bonusMode
    ? 'rgba(140,90,220,0.1)'
    : 'rgba(140,160,220,0.07)';

  const sparks = useMemo(() => {
    if (performance === 'LOW' || reduceMotion) return [];
    const count = performance === 'MEDIUM' ? 2 : 4;
    const colors = bonusMode
      ? ['#C4B5FD', '#FFE08A', '#6FE3FF']
      : ['#FFE08A', '#6FE3FF', '#FFFFFF'];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: (width * ((i * 37) % 100)) / 100,
      y: (height * ((i * 53) % 70)) / 100,
      size: 2 + (i % 4),
      delay: i * 180,
      color: colors[i % colors.length]!,
    }));
  }, [bonusMode, height, performance, reduceMotion, width]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={BackgroundImages.stormSky}
        style={[StyleSheet.absoluteFill, { width: width, height: height }]}
        resizeMode="cover"
        resizeMethod="resize"
        fadeDuration={0}
      />
      <LinearGradient
        colors={
          bonusMode
            ? (['rgba(28,8,48,0.78)', 'rgba(18,6,32,0.72)', 'rgba(8,4,16,0.88)'] as const)
            : (['rgba(10,14,32,0.72)', 'rgba(8,10,22,0.68)', 'rgba(4,6,14,0.86)'] as const)
        }
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          bonusMode
            ? (['rgba(167,139,250,0.12)', 'transparent', 'rgba(40,10,80,0.4)'] as const)
            : (['rgba(111,227,255,0.06)', 'transparent', 'rgba(8,10,20,0.55)'] as const)
        }
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {layers >= 1 ? (
        <CloudLayer
          driftMs={68000}
          opacity={0.35}
          top={height * 0.08}
          height={48}
          color={cloudColor}
          reduceMotion={reduceMotion}
        />
      ) : null}

      {sparks.map((s) => (
        <Spark key={s.id} {...s} />
      ))}

      <LinearGradient
        colors={['transparent', 'rgba(6,8,16,0.55)', 'rgba(4,6,12,0.96)']}
        style={styles.fog}
      />
    </View>
  );
}

export const GameBackground = memo(GameBackgroundInner);

const styles = StyleSheet.create({
  fog: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
  },
  spark: {
    position: 'absolute',
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
});
