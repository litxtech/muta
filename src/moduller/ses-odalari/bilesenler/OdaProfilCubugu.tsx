/**
 * Ses odası sol üst — ışıltılı altın profil çubuğu (oda sahibi).
 * Tıklanınca profil kartı sheet’i açılır.
 */

import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ProfilAvatarKucuk } from '../../canli-sohbet/bilesenler/ProfilAvatarKucuk';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  level?: number | null;
  /** Alt satır — yoksa seviye / @handle */
  altEtiket?: string | null;
  onPress: () => void;
};

const ALTIN = ['#FFF1B8', '#F0B429', '#C99214', '#E8C547'] as const;

function OdaProfilCubuguInner({
  displayName,
  username,
  avatarUrl,
  level,
  altEtiket,
  onPress,
}: Props) {
  const ad =
    displayName?.trim() || username?.trim() || 'Oda sahibi';
  const handle = username?.trim() ? `@${username.trim()}` : null;
  const seviye = level && level > 0 ? level : null;
  const alt =
    altEtiket?.trim() ||
    (seviye != null
      ? handle
        ? `Sv.${seviye} · ${handle}`
        : `Seviye ${seviye}`
      : handle ?? 'Oda sahibi');

  const isilti = useSharedValue(0);
  useEffect(() => {
    isilti.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [isilti]);

  const parlama = useAnimatedStyle(() => ({
    opacity: 0.25 + isilti.value * 0.55,
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Oda sahibi profili"
      style={styles.hit}
    >
      <LinearGradient
        colors={[...ALTIN]}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cerceve}
      >
        <View style={styles.ic}>
          <Animated.View style={[styles.parlama, parlama]} pointerEvents="none" />
          <View style={styles.avatarRing}>
            <ProfilAvatarKucuk
              size={28}
              displayName={displayName}
              username={username}
              avatarUrl={avatarUrl}
            />
          </View>
          <View style={styles.metin}>
            <Text style={styles.ad} numberOfLines={1}>
              {ad}
            </Text>
            <Text style={styles.alt} numberOfLines={1}>
              {alt}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export const OdaProfilCubugu = memo(OdaProfilCubuguInner);

const styles = StyleSheet.create({
  hit: {
    maxWidth: 168,
    flexShrink: 1,
  },
  cerceve: {
    borderRadius: 22,
    padding: 1.5,
  },
  ic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(28, 18, 6, 0.92)',
    overflow: 'hidden',
  },
  parlama: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255, 224, 138, 0.12)',
  },
  avatarRing: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(240, 180, 41, 0.85)',
    padding: 1,
  },
  metin: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 110,
  },
  ad: {
    ...TipografiTokenlari.caption,
    color: '#FFE08A',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255, 224, 138, 0.72)',
    fontWeight: '600',
    fontSize: 10,
    marginTop: 1,
  },
});
