import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari, YaricapTokenlari } from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { comboLabel } from '../motor/ComboMotoru';

type Props = {
  combo: number;
};

export function ComboGostergesi({ combo }: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (combo < 2) {
      opacity.value = withTiming(0, { duration: 120 });
      return;
    }
    opacity.value = withTiming(1, { duration: 80 });
    scale.value = withSequence(
      withSpring(1.28, { damping: 8 }),
      withSpring(1, { damping: 12 }),
    );
  }, [combo, opacity, scale]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (combo < 2) return null;

  return (
    <Animated.View style={[styles.box, anim]}>
      <Text style={styles.label}>{comboLabel(combo)}</Text>
      <Text style={styles.value}>×{combo}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: RenkTokenlari.deepPlum,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.magenta,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.sm,
    alignItems: 'center',
  },
  label: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
  },
  value: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.accent,
  },
});
