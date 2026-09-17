/**
 * GercekciSembolKabugu — sembol PNG'sini opak bir karo üstünde gösterir.
 * Arka plan karodan sızmaz; simgeler hayali / saydam görünmez.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Performans = 'HIGH' | 'MEDIUM' | 'LOW';

type Props = {
  size: number;
  tint: string;
  performance?: Performans;
  special?: boolean;
  children: React.ReactNode;
};

function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  if (hex.startsWith('#') && (hex.length === 7 || hex.length === 4)) {
    const tam =
      hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;
    return `${tam}${a}`;
  }
  return hex;
}

function GercekciSembolKabuguInner({
  size,
  tint,
  performance = 'HIGH',
  special = false,
  children,
}: Props) {
  const radius = Math.round(size * 0.18);
  const low = performance === 'LOW';
  const high = performance === 'HIGH';

  return (
    <View style={{ width: size, height: size }}>
      {/* Opak zemin — arka planı tamamen keser */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.taban,
          {
            borderRadius: radius,
            backgroundColor: special ? '#1A1408' : '#0B0E18',
          },
        ]}
      />

      <LinearGradient
        pointerEvents="none"
        colors={[
          hexAlpha(tint, special ? 0.42 : 0.28),
          '#12162A',
          '#070A12',
        ]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[
          StyleSheet.absoluteFill,
          styles.karo,
          {
            borderRadius: radius,
            borderColor: special
              ? 'rgba(255,224,138,0.55)'
              : 'rgba(255,255,255,0.2)',
          },
        ]}
      />

      {!low ? (
        <View pointerEvents="none" style={styles.merkez}>
          <View
            style={[
              styles.halka,
              {
                width: size * 0.78,
                height: size * 0.78,
                borderRadius: size,
                backgroundColor: hexAlpha(tint, special ? 0.16 : 0.1),
              },
            ]}
          />
          {high ? (
            <View
              style={[
                styles.halka,
                {
                  width: size * 0.42,
                  height: size * 0.42,
                  borderRadius: size,
                  backgroundColor: hexAlpha(tint, special ? 0.2 : 0.12),
                },
              ]}
            />
          ) : null}
        </View>
      ) : null}

      {!low ? (
        <View
          pointerEvents="none"
          style={[
            styles.zeminGolge,
            {
              width: size * 0.5,
              height: size * 0.07,
              borderRadius: size,
              bottom: size * 0.06,
              left: size * 0.25,
            },
          ]}
        />
      ) : null}

      {!low ? (
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(255,255,255,0.14)',
            'rgba(255,255,255,0.03)',
            'transparent',
          ]}
          locations={[0, 0.4, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[
            styles.sheen,
            {
              height: size * 0.32,
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
              marginHorizontal: 1,
            },
          ]}
        />
      ) : null}

      {/* Sembol — net, karo üstünde */}
      <View style={styles.merkez}>{children}</View>

      {!low ? (
        <>
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.rimIsik,
              { borderRadius: radius, margin: 1 },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.rimGolge,
              { borderRadius: radius, margin: 1 },
            ]}
          />
        </>
      ) : null}
    </View>
  );
}

export const GercekciSembolKabugu = memo(GercekciSembolKabuguInner);

const styles = StyleSheet.create({
  taban: {
    borderWidth: 0,
  },
  karo: {
    borderWidth: 1.5,
  },
  merkez: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halka: {
    position: 'absolute',
  },
  zeminGolge: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.5)',
    transform: [{ scaleX: 1.08 }],
  },
  sheen: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
  },
  rimIsik: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  rimGolge: {
    borderBottomWidth: 1.5,
    borderRightWidth: 1,
    borderColor: 'rgba(0,0,0,0.55)',
  },
});
