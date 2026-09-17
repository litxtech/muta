import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';

type Props = {
  /** Oda kapak / sahne arka plan URL */
  url?: string | null;
};

/**
 * Ses odası tam ekran arka plan — butonların ve koltukların arkasında.
 * Resim yoksa mevcut oda gradient'i.
 */
export function OdaSahneArkaPlan({ url }: Props) {
  const uri = url?.trim() || null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} collapsable={false}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <LinearGradient
          colors={[...RenkTokenlari.gradientRoom]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* Okunabilirlik: kontroller / yazılar net kalsın */}
      <LinearGradient
        colors={
          uri
            ? ['rgba(8,4,14,0.55)', 'rgba(8,4,14,0.42)', 'rgba(8,4,14,0.72)']
            : ['transparent', 'transparent']
        }
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
