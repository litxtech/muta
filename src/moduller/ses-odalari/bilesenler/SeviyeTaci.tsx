import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  /** false ise parıltı kapalı; varsayılan: seviye 10+ */
  animasyonluMu?: boolean;
};

type TacPalet = {
  metal: readonly [string, string, string, string];
  metalKenar: string;
  murassa: string;
  murassaIsik: string;
  aura: string;
  yazi: string;
};

function tacPalet(level: number): TacPalet {
  if (level >= 50) {
    return {
      metal: ['#FFF6C8', '#F0C14A', '#E8941A', '#FFD76A'],
      metalKenar: 'rgba(255, 236, 170, 0.95)',
      murassa: '#FF3D6E',
      murassaIsik: '#FFB0C8',
      aura: 'rgba(255, 200, 60, 0.55)',
      yazi: '#2A1800',
    };
  }
  if (level >= 20) {
    return {
      metal: ['#FFF8DC', '#F5D76E', '#C9A227', '#FFE9A0'],
      metalKenar: 'rgba(255, 240, 190, 0.9)',
      murassa: '#4FC3F7',
      murassaIsik: '#B3E5FC',
      aura: 'rgba(232, 200, 90, 0.45)',
      yazi: '#2A2008',
    };
  }
  if (level >= 10) {
    return {
      metal: ['#F5F7FA', '#D0D7E2', '#8A94A8', '#E8ECF2'],
      metalKenar: 'rgba(255, 255, 255, 0.85)',
      murassa: '#7C5CFF',
      murassaIsik: '#C4B5FD',
      aura: 'rgba(180, 190, 210, 0.4)',
      yazi: '#1A1E28',
    };
  }
  return {
    metal: ['#F0D5B0', '#D4A574', '#8B5E3C', '#E8C49A'],
    metalKenar: 'rgba(255, 230, 200, 0.75)',
    murassa: '#2ECC71',
    murassaIsik: '#A8F0C0',
    aura: 'rgba(180, 130, 80, 0.35)',
    yazi: '#2A1810',
  };
}

function PariltiNoktasi({
  delay,
  top,
  left,
  boyut,
  renk,
}: {
  delay: number;
  top: number;
  left: number;
  boyut: number;
  renk: string;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 680, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 900 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, t]);

  const stil = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [0.15, 1]),
    transform: [
      { scale: interpolate(t.value, [0, 1], [0.4, 1.35]) },
      { rotate: `${interpolate(t.value, [0, 1], [0, 45])}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.parilti,
        {
          top,
          left,
          width: boyut,
          height: boyut,
          borderRadius: boyut / 2,
          backgroundColor: renk,
        },
        stil,
      ]}
    />
  );
}

/** Avatar üstü gerçekçi metalik seviye tacı — parıltı + mücevher */
export function SeviyeTaci({
  level,
  size = 'sm',
  animasyonluMu,
}: Props) {
  const gecerli = !!level && level >= 1;
  const pariltiAcik = gecerli && animasyonluMu !== false;
  const palet = tacPalet(level);
  const shine = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!pariltiAcik) {
      shine.value = 0;
      pulse.value = 0;
      return;
    }
    const hizli =
      level >= 50 ? 900 : level >= 20 ? 1100 : level >= 10 ? 1400 : 1800;
    shine.value = withRepeat(
      withSequence(
        withTiming(1, { duration: hizli, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: hizli * 0.35 }),
        withTiming(0, { duration: 500 }),
      ),
      -1,
      false,
    );
    // Nabız yalnızca 10+
    if (level >= 10) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: hizli * 0.7,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: hizli * 0.7,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = 0;
    }
  }, [pariltiAcik, level, shine, pulse]);

  const wrapAnim = useAnimatedStyle(() => {
    if (!pariltiAcik || level < 10) return {};
    const s = 1 + pulse.value * (level >= 50 ? 0.06 : 0.04);
    return { transform: [{ scale: s }] };
  });

  const shineAnim = useAnimatedStyle(() => ({
    opacity: interpolate(shine.value, [0, 0.4, 1], [0, 0.85, 0]),
    transform: [
      {
        translateX: interpolate(shine.value, [0, 1], [-18, 28]),
      },
      { skewX: '-18deg' },
    ],
  }));

  if (!gecerli) return null;

  const olcek = size === 'lg' ? 1.4 : size === 'md' ? 1.18 : 1;
  const W = Math.round(36 * olcek);
  const H = Math.round(24 * olcek);
  const ucH = Math.round(11 * olcek);
  const bantH = Math.round(12 * olcek);
  const murassa = Math.max(3, Math.round(3.5 * olcek));
  const ucBottom = Math.round(bantH * 0.72);

  return (
    <Animated.View
      style={[styles.wrap, { width: W, height: H }, wrapAnim]}
      pointerEvents="none"
    >
      {/* Aura glow */}
      {pariltiAcik ? (
        <View
          style={[
            styles.aura,
            {
              shadowColor: palet.metal[1],
              backgroundColor: palet.aura,
            },
          ]}
        />
      ) : null}

      {/* Taç gövdesi */}
      <View style={[styles.tacGovde, { width: W, height: H }]}>
        {/* Yan uçlar */}
        <LinearGradient
          colors={[palet.metal[0], palet.metal[2]]}
          style={[
            styles.uc,
            styles.ucSol,
            {
              height: ucH,
              width: Math.round(9 * olcek),
              bottom: ucBottom,
              borderColor: palet.metalKenar,
            },
          ]}
        >
          <View
            style={[
              styles.murassa,
              {
                width: murassa,
                height: murassa,
                borderRadius: murassa / 2,
                backgroundColor: palet.murassa,
                borderColor: palet.murassaIsik,
              },
            ]}
          />
        </LinearGradient>

        {/* Merkez zirve */}
        <LinearGradient
          colors={[palet.metal[0], palet.metal[1], palet.metal[2]]}
          locations={[0, 0.45, 1]}
          style={[
            styles.uc,
            styles.ucMerkez,
            {
              height: Math.round(ucH * 1.35),
              width: Math.round(12 * olcek),
              bottom: ucBottom + 1,
              borderColor: palet.metalKenar,
            },
          ]}
        >
          <View
            style={[
              styles.murassa,
              {
                width: murassa + 1,
                height: murassa + 1,
                borderRadius: (murassa + 1) / 2,
                backgroundColor: palet.murassa,
                borderColor: palet.murassaIsik,
                marginTop: 1,
              },
            ]}
          />
        </LinearGradient>

        <LinearGradient
          colors={[palet.metal[0], palet.metal[2]]}
          style={[
            styles.uc,
            styles.ucSag,
            {
              height: ucH,
              width: Math.round(9 * olcek),
              bottom: ucBottom,
              borderColor: palet.metalKenar,
            },
          ]}
        >
          <View
            style={[
              styles.murassa,
              {
                width: murassa,
                height: murassa,
                borderRadius: murassa / 2,
                backgroundColor: palet.murassa,
                borderColor: palet.murassaIsik,
              },
            ]}
          />
        </LinearGradient>

        {/* Bant + seviye */}
        <LinearGradient
          colors={[palet.metal[0], palet.metal[1], palet.metal[2], palet.metal[3]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          locations={[0, 0.35, 0.7, 1]}
          style={[
            styles.bant,
            {
              height: bantH,
              borderColor: palet.metalKenar,
              borderRadius: Math.round(4 * olcek),
            },
          ]}
        >
          <Text
            style={[
              styles.seviye,
              {
                fontSize: Math.round(8 * olcek),
                color: palet.yazi,
              },
            ]}
          >
            {level}
          </Text>
          {/* Metal highlight strip */}
          <View style={styles.bantIsik} />
        </LinearGradient>

        {/* Sweep shine */}
        {pariltiAcik ? (
          <Animated.View style={[styles.shineWrap, shineAnim]}>
            <LinearGradient
              colors={[
                'transparent',
                'rgba(255,255,255,0.55)',
                'transparent',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shine}
            />
          </Animated.View>
        ) : null}

        {pariltiAcik ? (
          <>
            <PariltiNoktasi
              delay={0}
              top={1}
              left={Math.round(W * 0.18)}
              boyut={Math.max(2, Math.round(2.5 * olcek))}
              renk="#FFFBEA"
            />
            <PariltiNoktasi
              delay={380}
              top={Math.round(3 * olcek)}
              left={Math.round(W * 0.48)}
              boyut={Math.max(3, Math.round(3.2 * olcek))}
              renk="#FFFFFF"
            />
            <PariltiNoktasi
              delay={720}
              top={2}
              left={Math.round(W * 0.72)}
              boyut={Math.max(2, Math.round(2.2 * olcek))}
              renk={palet.murassaIsik}
            />
          </>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  aura: {
    position: 'absolute',
    width: '88%',
    height: '70%',
    bottom: 0,
    borderRadius: 12,
    opacity: 0.55,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  tacGovde: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  uc: {
    position: 'absolute',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  ucSol: {
    left: '8%',
    transform: [{ rotate: '-18deg' }],
  },
  ucMerkez: {
    alignSelf: 'center',
    zIndex: 2,
  },
  ucSag: {
    right: '8%',
    transform: [{ rotate: '18deg' }],
  },
  murassa: {
    borderWidth: 1,
    shadowColor: '#fff',
    shadowOpacity: 0.8,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 0 },
  },
  bant: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 3,
  },
  bantIsik: {
    position: 'absolute',
    top: 1,
    left: '8%',
    right: '8%',
    height: '38%',
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  seviye: {
    ...TipografiTokenlari.micro,
    fontWeight: '900',
    letterSpacing: 0.3,
    zIndex: 1,
  },
  shineWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 14,
    zIndex: 5,
  },
  shine: {
    flex: 1,
    width: 14,
  },
  parilti: {
    position: 'absolute',
    zIndex: 6,
    shadowColor: '#fff',
    shadowOpacity: 1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
});
