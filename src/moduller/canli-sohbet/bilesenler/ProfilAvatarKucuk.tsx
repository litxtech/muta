import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';

type Props = {
  size?: number;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
};

/** Kucuk profil avatarı — sohbet / oda / canli ortak */
export function ProfilAvatarKucuk({
  size = 32,
  displayName,
  username,
  avatarUrl,
}: Props) {
  const ad = (displayName?.trim() || username?.trim() || '?').charAt(0);
  const harf = ad.toLocaleUpperCase('tr-TR');

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <LinearGradient
      colors={[RenkTokenlari.primary, RenkTokenlari.deepPlum]}
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.harf, { fontSize: size * 0.38 }]}>{harf}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  harf: {
    fontWeight: '800',
    color: '#fff',
  },
});
