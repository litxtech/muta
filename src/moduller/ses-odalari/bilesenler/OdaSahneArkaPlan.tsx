import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { OdaTemasiniCoz } from '../../oda-olusturma/katalog/OdaTemaKatalogu';

type Props = {
  /** Özel yüklenen kapak / arka plan URL — varsa temanın üstüne biner */
  url?: string | null;
  /** Modern gradient tema kodu */
  themeCode?: string | null;
};

/**
 * Ses odası tam ekran arka plan.
 * Öncelik: özel resim → seçilen tema gradienti.
 */
export function OdaSahneArkaPlan({ url, themeCode }: Props) {
  const uri = url?.trim() || null;
  const tema = OdaTemasiniCoz(themeCode);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} collapsable={false}>
      <LinearGradient
        colors={[...tema.renkler]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Vurgu leke — temaya derinlik */}
      <LinearGradient
        colors={[`${tema.vurgu}33`, 'transparent', `${tema.vurgu}18`]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {/* Okunabilirlik: kontroller / yazılar net kalsın */}
      <LinearGradient
        colors={
          uri
            ? ['rgba(8,4,14,0.55)', 'rgba(8,4,14,0.42)', 'rgba(8,4,14,0.72)']
            : ['rgba(8,4,14,0.22)', 'rgba(8,4,14,0.12)', 'rgba(8,4,14,0.55)']
        }
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
