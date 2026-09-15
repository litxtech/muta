import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { BannerAction } from '../core/BannerTypes';

type Props = {
  actions: BannerAction[];
  onPress: (action: BannerAction) => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BannerCTA({ actions, onPress }: Props) {
  const visible = actions
    .filter((a) => a.action_type !== 'NONE' && (a.button_text || a.action_type))
    .slice(0, 2);

  if (visible.length === 0) return null;

  return (
    <View style={styles.row}>
      {visible.map((action, idx) => (
        <CtaButton
          key={action.id ?? `${action.slot}-${idx}`}
          label={action.button_text || action.action_type}
          primary={idx === 0}
          onPress={() => onPress(action)}
        />
      ))}
    </View>
  );
}

function CtaButton({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handle = useCallback(() => {
    scale.value = withSequence(
      withTiming(0.97, { duration: 70 }),
      withTiming(1, { duration: 120 }),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onPress();
  }, [onPress, scale]);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={handle}
      style={[styles.btn, primary ? styles.primary : styles.secondary, anim]}
    >
      <Text style={[styles.label, primary ? styles.labelPrimary : styles.labelSecondary]} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.md,
  },
  btn: {
    flexGrow: 1,
    flexBasis: 0,
    paddingVertical: 10,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: 14,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: RenkTokenlari.primary,
  },
  secondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  label: {
    ...TipografiTokenlari.caption,
    fontWeight: '700',
  },
  labelPrimary: {
    color: '#fff',
  },
  labelSecondary: {
    color: RenkTokenlari.text,
  },
});
