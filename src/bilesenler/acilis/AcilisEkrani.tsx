import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
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
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import i18n from '../../i18n';

const { width: W, height: H } = Dimensions.get('window');

/** Sahne ~0.65s’de oturur; auth bitince ekstra bekletmez. */
const GIRIS_MS = 640;

type Props = {
  altYazi?: string;
};

/**
 * Marka açılış — modern aurora + ince halka; gölge yerine ışık katmanları.
 * Auth yüklenirken paralel akar; ek gecikme dayatmaz.
 */
export function AcilisEkrani({
  altYazi = i18n.t('ortak.yukleniyor'),
}: Props) {
  const enter = useSharedValue(0);
  const pulse = useSharedValue(0);
  const sweep = useSharedValue(0);
  const orbit = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, {
      duration: GIRIS_MS,
      easing: Easing.out(Easing.cubic),
    });
    pulse.value = withDelay(
      GIRIS_MS * 0.55,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    sweep.value = withDelay(
      180,
      withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
    orbit.value = withDelay(
      120,
      withRepeat(
        withTiming(1, { duration: 4200, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, [enter, orbit, pulse, sweep]);

  const stageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.4, 1], [0, 0.9, 1]),
  }));

  const auroraAStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0.55]),
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [1, 1.06]) },
      { translateX: interpolate(sweep.value, [0, 1], [-10, 14]) },
    ],
  }));

  const auroraBStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.28, 0.48]),
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [1.02, 0.96]) },
      { translateX: interpolate(sweep.value, [0, 1], [12, -8]) },
    ],
  }));

  const markWrapStyle = useAnimatedStyle(() => {
    const s = interpolate(enter.value, [0, 1], [0.82, 1]);
    const breathe = interpolate(pulse.value, [0, 1], [1, 1.03]);
    return {
      opacity: interpolate(enter.value, [0.15, 0.85], [0, 1]),
      transform: [{ scale: s * breathe }],
    };
  });

  const ringOuterStyle = useAnimatedStyle(() => {
    const s = interpolate(enter.value, [0, 1], [0.7, 1.18]);
    const o = interpolate(enter.value, [0, 0.4, 1], [0, 0.7, 0.22]);
    return {
      opacity: o + interpolate(pulse.value, [0, 1], [0, 0.12]),
      transform: [
        { scale: s },
        { rotate: `${interpolate(orbit.value, [0, 1], [0, 360])}deg` },
      ],
    };
  });

  const ringInnerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.2, 0.8], [0, 0.85]),
    transform: [
      {
        rotate: `${interpolate(orbit.value, [0, 1], [0, -220])}deg`,
      },
      {
        scale: interpolate(pulse.value, [0, 1], [1, 1.04]),
      },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.3, 0.8], [0, 1]),
    transform: [
      {
        translateY: interpolate(enter.value, [0.3, 0.8], [12, 0]),
      },
    ],
  }));

  const lineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.45, 0.95], [0, 1]),
    transform: [
      {
        scaleX: interpolate(enter.value, [0.45, 1], [0.15, 1]),
      },
    ],
  }));

  const altStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.55, 1], [0, 0.9]),
  }));

  const barFillStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(sweep.value, [0, 1], [-40, 40]),
      },
    ],
  }));

  return (
    <View style={[styles.kok, { backgroundColor: RenkTokenlari.bg }]}>
      <LinearGradient
        colors={[...RenkTokenlari.gradientNight]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.sahne, stageStyle]} pointerEvents="none">
        <Animated.View style={[styles.auroraA, auroraAStyle]}>
          <LinearGradient
            colors={[
              'rgba(232,64,145,0.45)',
              'rgba(196,59,255,0.18)',
              'transparent',
            ]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View style={[styles.auroraB, auroraBStyle]}>
          <LinearGradient
            colors={[
              'transparent',
              'rgba(139,92,246,0.32)',
              'rgba(61,207,176,0.12)',
            ]}
            start={{ x: 0.1, y: 0.2 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={styles.meshCenter}>
          <LinearGradient
            colors={[
              'rgba(232,64,145,0.2)',
              'rgba(196,59,255,0.08)',
              'transparent',
            ]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </Animated.View>

      <View style={styles.merkez} pointerEvents="none">
        <View style={styles.markAlan}>
          <Animated.View style={[styles.halkaDis, ringOuterStyle]}>
            <LinearGradient
              colors={[
                RenkTokenlari.primarySoft,
                RenkTokenlari.magenta,
                'rgba(61,207,176,0.55)',
                RenkTokenlari.primary,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.halkaDisDolgu}
            />
            <View style={styles.halkaDisBosluk} />
          </Animated.View>

          <Animated.View style={[styles.halkaIc, ringInnerStyle]}>
            <View style={styles.halkaIcCizgi} />
          </Animated.View>

          <Animated.View style={[styles.markWrap, markWrapStyle]}>
            <LinearGradient
              colors={[
                RenkTokenlari.primarySoft,
                RenkTokenlari.primary,
                RenkTokenlari.magenta,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.markKenar}
            >
              <View style={styles.markIc}>
                <LinearGradient
                  colors={[
                    'rgba(255,255,255,0.22)',
                    'rgba(255,255,255,0.04)',
                    'transparent',
                  ]}
                  locations={[0, 0.4, 1]}
                  style={styles.markIsik}
                />
                <Text style={styles.harf}>T</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>

        <Animated.View style={titleStyle}>
          <Text style={styles.marka}>Tamuso</Text>
        </Animated.View>

        <Animated.View style={[styles.cizgi, lineStyle]}>
          <LinearGradient
            colors={[
              'transparent',
              RenkTokenlari.primarySoft,
              RenkTokenlari.magenta,
              'transparent',
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={[styles.altSatir, altStyle]}>
          <Text style={styles.alt}>{altYazi}</Text>
          <View style={styles.bar}>
            <Animated.View style={[styles.barIsik, barFillStyle]}>
              <LinearGradient
                colors={[
                  'transparent',
                  'rgba(247,242,248,0.65)',
                  'transparent',
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const MARK = 78;
const RING = 132;

const styles = StyleSheet.create({
  kok: {
    flex: 1,
    backgroundColor: RenkTokenlari.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sahne: {
    ...StyleSheet.absoluteFill,
  },
  auroraA: {
    position: 'absolute',
    top: -H * 0.08,
    left: -W * 0.25,
    width: W * 1.15,
    height: H * 0.55,
    borderRadius: W,
    overflow: 'hidden',
  },
  auroraB: {
    position: 'absolute',
    bottom: -H * 0.05,
    right: -W * 0.3,
    width: W * 1.2,
    height: H * 0.5,
    borderRadius: W,
    overflow: 'hidden',
  },
  meshCenter: {
    position: 'absolute',
    alignSelf: 'center',
    top: H * 0.28,
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: 'hidden',
  },
  merkez: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -20,
  },
  markAlan: {
    width: RING + 24,
    height: RING + 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  halkaDis: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halkaDisDolgu: {
    ...StyleSheet.absoluteFill,
    borderRadius: RING / 2,
  },
  halkaDisBosluk: {
    width: RING - 3,
    height: RING - 3,
    borderRadius: (RING - 3) / 2,
    backgroundColor: RenkTokenlari.bg,
  },
  halkaIc: {
    position: 'absolute',
    width: RING - 22,
    height: RING - 22,
    borderRadius: (RING - 22) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halkaIcCizgi: {
    ...StyleSheet.absoluteFill,
    borderRadius: (RING - 22) / 2,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderTopColor: RenkTokenlari.primary,
    borderRightColor: RenkTokenlari.magenta,
    borderBottomColor: RenkTokenlari.divider,
    borderLeftColor: RenkTokenlari.mint,
  },
  markWrap: {
    width: MARK,
    height: MARK,
  },
  markKenar: {
    flex: 1,
    borderRadius: 22,
    padding: 1.5,
  },
  markIc: {
    flex: 1,
    borderRadius: 20.5,
    backgroundColor: RenkTokenlari.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  markIsik: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: MARK * 0.55,
  },
  harf: {
    color: RenkTokenlari.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  marka: {
    ...TipografiTokenlari.hero,
    color: RenkTokenlari.text,
    fontSize: 32,
    letterSpacing: 3,
    fontWeight: '800',
  },
  cizgi: {
    marginTop: 14,
    width: 72,
    height: 1.5,
    borderRadius: 1,
    overflow: 'hidden',
  },
  altSatir: {
    marginTop: 18,
    alignItems: 'center',
    gap: 10,
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  bar: {
    width: 64,
    height: 2,
    borderRadius: 1,
    backgroundColor: RenkTokenlari.pressFill,
    overflow: 'hidden',
  },
  barIsik: {
    width: 28,
    height: 2,
  },
});
