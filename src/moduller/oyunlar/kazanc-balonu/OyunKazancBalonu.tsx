import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { OyunKazancDuyurusu } from './OyunKazancDuyuruTipleri';

type Props = {
  duyuru: OyunKazancDuyurusu;
  onPress: () => void;
  onDismiss: () => void;
};

const GOSTERIM_MS = 5200;

export function OyunKazancBalonu({ duyuru, onPress, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const y = useSharedValue(-120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    y.value = withSpring(0, { damping: 16, stiffness: 180 });
    opacity.value = withTiming(1, { duration: 220 });
    const t = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 280 });
      y.value = withTiming(-100, { duration: 280 }, (done) => {
        if (done) runOnJS(onDismiss)();
      });
    }, GOSTERIM_MS);
    return () => clearTimeout(t);
  }, [duyuru.id, onDismiss, opacity, y]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
  }));

  const coin = duyuru.win_amount.toLocaleString('tr-TR');

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { top: Math.max(insets.top, 8) + 4 }]}
    >
      <Animated.View style={anim}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.balon, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${duyuru.display_name} ${duyuru.game_title} ${coin} coin kazandı`}
        >
          <View style={styles.dot} />
          <View style={styles.copy}>
            <Text style={styles.baslik} numberOfLines={1}>
              {duyuru.display_name}{' '}
              <Text style={styles.oyun}>({duyuru.game_title})</Text>
            </Text>
            <Text style={styles.alt} numberOfLines={1}>
              {coin} coin kazandı · Oyuna git
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: BoslukTokenlari.lg,
    right: BoslukTokenlari.lg,
    zIndex: 120,
    elevation: 120,
  },
  balon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: 'rgba(18, 12, 28, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 107, 0.35)',
  },
  pressed: { opacity: 0.9 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RenkTokenlari.accent,
  },
  copy: { flex: 1, gap: 2 },
  baslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  oyun: {
    color: RenkTokenlari.accent,
    fontWeight: '600',
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
});
