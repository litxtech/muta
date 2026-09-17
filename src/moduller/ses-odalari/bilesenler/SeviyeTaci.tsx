import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  /** false ise nabız kapalı; varsayılan: seviye 10+ nabız */
  animasyonluMu?: boolean;
};

function tacRenkleri(level: number): readonly [string, string] {
  if (level >= 50) return ['#F0B429', '#FF8C42'];
  if (level >= 20) return ['#E8D48B', '#C9A227'];
  if (level >= 10) return ['#C0C8D8', '#8A94A8'];
  return ['#D4A574', '#A67C52'];
}

/** Avatar üstü seviye tacı — seviye 1+ görünür; 10+ nabız animasyonu */
export function SeviyeTaci({
  level,
  size = 'sm',
  animasyonluMu,
}: Props) {
  const gecerli = !!level && level >= 1;
  const nabizAcik = gecerli && animasyonluMu !== false && level >= 10;
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!nabizAcik) {
      pulse.value = 0;
      return;
    }
    const hizli = level >= 50 ? 520 : level >= 20 ? 700 : 900;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: hizli, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: hizli, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [nabizAcik, level, pulse]);

  const animStil = useAnimatedStyle(() => {
    if (!nabizAcik) return {};
    const s = 1 + pulse.value * (level >= 50 ? 0.12 : 0.08);
    return {
      transform: [{ scale: s }],
      opacity: 0.88 + pulse.value * 0.12,
    };
  });

  if (!gecerli) return null;

  const olcek = size === 'lg' ? 1.35 : size === 'md' ? 1.15 : 1;
  const genislik = Math.round(30 * olcek);
  const ikon = Math.round(9 * olcek);

  return (
    <Animated.View
      style={[
        styles.wrap,
        { width: genislik, height: Math.round(18 * olcek) },
        animStil,
      ]}
    >
      <LinearGradient
        colors={tacRenkleri(level)}
        style={[styles.tac, { borderRadius: Math.round(8 * olcek) }]}
      >
        <Ionicons name="star" size={ikon} color="#1A1224" />
        <Text style={[styles.seviye, { fontSize: Math.round(8 * olcek) }]}>
          {level}
        </Text>
      </LinearGradient>
      {nabizAcik ? (
        <View
          pointerEvents="none"
          style={[
            styles.aura,
            {
              borderRadius: Math.round(10 * olcek),
              borderColor:
                level >= 50
                  ? 'rgba(240,180,41,0.65)'
                  : level >= 20
                    ? 'rgba(232,200,90,0.5)'
                    : 'rgba(180,190,210,0.45)',
            },
          ]}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -6,
    alignSelf: 'center',
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tac: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  aura: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    opacity: 0.7,
  },
  seviye: {
    ...TipografiTokenlari.micro,
    color: '#1A1224',
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
