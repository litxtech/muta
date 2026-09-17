/**
 * SeviyeGirisAnimasyonu — odaya giriş overlay (sv. 10+).
 */

import React, { useEffect, useMemo } from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  SEVIYE_GIRIS_RENKLERI,
  SeviyeGirisEtiketi,
  SeviyeGirisSuresiMs,
  type SeviyeGirisKademe,
} from '../animasyon/SeviyeGirisKatalogu';

type Props = {
  gorunur: boolean;
  ad: string;
  level: number;
  kademe: SeviyeGirisKademe;
  avatarUrl?: string | null;
  onBitti?: () => void;
};

const { width: W } = Dimensions.get('window');
const AVATAR = Math.min(96, W * 0.26);

export function SeviyeGirisAnimasyonu({
  gorunur,
  ad,
  level,
  kademe,
  avatarUrl,
  onBitti,
}: Props) {
  const progress = useSharedValue(0);
  const renkler = SEVIYE_GIRIS_RENKLERI[kademe];
  const sure = SeviyeGirisSuresiMs(kademe);

  useEffect(() => {
    if (!gorunur) {
      progress.value = 0;
      return;
    }
    const bitir = () => onBitti?.();
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: sure, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(bitir)();
      },
    );
    void Haptics.impactAsync(
      kademe === 'efsane' || kademe === 'altin'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium,
    );
  }, [gorunur, ad, level, kademe, sure, progress, onBitti]);

  const sahneStil = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.08, 0.78, 1],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const kartStil = useAnimatedStyle(() => {
    const ty = interpolate(
      progress.value,
      [0.05, 0.18, 0.8, 1],
      [-40, 0, 0, -24],
      Extrapolation.CLAMP,
    );
    const s = interpolate(
      progress.value,
      [0.05, 0.2, 0.85, 1],
      [0.86, 1, 1, 0.94],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateY: ty }, { scale: s }] };
  });

  const auraStil = useAnimatedStyle(() => {
    const s = interpolate(
      progress.value,
      [0.1, 0.35, 0.7],
      [0.7, 1.25, 1.05],
      Extrapolation.CLAMP,
    );
    const o = interpolate(
      progress.value,
      [0.1, 0.25, 0.75, 0.95],
      [0, 0.9, 0.55, 0],
      Extrapolation.CLAMP,
    );
    return { opacity: o, transform: [{ scale: s }] };
  });

  const harf = useMemo(
    () => (ad || '?').charAt(0).toLocaleUpperCase('tr-TR'),
    [ad],
  );

  if (!gorunur) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View style={[styles.wrap, sahneStil]}>
        <Animated.View style={[styles.kart, kartStil]}>
          <LinearGradient
            colors={[...renkler]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cerceve}
          >
            <View style={styles.ic}>
              <Animated.View style={[styles.aura, auraStil]} />
              <View style={styles.avatarWrap}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <LinearGradient
                    colors={[renkler[0], renkler[2]]}
                    style={styles.avatar}
                  >
                    <Text style={styles.harf}>{harf}</Text>
                  </LinearGradient>
                )}
              </View>
              <View style={styles.metin}>
                <View style={styles.badge}>
                  <Ionicons name="sparkles" size={11} color="#1A1224" />
                  <Text style={styles.badgeYazi}>
                    {SeviyeGirisEtiketi(kademe)}
                  </Text>
                </View>
                <Text style={styles.ad} numberOfLines={1}>
                  {ad}
                </Text>
                <Text style={styles.alt}>Seviye {level} · odaya katıldı</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 38,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 88,
  },
  wrap: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  kart: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    overflow: 'hidden',
  },
  cerceve: {
    padding: 2,
    borderRadius: 22,
  },
  ic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(14,10,20,0.94)',
    overflow: 'hidden',
  },
  aura: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    left: -10,
    backgroundColor: 'rgba(240,180,41,0.18)',
  },
  avatarWrap: {
    width: AVATAR * 0.72,
    height: AVATAR * 0.72,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  harf: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
  },
  metin: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,224,138,0.92)',
  },
  badgeYazi: {
    ...TipografiTokenlari.micro,
    color: '#1A1224',
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  ad: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '900',
    fontSize: 16,
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
});
