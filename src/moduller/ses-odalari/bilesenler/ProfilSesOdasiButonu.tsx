/**
 * Profil ziyareti — kullanıcının aktif ses odasına ihtişamlı giriş butonu.
 */

import React, { useEffect } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { KullaniciAktifOda } from '../okuma/KullaniciAktifOdasiniGetir';

type Props = {
  oda: KullaniciAktifOda;
  onPress: () => void;
};

const GOLD = ['#FFF6C8', '#F0C14A', '#C9891A', '#FFE08A'] as const;
const DEEP = ['#2A1208', '#1A0C18', '#120810'] as const;

export function ProfilSesOdasiButonu({ oda, onPress }: Props) {
  const pulse = useSharedValue(0);
  const shine = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    shine.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 400 }),
        withTiming(0, { duration: 800 }),
      ),
      -1,
      false,
    );
  }, [pulse, shine]);

  const canliStil = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
  }));

  const auraStil = useAnimatedStyle(() => ({
    opacity: 0.3 + pulse.value * 0.25,
  }));

  const shineStil = useAnimatedStyle(() => ({
    opacity: interpolate(shine.value, [0, 0.4, 1], [0, 0.7, 0]),
    transform: [
      { translateX: interpolate(shine.value, [0, 1], [-40, 220]) },
    ],
  }));

  const dinleyici =
    oda.listenerCount > 0
      ? oda.listenerCount > 999
        ? `${(oda.listenerCount / 1000).toFixed(1)}K`
        : String(oda.listenerCount)
      : null;

  const rolEtiket =
    oda.role === 'host'
      ? 'Lider'
      : oda.role === 'cohost'
        ? 'Yardımcı'
        : oda.role === 'speaker'
          ? 'Konuşmacı'
          : 'Dinleyici';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${oda.title} ses odasına git`}
    >
      <Animated.View style={[styles.aura, auraStil]} pointerEvents="none" />

      <LinearGradient
        colors={[...GOLD]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cerceve}
      >
        <LinearGradient
          colors={[...DEEP]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ic}
        >
          {/* Kapak / ikon */}
          <View style={styles.kapakWrap}>
            {oda.coverUrl ? (
              <Image source={{ uri: oda.coverUrl }} style={styles.kapak} />
            ) : (
              <LinearGradient
                colors={[RenkTokenlari.primary, RenkTokenlari.deepPlum]}
                style={styles.kapak}
              >
                <Ionicons name="radio" size={22} color="#FFE08A" />
              </LinearGradient>
            )}
            {oda.isLive ? (
              <View style={styles.canliRozet}>
                <Animated.View style={[styles.canliNokta, canliStil]} />
                <Text style={styles.canliYazi}>CANLI</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metin}>
            <Text style={styles.ustEtiket}>SES ODASINDA</Text>
            <Text style={styles.baslik} numberOfLines={1}>
              {oda.title}
            </Text>
            <View style={styles.metaSatir}>
              <Text style={styles.meta}>{rolEtiket}</Text>
              {dinleyici ? (
                <>
                  <Text style={styles.metaAyir}>·</Text>
                  <Ionicons
                    name="headset-outline"
                    size={11}
                    color="rgba(255,224,138,0.85)"
                  />
                  <Text style={styles.meta}>{dinleyici}</Text>
                </>
              ) : null}
              {oda.roomCode ? (
                <>
                  <Text style={styles.metaAyir}>·</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {oda.roomCode}
                  </Text>
                </>
              ) : null}
            </View>
          </View>

          <LinearGradient
            colors={[...GOLD]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.cta}
          >
            <Ionicons name="enter-outline" size={16} color="#2A1800" />
            <Text style={styles.ctaYazi}>Gir</Text>
          </LinearGradient>

          <Animated.View style={[styles.shineWrap, shineStil]} pointerEvents="none">
            <LinearGradient
              colors={[
                'transparent',
                'rgba(255,255,255,0.35)',
                'transparent',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shine}
            />
          </Animated.View>
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: '100%',
    marginTop: BoslukTokenlari.md,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  aura: {
    ...StyleSheet.absoluteFill,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: 'rgba(240, 180, 41, 0.22)',
  },
  cerceve: {
    borderRadius: YaricapTokenlari.lg,
    padding: 2,
  },
  ic: {
    borderRadius: YaricapTokenlari.lg - 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 138, 0.25)',
  },
  kapakWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 224, 138, 0.55)',
  },
  kapak: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canliRozet: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(12, 8, 16, 0.82)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  canliNokta: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B5C',
  },
  canliYazi: {
    ...TipografiTokenlari.micro,
    color: '#FFE8F0',
    fontWeight: '900',
    fontSize: 8,
    letterSpacing: 0.6,
  },
  metin: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ustEtiket: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255, 224, 138, 0.75)',
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 1.2,
  },
  baslik: {
    ...TipografiTokenlari.body,
    color: '#FFF6D6',
    fontWeight: '800',
    fontSize: 15,
  },
  metaSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meta: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255, 224, 138, 0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  metaAyir: {
    color: 'rgba(255, 224, 138, 0.35)',
    fontSize: 11,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
  },
  ctaYazi: {
    ...TipografiTokenlari.caption,
    color: '#2A1800',
    fontWeight: '900',
    fontSize: 13,
  },
  shineWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
  },
  shine: {
    flex: 1,
    width: 36,
  },
});
