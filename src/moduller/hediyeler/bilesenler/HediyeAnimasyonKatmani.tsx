import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeInLeft,
  FadeOutLeft,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  HediyeAnimasyonuKuyrugu,
  type HediyeAnimasyonIslemi,
} from '../animasyon/HediyeAnimasyonuKuyrugu';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

const { width: W, height: H } = Dimensions.get('window');

function Parcacik({
  emoji,
  index,
  aktif,
}: {
  emoji: string;
  index: number;
  aktif: boolean;
}) {
  const t = useSharedValue(0);
  const angle = (index / 8) * Math.PI * 2;
  const dist = 70 + (index % 3) * 28;

  useEffect(() => {
    if (!aktif) {
      t.value = 0;
      return;
    }
    t.value = 0;
    t.value = withTiming(1, {
      duration: 1400 + index * 40,
      easing: Easing.out(Easing.cubic),
    });
  }, [aktif, index, t]);

  const stil = useAnimatedStyle(() => {
    const x = Math.cos(angle) * dist * t.value;
    const y = Math.sin(angle) * dist * t.value - 40 * t.value;
    return {
      opacity: interpolate(t.value, [0, 0.2, 1], [0, 1, 0]),
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: interpolate(t.value, [0, 0.3, 1], [0.4, 1.1, 0.6]) },
      ],
    };
  });

  return (
    <Animated.Text style={[styles.parcacik, stil]}>{emoji}</Animated.Text>
  );
}

function YukselenEmoji({
  emoji,
  delay,
  x,
}: {
  emoji: string;
  delay: number;
  x: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    t.value = withDelay(
      delay,
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
    );
  }, [delay, t]);

  const stil = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.15, 0.85, 1], [0, 1, 0.9, 0]),
    transform: [
      { translateX: x },
      { translateY: interpolate(t.value, [0, 1], [80, -H * 0.45]) },
      { scale: interpolate(t.value, [0, 0.2, 1], [0.5, 1.2, 0.9]) },
      { rotate: `${interpolate(t.value, [0, 1], [-15, 20])}deg` },
    ],
  }));

  return <Animated.Text style={[styles.yukselen, stil]}>{emoji}</Animated.Text>;
}

function ComboSatir({ item }: { item: HediyeAnimasyonIslemi }) {
  return (
    <Animated.View
      entering={FadeInLeft.springify().damping(16)}
      exiting={FadeOutLeft.duration(200)}
      style={styles.combo}
    >
      <LinearGradient
        colors={['rgba(232,64,145,0.55)', 'rgba(26,12,40,0.9)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.comboIc}
      >
        <Text style={styles.comboEmoji}>{item.emoji}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.comboKim} numberOfLines={1}>
            {item.senderName || 'Birisi'}
          </Text>
          <Text style={styles.comboNe} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        {(item.quantity ?? 1) > 1 ? (
          <Text style={styles.comboX}>x{item.quantity}</Text>
        ) : null}
      </LinearGradient>
    </Animated.View>
  );
}

/** Overlay — modern canlı hediye: burst + yükselme + combo şerit */
export function HediyeAnimasyonKatmani() {
  const [aktif, setAktif] = useState<HediyeAnimasyonIslemi | null>(null);
  const [kuyruk, setKuyruk] = useState(0);
  const [sonBes, setSonBes] = useState<HediyeAnimasyonIslemi[]>([]);
  const scale = useSharedValue(0.2);
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0);
  const y = useSharedValue(40);

  useEffect(() => {
    return HediyeAnimasyonuKuyrugu.dinle((a, q, bes) => {
      setAktif(a);
      setKuyruk(q);
      setSonBes(bes);
      if (a) {
        scale.value = 0.2;
        opacity.value = 0;
        glow.value = 0;
        y.value = a.fullScreen ? 20 : 60;
        scale.value = withSequence(
          withTiming(1.35, {
            duration: 320,
            easing: Easing.out(Easing.back(1.6)),
          }),
          withTiming(1, { duration: 280 }),
          withDelay(a.durationMs * 0.45, withTiming(1.08, { duration: 200 })),
        );
        opacity.value = withSequence(
          withTiming(1, { duration: 180 }),
          withDelay(
            Math.max(400, a.durationMs - 500),
            withTiming(0, { duration: 320 }),
          ),
        );
        glow.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0.35, { duration: 400 }),
          ),
          -1,
          true,
        );
        y.value = withTiming(0, {
          duration: 420,
          easing: Easing.out(Easing.cubic),
        });
      }
    });
  }, [glow, opacity, scale, y]);

  const stil = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: y.value },
      { scale: scale.value },
    ],
  }));

  const glowStil = useAnimatedStyle(() => ({
    opacity: 0.25 + glow.value * 0.45,
    transform: [{ scale: 1 + glow.value * 0.15 }],
  }));

  const yukselenler = useMemo(() => {
    if (!aktif) return [];
    const n = aktif.fullScreen ? 7 : 4;
    return Array.from({ length: n }, (_, i) => ({
      key: `${aktif.id}_u_${i}`,
      delay: i * 90,
      x: (i - (n - 1) / 2) * 28 + (i % 2 === 0 ? -10 : 12),
    }));
  }, [aktif]);

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {/* Sol combo şerit — canlı yayın hissi */}
      <View style={styles.comboListe}>
        {sonBes.slice(0, 3).map((item) => (
          <ComboSatir key={`c_${item.id}`} item={item} />
        ))}
      </View>

      {aktif ? (
        <View style={styles.merkez}>
          {/* Yukarı süzülen emojiler */}
          <View style={styles.yukselenKatman}>
            {yukselenler.map((u) => (
              <YukselenEmoji
                key={u.key}
                emoji={aktif.emoji}
                delay={u.delay}
                x={u.x}
              />
            ))}
          </View>

          <Animated.View style={[styles.glow, aktif.fullScreen && styles.glowBuyuk, glowStil]} />

          {/* Burst parçacıkları */}
          <View style={styles.burst}>
            {Array.from({ length: aktif.fullScreen ? 8 : 5 }).map((_, i) => (
              <Parcacik
                key={`${aktif.id}_p_${i}`}
                emoji={aktif.emoji}
                index={i}
                aktif
              />
            ))}
          </View>

          <Animated.View
            style={[styles.card, aktif.fullScreen && styles.full, stil]}
          >
            <LinearGradient
              colors={
                aktif.fullScreen
                  ? ['rgba(240,180,41,0.35)', 'rgba(232,64,145,0.45)', 'rgba(18,8,28,0.92)']
                  : ['rgba(232,64,145,0.4)', 'rgba(18,8,28,0.88)']
              }
              style={styles.cardGrad}
            >
              <Text style={[styles.emoji, aktif.fullScreen && styles.emojiBuyuk]}>
                {aktif.emoji}
              </Text>
              {aktif.senderName ? (
                <Text style={styles.sender} numberOfLines={1}>
                  {aktif.senderName}
                </Text>
              ) : null}
              <Text style={styles.name} numberOfLines={1}>
                {aktif.name}
              </Text>
              {kuyruk > 0 ? (
                <Text style={styles.queue}>+{kuyruk} kuyrukta</Text>
              ) : null}
            </LinearGradient>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  comboListe: {
    position: 'absolute',
    left: 12,
    top: H * 0.22,
    width: Math.min(200, W * 0.48),
    gap: 8,
    zIndex: 52,
  },
  combo: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  comboIc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  comboEmoji: { fontSize: 22 },
  comboKim: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontWeight: '800',
  },
  comboNe: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
  },
  comboX: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '900',
  },
  merkez: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yukselenKatman: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: H * 0.28,
  },
  yukselen: {
    position: 'absolute',
    fontSize: 28,
    bottom: 0,
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: RenkTokenlari.primary,
  },
  glowBuyuk: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: RenkTokenlari.accent,
  },
  burst: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parcacik: {
    position: 'absolute',
    fontSize: 22,
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    minWidth: 160,
  },
  full: {
    minWidth: Math.min(W * 0.78, 320),
  },
  cardGrad: {
    paddingHorizontal: 28,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 4,
  },
  emoji: { fontSize: 72 },
  emojiBuyuk: { fontSize: 96 },
  sender: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '700',
  },
  name: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    textAlign: 'center',
  },
  queue: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    marginTop: 4,
  },
});
