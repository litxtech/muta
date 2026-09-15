import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari, YaricapTokenlari } from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  remainingSeconds: number;
};

function format(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function SureGostergesi({ remainingSeconds }: Props) {
  const pulse = useSharedValue(1);
  const critical = remainingSeconds <= 10 && remainingSeconds > 0;

  useEffect(() => {
    if (critical) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 350 }),
          withTiming(1, { duration: 350 }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(1, { duration: 150 });
    }
  }, [critical, pulse]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.box,
        critical && styles.critical,
        animStyle,
      ]}
    >
      <Animated.Text style={[styles.value, critical && styles.criticalText]}>
        {format(remainingSeconds)}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: RenkTokenlari.bgCard,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.sm,
    minWidth: 84,
    alignItems: 'center',
  },
  critical: {
    borderColor: RenkTokenlari.danger,
    backgroundColor: 'rgba(232, 75, 106, 0.18)',
  },
  value: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontVariant: ['tabular-nums'],
  },
  criticalText: {
    color: RenkTokenlari.danger,
  },
});
