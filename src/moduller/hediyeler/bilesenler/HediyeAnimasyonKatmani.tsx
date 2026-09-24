import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  HEDIYE_COMBO_GORUNME_MS,
  HediyeAnimasyonuKuyrugu,
  type HediyeAnimasyonIslemi,
} from '../animasyon/HediyeAnimasyonuKuyrugu';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

const { width: W, height: H } = Dimensions.get('window');
const ANDROID = Platform.OS === 'android';

const SPRING_INIS = { damping: 14, stiffness: 160, mass: 0.85 };
const SPRING_COMBO = { damping: 16, stiffness: 220, mass: 0.7 };

function comboSeviye(adet: number): {
  renk: string;
  glow: string;
  xBoy: number;
  etiket?: string;
} {
  if (adet >= 188)
    return { renk: '#FF3D9A', glow: 'rgba(255,61,154,0.9)', xBoy: 34, etiket: 'MEGA' };
  if (adet >= 77)
    return { renk: '#FF6B1A', glow: 'rgba(255,107,26,0.85)', xBoy: 30, etiket: 'HOT' };
  if (adet >= 17)
    return { renk: '#FFD24A', glow: 'rgba(255,210,74,0.8)', xBoy: 28 };
  if (adet >= 7)
    return { renk: '#FF9ECD', glow: 'rgba(255,158,205,0.75)', xBoy: 26 };
  return { renk: '#FFFFFF', glow: 'rgba(255,255,255,0.55)', xBoy: 24 };
}

function IsikParcaci({
  index,
  aktif,
  full,
}: {
  index: number;
  aktif: boolean;
  full: boolean;
}) {
  const t = useSharedValue(0);
  const n = full ? 14 : 10;
  const angle = (index / n) * Math.PI * 2 + (index % 3) * 0.18;
  const dist = (full ? 110 : 78) + (index % 4) * 22;
  const size = 3 + (index % 4);
  const warm = index % 3 !== 0;

  useEffect(() => {
    if (!aktif) {
      t.value = 0;
      return;
    }
    t.value = 0;
    t.value = withDelay(
      450,
      withTiming(1, {
        duration: 900 + (index % 5) * 70,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [aktif, index, t]);

  const stil = useAnimatedStyle(() => {
    const p = t.value;
    const drag = p * p;
    return {
      opacity: interpolate(p, [0, 0.12, 0.55, 1], [0, 1, 0.7, 0]),
      transform: [
        { translateX: Math.cos(angle) * dist * p },
        { translateY: Math.sin(angle) * dist * p + drag * 48 },
        {
          scale: interpolate(p, [0, 0.2, 1], [0.3, 1.15, 0.2], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.isik,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: warm ? '#FFD28A' : '#FF8EC8',
        },
        stil,
      ]}
    />
  );
}

function YukselenHediye({
  emoji,
  delay,
  x,
  seed,
}: {
  emoji: string;
  delay: number;
  x: number;
  seed: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    t.value = withDelay(
      delay,
      withTiming(1, {
        duration: 2100 + seed * 80,
        easing: Easing.bezier(0.22, 0.61, 0.36, 1),
      }),
    );
  }, [delay, seed, t]);

  const stil = useAnimatedStyle(() => {
    const sway = Math.sin(t.value * Math.PI * 2.2 + seed) * 14;
    return {
      opacity: interpolate(t.value, [0, 0.1, 0.75, 1], [0, 1, 0.85, 0]),
      transform: [
        { translateX: x + sway },
        { translateY: interpolate(t.value, [0, 1], [56, -H * 0.42]) },
        {
          scale: interpolate(t.value, [0, 0.18, 0.7, 1], [0.35, 1.05, 0.95, 0.7]),
        },
        {
          rotate: `${interpolate(t.value, [0, 1], [-8 - seed * 2, 12 + seed * 3])}deg`,
        },
      ],
    };
  });

  return <Animated.Text style={[styles.yukselen, stil]}>{emoji}</Animated.Text>;
}

function SokHalkasi({ aktif, full }: { aktif: boolean; full: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!aktif) {
      t.value = 0;
      return;
    }
    t.value = 0;
    t.value = withDelay(
      460,
      withTiming(1, {
        duration: full ? 780 : 620,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [aktif, full, t]);

  const stil = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.15, 1], [0, 0.55, 0]),
    transform: [
      { scale: interpolate(t.value, [0, 1], [0.35, full ? 2.4 : 1.9]) },
    ],
  }));

  return <Animated.View style={[styles.sok, full && styles.sokBuyuk, stil]} />;
}

function ComboPatlamaKivilcim({
  index,
  tetik,
  renk,
}: {
  index: number;
  tetik: number;
  renk: string;
}) {
  const t = useSharedValue(0);
  const angle = (index / 8) * Math.PI * 2;
  const dist = 28 + (index % 3) * 10;
  const boyut = 4 + (index % 3);

  useEffect(() => {
    if (tetik <= 0) return;
    t.value = 0;
    t.value = withTiming(1, {
      duration: 420 + index * 25,
      easing: Easing.out(Easing.cubic),
    });
  }, [index, t, tetik]);

  const stil = useAnimatedStyle(() => {
    const p = t.value;
    return {
      opacity: interpolate(p, [0, 0.15, 1], [0, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * dist * p },
        { translateY: Math.sin(angle) * dist * p - 6 * p },
        { scale: interpolate(p, [0, 0.3, 1], [0.4, 1.2, 0.2]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.comboKivilcim,
        {
          backgroundColor: renk,
          width: boyut,
          height: boyut,
          borderRadius: boyut / 2,
        },
        stil,
      ]}
    />
  );
}

/** TikTok sol combo — ×adet her vuruşta / adette patlar */
function ComboSatir({ item }: { item: HediyeAnimasyonIslemi }) {
  const { t } = useCeviri();
  const opacity = useSharedValue(0);
  const tx = useSharedValue(-48);
  const satirScale = useSharedValue(0.9);
  const xScale = useSharedValue(1);
  const xRotate = useSharedValue(0);
  const halka = useSharedValue(0);
  const adet = Math.max(1, item.quantity ?? 1);
  const tick = item.comboTick ?? 1;
  const seviye = comboSeviye(adet);

  useEffect(() => {
    opacity.value = 0;
    tx.value = -48;
    satirScale.value = 0.9;
    opacity.value = withTiming(1, { duration: 180 });
    tx.value = withSpring(0, SPRING_COMBO);
    satirScale.value = withSpring(1, SPRING_COMBO);
  }, [item.id, opacity, satirScale, tx]);

  useEffect(() => {
    const peak = adet >= 77 ? 2.6 : adet >= 17 ? 2.2 : adet >= 7 ? 1.9 : 1.65;
    xScale.value = 0.4;
    xRotate.value = -12;
    halka.value = 0;
    xScale.value = withSequence(
      withTiming(peak, {
        duration: 110,
        easing: Easing.out(Easing.back(2.2)),
      }),
      withSpring(1, { damping: 8, stiffness: 220 }),
    );
    xRotate.value = withSequence(
      withTiming(8, { duration: 90 }),
      withTiming(-5, { duration: 80 }),
      withSpring(0, { damping: 12, stiffness: 200 }),
    );
    halka.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
    satirScale.value = withSequence(
      withTiming(1.06, { duration: 90 }),
      withSpring(1, SPRING_COMBO),
    );

    const fadeMs = Math.max(0, HEDIYE_COMBO_GORUNME_MS - 400);
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 300 });
      tx.value = withTiming(-56, { duration: 300 });
    }, fadeMs);
    return () => clearTimeout(timer);
  }, [adet, tick, halka, opacity, satirScale, tx, xRotate, xScale]);

  const stil = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }, { scale: satirScale.value }],
  }));

  const xStil = useAnimatedStyle(() => ({
    transform: [{ scale: xScale.value }, { rotate: `${xRotate.value}deg` }],
  }));

  const halkaStil = useAnimatedStyle(() => ({
    opacity: interpolate(halka.value, [0, 0.2, 1], [0, 0.7, 0]),
    transform: [{ scale: interpolate(halka.value, [0, 1], [0.5, 2.1]) }],
  }));

  return (
    <Animated.View style={[styles.combo, stil]}>
      <View
        style={[styles.comboCam, adet >= 17 ? { borderColor: seviye.glow } : null]}
      >
        <LinearGradient
          colors={
            adet >= 77
              ? ['rgba(255,80,40,0.35)', 'rgba(20,6,12,0.88)']
              : adet >= 17
                ? ['rgba(255,200,60,0.28)', 'rgba(16,10,4,0.85)']
                : ['rgba(255,255,255,0.14)', 'rgba(12,6,22,0.72)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.comboGrad}
        >
          <View style={styles.comboEmojiKutu}>
            <Text style={styles.comboEmoji}>{item.emoji}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.comboKim} numberOfLines={1}>
              {item.senderName || t('hediye.birisi')}
            </Text>
            <Text style={styles.comboNe} numberOfLines={1}>
              {item.name}
            </Text>
          </View>

          <View style={styles.comboXAlan}>
            <Animated.View
              style={[
                styles.comboHalka,
                { borderColor: seviye.renk },
                halkaStil,
              ]}
            />
            {Array.from({ length: ANDROID ? 4 : 8 }).map((_, i) => (
              <ComboPatlamaKivilcim
                key={`${item.id}_k_${tick}_${i}`}
                index={i}
                tetik={tick}
                renk={seviye.renk}
              />
            ))}
            <Animated.View style={[styles.comboXBlok, xStil]}>
              <Text
                style={[
                  styles.comboXBuyuk,
                  {
                    color: seviye.renk,
                    fontSize: seviye.xBoy,
                    textShadowColor: seviye.glow,
                  },
                ]}
              >
                ×{adet}
              </Text>
              {seviye.etiket ? (
                <Text style={[styles.comboEtiket, { color: seviye.renk }]}>
                  {seviye.etiket}
                </Text>
              ) : null}
            </Animated.View>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

/** Overlay — TikTok combo sol + merkez uçuş */
export function HediyeAnimasyonKatmani() {
  const [aktif, setAktif] = useState<HediyeAnimasyonIslemi | null>(null);
  const [kuyruk, setKuyruk] = useState(0);
  const [sonBes, setSonBes] = useState<HediyeAnimasyonIslemi[]>([]);

  const fly = useSharedValue(0);
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0);
  const plate = useSharedValue(0);
  const squash = useSharedValue(1);
  const merkezX = useSharedValue(1);

  useEffect(() => {
    return HediyeAnimasyonuKuyrugu.dinle((a, q, bes) => {
      setAktif(a);
      setKuyruk(q);
      setSonBes(bes);
      if (a) {
        fly.value = 0;
        opacity.value = 0;
        glow.value = 0;
        plate.value = 0;
        squash.value = 1;
        merkezX.value = 0.5;

        fly.value = withTiming(1, {
          duration: a.durationMs < 1300 ? 380 : 520,
          easing: Easing.bezier(0.16, 0.84, 0.28, 1),
        });
        opacity.value = withSequence(
          withTiming(1, { duration: 140 }),
          withDelay(
            Math.max(400, a.durationMs - 500),
            withTiming(0, {
              duration: 320,
              easing: Easing.in(Easing.cubic),
            }),
          ),
        );
        squash.value = withDelay(
          a.durationMs < 1300 ? 340 : 480,
          withSequence(
            withTiming(0.88, { duration: 70 }),
            withSpring(1, SPRING_INIS),
          ),
        );
        glow.value = withDelay(
          360,
          withRepeat(
            withSequence(
              withTiming(1, { duration: 520, easing: Easing.inOut(Easing.sin) }),
              withTiming(0.4, { duration: 520, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            false,
          ),
        );
        plate.value = withDelay(
          320,
          withSpring(1, { damping: 18, stiffness: 180 }),
        );
        const adet = a.quantity ?? 1;
        if (adet > 1) {
          merkezX.value = withSequence(
            withTiming(adet >= 77 ? 2.4 : 1.8, {
              duration: 140,
              easing: Easing.out(Easing.back(1.8)),
            }),
            withSpring(1, { damping: 10, stiffness: 200 }),
          );
        } else {
          merkezX.value = withSpring(1, SPRING_INIS);
        }
      }
    });
  }, [fly, glow, merkezX, opacity, plate, squash]);

  // Combo birleşince merkez × da zıplasın
  useEffect(() => {
    if (!aktif) return;
    const adet = aktif.quantity ?? 1;
    if (adet <= 1) return;
    merkezX.value = withSequence(
      withTiming(adet >= 77 ? 2.2 : 1.7, {
        duration: 100,
        easing: Easing.out(Easing.back(2)),
      }),
      withSpring(1, { damping: 9, stiffness: 210 }),
    );
  }, [aktif?.comboTick, aktif?.quantity, aktif, merkezX]);

  const hediyeStil = useAnimatedStyle(() => {
    const p = fly.value;
    const lift = interpolate(p, [0, 1], [H * 0.28, 0]);
    const scale = interpolate(p, [0, 0.55, 1], [0.35, 1.22, 1]);
    const sway = Math.sin(p * Math.PI) * 18;
    return {
      opacity: opacity.value,
      transform: [
        { translateY: lift },
        { translateX: sway },
        { scaleX: scale * squash.value },
        { scaleY: scale * (2 - squash.value) },
      ],
    };
  });

  const glowStil = useAnimatedStyle(() => ({
    opacity: 0.18 + glow.value * 0.42,
    transform: [{ scale: 0.92 + glow.value * 0.22 }],
  }));

  const plateStil = useAnimatedStyle(() => ({
    opacity: plate.value * opacity.value,
    transform: [
      { translateY: interpolate(plate.value, [0, 1], [12, 0]) },
      { scale: interpolate(plate.value, [0, 1], [0.94, 1]) },
    ],
  }));

  const merkezXStil = useAnimatedStyle(() => ({
    transform: [{ scale: merkezX.value }],
    opacity: opacity.value,
  }));

  const yukselenler = useMemo(() => {
    if (!aktif) return [];
    const n = ANDROID
      ? aktif.fullScreen || (aktif.quantity ?? 1) >= 77
        ? 3
        : 2
      : aktif.fullScreen || (aktif.quantity ?? 1) >= 17
        ? 6
        : 3;
    return Array.from({ length: n }, (_, i) => ({
      key: `${aktif.id}_u_${i}`,
      delay: 420 + i * 110,
      x: (i - (n - 1) / 2) * 32 + (i % 2 === 0 ? -8 : 10),
      seed: i + 1,
    }));
  }, [aktif]);

  const parcacikSayisi = ANDROID
    ? aktif?.fullScreen || (aktif?.quantity ?? 1) >= 77
      ? 8
      : 5
    : aktif?.fullScreen || (aktif?.quantity ?? 1) >= 17
      ? 14
      : 10;
  const adetAktif = aktif ? Math.max(1, aktif.quantity ?? 1) : 1;
  const seviyeAktif = comboSeviye(adetAktif);

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.comboListe}>
        {sonBes.slice(0, 3).map((item) => (
          <ComboSatir key={item.comboKey ?? item.id} item={item} />
        ))}
      </View>

      {aktif ? (
        <View style={styles.merkez}>
          <View style={styles.yukselenKatman}>
            {yukselenler.map((u) => (
              <YukselenHediye
                key={u.key}
                emoji={aktif.emoji}
                delay={u.delay}
                x={u.x}
                seed={u.seed}
              />
            ))}
          </View>

          <SokHalkasi
            aktif
            full={!!aktif.fullScreen || adetAktif >= 77}
          />

          <Animated.View
            style={[
              styles.glow,
              (aktif.fullScreen || adetAktif >= 77) && styles.glowBuyuk,
              glowStil,
            ]}
          />

          <View style={styles.burst}>
            {Array.from({ length: parcacikSayisi }).map((_, i) => (
              <IsikParcaci
                key={`${aktif.id}_p_${i}`}
                index={i}
                aktif
                full={!!aktif.fullScreen || adetAktif >= 17}
              />
            ))}
          </View>

          <Animated.View style={[styles.hero, hediyeStil]}>
            <Text
              style={[
                styles.emoji,
                (aktif.fullScreen || adetAktif >= 77) && styles.emojiBuyuk,
              ]}
            >
              {aktif.emoji}
            </Text>
            {adetAktif > 1 ? (
              <Animated.Text
                style={[
                  styles.merkezComboX,
                  {
                    color: seviyeAktif.renk,
                    textShadowColor: seviyeAktif.glow,
                  },
                  merkezXStil,
                ]}
              >
                ×{adetAktif}
              </Animated.Text>
            ) : null}
          </Animated.View>

          <Animated.View style={[styles.plate, plateStil]}>
            <LinearGradient
              colors={
                aktif.fullScreen || adetAktif >= 77
                  ? [
                      'rgba(255,210,120,0.22)',
                      'rgba(232,64,145,0.28)',
                      'rgba(8,4,16,0.72)',
                    ]
                  : ['rgba(255,255,255,0.12)', 'rgba(8,4,16,0.7)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.plateGrad}
            >
              {aktif.senderName ? (
                <Text style={styles.sender} numberOfLines={1}>
                  {aktif.senderName}
                </Text>
              ) : null}
              <Text style={styles.name} numberOfLines={1}>
                {aktif.name}
              </Text>
              {kuyruk > 0 ? (
                <Text style={styles.queue}>+{kuyruk}</Text>
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
    left: 10,
    top: H * 0.18,
    width: Math.min(230, W * 0.56),
    gap: 8,
    zIndex: 52,
  },
  combo: {
    borderRadius: 16,
  },
  comboCam: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(12,6,22,0.58)',
  },
  comboGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    paddingRight: 8,
  },
  comboEmojiKutu: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  comboEmoji: { fontSize: 22 },
  comboKim: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontWeight: '800',
  },
  comboNe: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
  },
  comboXAlan: {
    width: 64,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboHalka: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
  comboKivilcim: {
    position: 'absolute',
  },
  comboXBlok: {
    alignItems: 'center',
  },
  comboXBuyuk: {
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  comboEtiket: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: -2,
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
    paddingBottom: H * 0.3,
  },
  yukselen: {
    position: 'absolute',
    fontSize: 26,
    bottom: 0,
  },
  sok: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(255,210,140,0.65)',
  },
  sokBuyuk: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderColor: 'rgba(255,180,60,0.75)',
  },
  glow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: RenkTokenlari.primary,
  },
  glowBuyuk: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: RenkTokenlari.accent,
  },
  burst: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  isik: {
    position: 'absolute',
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 88,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 12,
  },
  emojiBuyuk: {
    fontSize: 112,
  },
  merkezComboX: {
    marginTop: -8,
    fontSize: 42,
    fontWeight: '900',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  plate: {
    marginTop: 10,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    minWidth: 140,
    maxWidth: W * 0.7,
  },
  plateGrad: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  sender: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '700',
  },
  name: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  queue: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    marginTop: 2,
  },
});
