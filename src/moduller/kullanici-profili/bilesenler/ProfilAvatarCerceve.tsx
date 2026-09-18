/**
 * Profil avatar çerçevesi — metalik halka + gerçekçi parıltılı taç.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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

const GOLD = ['#FFF8DC', '#F5D76E', '#C9A227', '#FFE9A0'] as const;
const GOLD_DEEP = ['#FFE9A0', '#D4AF37', '#8B6914', '#F0D78C'] as const;
const GOLD_SOFT = 'rgba(212, 175, 55, 0.55)';
const GEM = '#4FC3F7';
const GEM_LIGHT = '#E1F5FE';

type Props = {
  size: number;
  children: React.ReactNode;
};

function Kivilcim({
  delay,
  top,
  left,
  size,
}: {
  delay: number;
  top: number;
  left: number;
  size: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 480, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 720, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 1100 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, t]);

  const stil = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [0.1, 1]),
    transform: [{ scale: interpolate(t.value, [0, 1], [0.35, 1.4]) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFFBEA',
          shadowColor: '#fff',
          shadowOpacity: 1,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 0 },
          zIndex: 8,
        },
        stil,
      ]}
    />
  );
}

export function ProfilAvatarCerceve({ size, children }: Props) {
  const ring = size + 14;
  const outer = size + 28;
  const shine = useSharedValue(0);

  useEffect(() => {
    shine.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 400 }),
        withTiming(0, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [shine]);

  const shineStil = useAnimatedStyle(() => ({
    opacity: interpolate(shine.value, [0, 0.45, 1], [0, 0.9, 0]),
    transform: [
      { translateX: interpolate(shine.value, [0, 1], [-22, 36]) },
      { skewX: '-16deg' },
    ],
  }));

  const ucH = 16;
  const bantH = 12;

  return (
    <View style={[styles.wrap, { width: outer, height: outer + 22 }]}>
      {/* Üst taç — 3 uç + bant */}
      <View style={[styles.tacWrap, { width: outer * 0.72 }]} pointerEvents="none">
        <View style={[styles.tacGovde, { height: ucH + bantH }]}>
          <LinearGradient
            colors={[...GOLD]}
            style={[styles.uc, styles.ucSol, { height: ucH }]}
          >
            <View style={styles.murassa} />
          </LinearGradient>
          <LinearGradient
            colors={[...GOLD_DEEP]}
            style={[styles.uc, styles.ucMerkez, { height: ucH + 5 }]}
          >
            <View style={[styles.murassa, styles.murassaBuyuk]} />
          </LinearGradient>
          <LinearGradient
            colors={[...GOLD]}
            style={[styles.uc, styles.ucSag, { height: ucH }]}
          >
            <View style={styles.murassa} />
          </LinearGradient>

          <LinearGradient
            colors={[...GOLD]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bant, { height: bantH }]}
          >
            <View style={styles.bantIsik} />
          </LinearGradient>

          <Animated.View style={[styles.shineWrap, shineStil]}>
            <LinearGradient
              colors={[
                'transparent',
                'rgba(255,255,255,0.65)',
                'transparent',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shine}
            />
          </Animated.View>

          <Kivilcim delay={0} top={2} left={10} size={3} />
          <Kivilcim delay={450} top={0} left={38} size={4} />
          <Kivilcim delay={900} top={3} left={64} size={3} />
        </View>
      </View>

      {/* Altın halka */}
      <LinearGradient
        colors={[...GOLD]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.halka,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
          },
        ]}
      >
        <View
          style={[
            styles.halkaIc,
            {
              width: size + 4,
              height: size + 4,
              borderRadius: (size + 4) / 2,
            },
          ]}
        >
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              overflow: 'hidden',
            }}
          >
            {children}
          </View>
        </View>
      </LinearGradient>

      {/* Yan süs — küçük mücevher rozet */}
      <View style={[styles.yanSus, styles.yanSol]} pointerEvents="none">
        <LinearGradient colors={[...GOLD]} style={styles.yanKutu}>
          <View style={styles.yanMurassa} />
        </LinearGradient>
      </View>
      <View style={[styles.yanSus, styles.yanSag]} pointerEvents="none">
        <LinearGradient colors={[...GOLD]} style={styles.yanKutu}>
          <View style={styles.yanMurassa} />
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tacWrap: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 3,
  },
  tacGovde: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  uc: {
    position: 'absolute',
    bottom: 10,
    width: 14,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,236,180,0.95)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
    shadowColor: '#D4AF37',
    shadowOpacity: 0.55,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  ucSol: {
    left: '6%',
    transform: [{ rotate: '-20deg' }],
  },
  ucMerkez: {
    width: 18,
    alignSelf: 'center',
    zIndex: 2,
    bottom: 11,
  },
  ucSag: {
    right: '6%',
    transform: [{ rotate: '20deg' }],
  },
  murassa: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GEM,
    borderWidth: 1,
    borderColor: GEM_LIGHT,
  },
  murassaBuyuk: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bant: {
    width: '100%',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,236,180,0.95)',
    overflow: 'hidden',
    zIndex: 3,
    shadowColor: '#D4AF37',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bantIsik: {
    position: 'absolute',
    top: 1,
    left: '10%',
    right: '10%',
    height: '42%',
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  shineWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 16,
    zIndex: 6,
  },
  shine: {
    flex: 1,
    width: 16,
  },
  halka: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  halkaIc: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121018',
    borderWidth: 1,
    borderColor: GOLD_SOFT,
  },
  yanSus: {
    position: 'absolute',
    bottom: 18,
    zIndex: 2,
  },
  yanSol: { left: 0 },
  yanSag: { right: 0 },
  yanKutu: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,236,180,0.7)',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  yanMurassa: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: GEM,
    borderWidth: 1,
    borderColor: GEM_LIGHT,
  },
});
