import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  /** 3,2,1 veya 0 = CANLI; -1 = bağlanıyor */
  sayi: number;
  visible: boolean;
  mesaj?: string | null;
};

/** Kamera arka planda kalır — hafif UI-thread countdown */
export function CanliGeriSayimKatmani({ sayi, visible, mesaj }: Props) {
  const { t } = useCeviri();
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    scale.value = 0.8;
    opacity.value = 0;
    scale.value = withSequence(
      withTiming(1.08, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(1, { duration: 380 }),
      withTiming(sayi > 0 ? 0 : 1, { duration: 160 }),
    );
  }, [sayi, visible, scale, opacity]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const etiket =
    sayi > 0
      ? String(sayi)
      : sayi === 0
        ? t('canliYayin.canliNokta')
        : mesaj?.trim() || t('canliYayin.baglaniyor');

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.Text
        style={[
          styles.sayi,
          sayi <= 0 && styles.canli,
          sayi < 0 && styles.baglaniyor,
          anim,
        ]}
      >
        {etiket}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  sayi: {
    fontSize: 96,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -2,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  canli: {
    fontSize: 42,
    letterSpacing: 2,
    color: RenkTokenlari.primarySoft,
  },
  baglaniyor: {
    fontSize: 22,
    letterSpacing: 0.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
  },
});
