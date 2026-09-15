import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';

function Nokta({ delayMs }: { delayMs: number }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    y.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(-14, {
            duration: 420,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(0, {
            duration: 420,
            easing: Easing.in(Easing.cubic),
          }),
        ),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420 }),
          withTiming(0.4, { duration: 420 }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, opacity, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

type Props = {
  altYazi?: string;
};

/** Marka açılış — animasyonlu noktalar (logo yok) */
export function AcilisEkrani({ altYazi = 'Yükleniyor' }: Props) {
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [fade]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
  }));

  return (
    <View style={styles.kok}>
      <LinearGradient
        colors={['#12081C', '#0B0614', '#08040F']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glow} />
      <Animated.View style={[styles.content, contentStyle]}>
        <Text style={styles.marka}>Tamuso</Text>
        <View style={styles.dots}>
          <Nokta delayMs={0} />
          <Nokta delayMs={140} />
          <Nokta delayMs={280} />
        </View>
        <Text style={styles.alt}>{altYazi}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  kok: {
    flex: 1,
    backgroundColor: '#0B0614',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(232,64,145,0.12)',
  },
  content: {
    alignItems: 'center',
  },
  marka: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 28,
    height: 32,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: RenkTokenlari.primarySoft,
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginTop: 16,
    letterSpacing: 0.6,
  },
});
