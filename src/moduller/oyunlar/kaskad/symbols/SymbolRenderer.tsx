/**
 * Sembol hücresi — Reanimated shared values; memo.
 */

import React, { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  SYMBOL_COLORS,
  SYMBOL_SHAPES,
} from '../sabitler/KaskadSabitleri';
import type { GridCell, PerformanceProfile } from '../tipler/KaskadTipleri';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';

export type SymbolVisualState =
  | 'normal'
  | 'matched'
  | 'destroy'
  | 'landing'
  | 'selected';

type Props = {
  cell: GridCell;
  size: number;
  visualState?: SymbolVisualState;
  dropDistanceCells?: number;
  dropDurationMs?: number;
  performance?: PerformanceProfile;
  onDestroyDone?: () => void;
};

function SymbolRendererInner({
  cell,
  size,
  visualState = 'normal',
  dropDistanceCells = 0,
  dropDurationMs = 220,
  performance = 'HIGH',
}: Props) {
  const translateY = useSharedValue(-(dropDistanceCells * size));
  const scale = useSharedValue(dropDistanceCells > 0 ? 0.92 : 1);
  const opacity = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (dropDistanceCells > 0) {
      translateY.value = -(dropDistanceCells * size);
      translateY.value = withTiming(0, {
        duration: dropDurationMs,
        easing: Easing.out(Easing.cubic),
      });
      scale.value = withSequence(
        withTiming(1.08, { duration: Math.max(80, dropDurationMs * 0.35) }),
        withSpring(1, { damping: 12, stiffness: 220 }),
      );
    }
  }, [cell.instanceId, dropDistanceCells, dropDurationMs, scale, size, translateY]);

  useEffect(() => {
    if (visualState === 'matched') {
      glow.value = withTiming(1, { duration: 160 });
      scale.value = withSequence(
        withTiming(1.15, { duration: 140 }),
        withTiming(1.05, { duration: 100 }),
      );
    } else if (visualState === 'destroy') {
      scale.value = withTiming(0, { duration: 240 });
      opacity.value = withTiming(0, { duration: 240 });
    } else if (visualState === 'landing') {
      scale.value = withSequence(
        withTiming(1.08, { duration: 70 }),
        withSpring(1, { damping: 14 }),
      );
    } else if (visualState === 'selected') {
      scale.value = withSpring(1.1, { damping: 10 });
    } else {
      glow.value = withTiming(0, { duration: 120 });
      opacity.value = 1;
      scale.value = withSpring(1);
    }
  }, [glow, opacity, scale, visualState]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const color = SYMBOL_COLORS[cell.symbolType];
  const shape = SYMBOL_SHAPES[cell.symbolType];
  const radius = Math.max(8, size * 0.22);
  const showGlow = performance !== 'LOW' && (visualState === 'matched' || cell.symbolType === 'multiplierOrb');

  return (
    <Animated.View style={[{ width: size, height: size, padding: 2 }, anim]}>
      <View
        style={[
          styles.cell,
          {
            borderRadius: radius,
            borderColor: color + (visualState === 'matched' ? 'ff' : '88'),
            borderWidth: visualState === 'matched' ? 2 : 1,
            shadowOpacity: showGlow ? 0.55 : 0.2,
            shadowColor: color,
            shadowRadius: showGlow ? 10 : 4,
          },
        ]}
      >
        <LinearGradient
          colors={[color + '55', color + '22', '#00000033']}
          style={[styles.fill, { borderRadius: radius - 1 }]}
        >
          <Text style={[styles.shape, { fontSize: Math.max(14, size * 0.42), color }]}>
            {shape}
          </Text>
          {cell.symbolType === 'multiplierOrb' && cell.multiplierValue ? (
            <Text style={styles.mult}>{cell.multiplierValue}x</Text>
          ) : null}
          {cell.symbolType === 'portalScatter' ? (
            <Text style={styles.portalTag}>PORTAL</Text>
          ) : null}
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

export const SymbolRenderer = memo(
  SymbolRendererInner,
  (a, b) =>
    a.cell.instanceId === b.cell.instanceId &&
    a.cell.symbolType === b.cell.symbolType &&
    a.cell.multiplierValue === b.cell.multiplierValue &&
    a.size === b.size &&
    a.visualState === b.visualState &&
    a.dropDistanceCells === b.dropDistanceCells &&
    a.dropDurationMs === b.dropDurationMs &&
    a.performance === b.performance,
);

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,8,18,0.65)',
    elevation: 3,
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shape: {
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 4,
  },
  mult: {
    position: 'absolute',
    bottom: 4,
    color: '#FFF',
    fontSize: TipografiTokenlari.micro.fontSize,
    fontWeight: '800',
  },
  portalTag: {
    position: 'absolute',
    bottom: 3,
    color: '#E9D5FF',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
