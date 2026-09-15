/**
 * Oyun taşı — seçim, temizlenme, spawn animasyonları.
 */

import React, { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { BoardCell } from '../tipler/KristalTipleri';
import {
  SPECIAL_LABELS,
  TILE_COLORS,
  TILE_SHAPE_CODES,
} from '../sabitler/KristalSabitleri';

type Props = {
  cell: BoardCell;
  size: number;
  selected?: boolean;
  clearing?: boolean;
  spawning?: boolean;
};

function OyunTasiInner({
  cell,
  size,
  selected,
  clearing = false,
  spawning = false,
}: Props) {
  const scale = useSharedValue(spawning ? 0.2 : 0.85);
  const opacity = useSharedValue(1);
  const breath = useSharedValue(1);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (spawning) {
      scale.value = 0.15;
      opacity.value = 0;
      scale.value = withSpring(1, { damping: 11, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 160 });
    } else {
      scale.value = withSpring(1, { damping: 14, stiffness: 180 });
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1400 }),
        withTiming(1, { duration: 1400 }),
      ),
      -1,
      false,
    );
  }, [breath, cell.id, opacity, scale, spawning]);

  useEffect(() => {
    if (selected && !clearing) {
      scale.value = withSpring(1.12, { damping: 10 });
    } else if (!clearing) {
      scale.value = withSpring(1, { damping: 12 });
    }
  }, [clearing, scale, selected]);

  useEffect(() => {
    if (clearing) {
      flash.value = withSequence(
        withTiming(1, { duration: 70 }),
        withTiming(0.35, { duration: 90 }),
        withTiming(1, { duration: 70 }),
      );
      scale.value = withTiming(0.15, {
        duration: 200,
        easing: Easing.in(Easing.cubic),
      });
      opacity.value = withTiming(0, { duration: 220 });
    } else {
      flash.value = 0;
      opacity.value = withTiming(1, { duration: 80 });
    }
  }, [clearing, flash, opacity, scale]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      {
        scale:
          scale.value *
          (selected && !clearing ? 1 : breath.value) *
          (1 + flash.value * 0.08),
      },
    ],
  }));

  if (cell.empty) {
    return <View style={[styles.empty, { width: size, height: size }]} />;
  }

  const color = TILE_COLORS[cell.type];
  const shape = TILE_SHAPE_CODES[cell.type];
  const special = cell.special !== 'none' ? SPECIAL_LABELS[cell.special] : null;

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: Math.max(8, size * 0.22),
          backgroundColor: clearing ? color + '88' : color + '33',
          borderColor: clearing
            ? RenkTokenlari.accent
            : selected
              ? RenkTokenlari.accent
              : color + '99',
          borderWidth: selected || clearing ? 2 : 1,
        },
        anim,
      ]}
    >
      <View style={[styles.gem, { backgroundColor: color }]}>
        <Text style={[styles.shape, { fontSize: Math.max(12, size * 0.38) }]}>
          {shape}
        </Text>
      </View>
      {special ? (
        <Text style={styles.special} numberOfLines={1}>
          {special}
        </Text>
      ) : null}
    </Animated.View>
  );
}

export const OyunTasi = memo(OyunTasiInner);

const styles = StyleSheet.create({
  empty: {
    backgroundColor: 'transparent',
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gem: {
    width: '58%',
    height: '58%',
    borderRadius: YaricapTokenlari.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shape: {
    color: RenkTokenlari.bg,
    fontWeight: '800',
  },
  special: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    marginTop: 1,
    fontSize: 8,
  },
});
