import React, { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  Gesture,
  GestureDetector,
  Pressable,
  ScrollView,
} from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { yuzenTabBarToplamYukseklik } from '../../../components/YuzenTabBosluk';
import { kullaniciTemaKodunuAl } from '../../../tasarim-sistemi/tema/TemaDurumu';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';

export type AnaSayfaMenuOgesi = {
  key: string;
  baslik: string;
  alt: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  href: string;
};

export type AnaSayfaMenuProfil = {
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
};

type Props = {
  acik: boolean;
  onAcikDegisti: (acik: boolean) => void;
  ogeler: AnaSayfaMenuOgesi[];
  onOgeSec: (href: string) => void;
  profil?: AnaSayfaMenuProfil | null;
  onProfilPress: () => void;
  children: ReactNode;
};

const EKRAN_W = Dimensions.get('window').width;
const MENU_W = Math.min(Math.round(EKRAN_W * 0.78), 320);
const EDGE = 36;
/** Titremesiz — overshoot yok, çift spring yok */
const SPRING = {
  damping: 34,
  stiffness: 260,
  mass: 0.85,
  overshootClamping: true,
} as const;
const PAN_ACTIVE_X = 12;
const PAN_FAIL_Y = 24;
const HIZ_ESIK = 420;
const ACILIS_ESIK = 0.35;

/**
 * X tarzı push drawer — modern üst sahne + kaydırılabilir menü kartları.
 */
export function AnaSayfaCekmeceMenu({
  acik,
  onAcikDegisti,
  ogeler,
  onOgeSec,
  profil,
  onProfilPress,
  children,
}: Props) {
  useTemayaAboneOl();
  const insets = useSafeAreaInsets();
  const acikSv = useSharedValue(0);
  const surukleBaslangic = useSharedValue(0);
  const acikTema = kullaniciTemaKodunuAl() === 'acik';
  const ustGradient = RenkTokenlari.gradientNight;
  const ustAccent = acikTema
    ? (['rgba(214,46,130,0.18)', 'rgba(91,47,212,0.08)', 'transparent'] as const)
    : Platform.OS === 'ios'
      ? (['rgba(240,107,168,0.35)', 'rgba(196,59,255,0.12)', 'transparent'] as const)
      : (['rgba(232,64,145,0.42)', 'rgba(139,92,246,0.18)', 'transparent'] as const);
  const ustYazi = RenkTokenlari.text;
  const ustYaziSoluk = RenkTokenlari.textMuted;
  /** Jest zaten spring başlattıysa useEffect tekrar basmasın */
  const jestSpringRef = useRef(false);

  useEffect(() => {
    if (jestSpringRef.current) {
      jestSpringRef.current = false;
      return;
    }
    acikSv.value = withSpring(acik ? 1 : 0, SPRING);
  }, [acik, acikSv]);

  const setAcik = useCallback(
    (v: boolean) => {
      onAcikDegisti(v);
    },
    [onAcikDegisti],
  );

  const jestBitir = useCallback(
    (sonraki: boolean) => {
      jestSpringRef.current = true;
      acikSv.value = withSpring(sonraki ? 1 : 0, SPRING);
      onAcikDegisti(sonraki);
    },
    [acikSv, onAcikDegisti],
  );

  const kapat = useCallback(() => {
    onAcikDegisti(false);
  }, [onAcikDegisti]);

  const kenarPan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!acik)
        .hitSlop({ left: 0, width: EDGE, top: 0, bottom: 0 })
        .activeOffsetX(PAN_ACTIVE_X)
        .failOffsetY([-PAN_FAIL_Y, PAN_FAIL_Y])
        .onBegin(() => {
          surukleBaslangic.value = acikSv.value;
        })
        .onUpdate((e) => {
          const delta = e.translationX / MENU_W;
          acikSv.value = Math.min(
            1,
            Math.max(0, surukleBaslangic.value + delta),
          );
        })
        .onEnd((e) => {
          const hiz = e.velocityX;
          const sonraki =
            hiz > HIZ_ESIK
              ? true
              : hiz < -HIZ_ESIK
                ? false
                : acikSv.value > ACILIS_ESIK;
          runOnJS(jestBitir)(sonraki);
        }),
    [acik, acikSv, jestBitir, surukleBaslangic],
  );

  const ekranKapatPan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(acik)
        .activeOffsetX(-PAN_ACTIVE_X)
        .failOffsetY([-PAN_FAIL_Y, PAN_FAIL_Y])
        .onBegin(() => {
          surukleBaslangic.value = acikSv.value;
        })
        .onUpdate((e) => {
          const delta = e.translationX / MENU_W;
          acikSv.value = Math.min(
            1,
            Math.max(0, surukleBaslangic.value + delta),
          );
        })
        .onEnd((e) => {
          const hiz = e.velocityX;
          const sonraki =
            hiz > HIZ_ESIK
              ? true
              : hiz < -HIZ_ESIK
                ? false
                : acikSv.value > ACILIS_ESIK;
          runOnJS(jestBitir)(sonraki);
        }),
    [acik, acikSv, jestBitir, surukleBaslangic],
  );

  const panelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      acikSv.value,
      [0, 0.2, 1],
      [0.5, 1, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          acikSv.value,
          [0, 1],
          [-MENU_W * 0.06, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  /** Sadece transform — margin/border layout titretmesin */
  const icerikStyle = useAnimatedStyle(() => {
    const t = acikSv.value;
    return {
      transform: [
        {
          translateX: interpolate(
            t,
            [0, 1],
            [0, MENU_W - 12],
            Extrapolation.CLAMP,
          ),
        },
        {
          translateY: interpolate(t, [0, 1], [0, 8], Extrapolation.CLAMP),
        },
        {
          scale: interpolate(t, [0, 1], [1, 0.98], Extrapolation.CLAMP),
        },
      ],
      borderRadius: interpolate(t, [0, 1], [0, 26], Extrapolation.CLAMP),
    };
  });

  const perdeStyle = useAnimatedStyle(() => ({
    opacity: acikSv.value * 0.16,
  }));

  const kenarIsikStyle = useAnimatedStyle(() => ({
    opacity: interpolate(acikSv.value, [0, 0.35, 1], [0, 0.6, 1], Extrapolation.CLAMP),
  }));

  const ad = profil?.displayName?.trim() || 'Kullanıcı';
  const harf = (ad[0] ?? 'K').toUpperCase();
  const altBosluk = yuzenTabBarToplamYukseklik(insets.bottom);
  const ustPad = insets.top + (Platform.OS === 'ios' ? 8 : 12);

  return (
    <GestureDetector gesture={ekranKapatPan}>
      <View style={styles.kok}>
        <LinearGradient
          colors={[...ustGradient]}
          style={styles.kokZemin}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[...ustAccent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.6 }}
          style={styles.kokParlama}
          pointerEvents="none"
        />

        <Animated.View
          style={[styles.panel, { width: MENU_W }, panelStyle]}
          pointerEvents={acik ? 'auto' : 'none'}
        >
          <ScrollView
            style={styles.listeScroll}
            contentContainerStyle={[
              styles.liste,
              { paddingTop: ustPad, paddingBottom: altBosluk },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces
            overScrollMode="always"
            decelerationRate="fast"
          >
            {/* Üst kart — kaydırınca menüyle birlikte iner */}
            <View
              style={[
                styles.ustSahne,
                {
                  borderColor: RenkTokenlari.border,
                  backgroundColor: RenkTokenlari.bgCard,
                },
              ]}
            >
              <LinearGradient
                colors={[...ustGradient]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <LinearGradient
                colors={[...ustAccent]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.ustParlama}
                pointerEvents="none"
              />
              {Platform.OS === 'ios' ? (
                <View style={styles.iosCam} pointerEvents="none" />
              ) : (
                <View style={styles.androidMaterial} pointerEvents="none" />
              )}

              <View style={styles.ustIc}>
                <View style={styles.markaSatir}>
                  <Text style={[styles.marka, { color: ustYazi }]}>Tamuso</Text>
                  <View
                    style={[
                      styles.platformRozet,
                      {
                        backgroundColor: RenkTokenlari.pressFill,
                        borderColor: RenkTokenlari.border,
                      },
                    ]}
                  >
                    <Text style={[styles.platformRozetYazi, { color: ustYazi }]}>
                      {Platform.OS === 'ios' ? 'iOS' : 'Android'}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    kapat();
                    onProfilPress();
                  }}
                  style={({ pressed }) => [
                    styles.profilKart,
                    {
                      backgroundColor: RenkTokenlari.pressFill,
                      borderColor: RenkTokenlari.border,
                    },
                    pressed && styles.pressed,
                  ]}
                  accessibilityLabel="Profilime git"
                >
                  {MedyaUriGuvenli(profil?.avatarUrl) ? (
                    <Image
                      source={{ uri: MedyaUriGuvenli(profil?.avatarUrl)! }}
                      style={[styles.avatar, { borderColor: RenkTokenlari.border }]}
                    />
                  ) : (
                    <LinearGradient
                      colors={[...RenkTokenlari.gradientPrimary]}
                      style={[styles.avatar, { borderColor: 'transparent' }]}
                    >
                      <Text style={styles.avatarHarf}>{harf}</Text>
                    </LinearGradient>
                  )}
                  <View style={styles.profilCopy}>
                    <Text style={[styles.profilAd, { color: ustYazi }]} numberOfLines={1}>
                      {ad}
                    </Text>
                    {profil?.username ? (
                      <Text style={[styles.profilUser, { color: ustYaziSoluk }]} numberOfLines={1}>
                        @{profil.username}
                      </Text>
                    ) : (
                      <Text style={[styles.profilUser, { color: ustYaziSoluk }]}>
                        Profili görüntüle
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={RenkTokenlari.textDim}
                  />
                </Pressable>
              </View>
            </View>

            <Text style={styles.bolumEtiket}>Keşfet</Text>

            {ogeler.map((oge, i) => (
              <Animated.View
                key={oge.key}
                entering={
                  acik
                    ? FadeInDown.delay(40 + i * 28)
                        .duration(AnimasyonTokenlari.normal)
                        .springify()
                        .damping(18)
                    : undefined
                }
              >
                <Pressable
                  onPress={() => {
                    kapat();
                    onOgeSec(oge.href);
                  }}
                  style={({ pressed }) => [
                    styles.satir,
                    pressed && styles.satirPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${oge.baslik}. ${oge.alt}`}
                >
                  <View
                    style={[
                      styles.ikonKuyu,
                      { backgroundColor: `${oge.tint}22` },
                    ]}
                  >
                    <Ionicons name={oge.icon} size={18} color={oge.tint} />
                  </View>
                  <View style={styles.satirCopy}>
                    <Text style={styles.satirBaslik} numberOfLines={1}>
                      {oge.baslik}
                    </Text>
                    <Text style={styles.satirAlt} numberOfLines={1}>
                      {oge.alt}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={RenkTokenlari.textDim}
                  />
                </Pressable>
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>

        <GestureDetector gesture={kenarPan}>
          <Animated.View
            style={[styles.icerik, icerikStyle]}
            pointerEvents="box-none"
            collapsable={false}
          >
            {children}

            {/* Menü ↔ feed yumuşak kenar ışığı */}
            <Animated.View
              pointerEvents="none"
              style={[styles.kenarIsik, kenarIsikStyle]}
            >
              <LinearGradient
                colors={[
                  'rgba(240,107,168,0.28)',
                  'rgba(139,92,246,0.08)',
                  'transparent',
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            <Animated.View
              style={[styles.perde, perdeStyle]}
              pointerEvents={acik ? 'auto' : 'none'}
              collapsable={false}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={kapat}
                accessibilityLabel="Menüyü kapat"
              />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureDetector>
  );
}

export function AnaSayfaHamburgerDugmesi({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.hamBtn, pressed && { opacity: 0.88 }]}
      accessibilityLabel="Menü"
      hitSlop={10}
    >
      <View style={styles.hamCizgi} />
      <View style={[styles.hamCizgi, styles.hamCizgiOrta]} />
      <View style={styles.hamCizgi} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kok: {
    flex: 1,
    backgroundColor: RenkTokenlari.bg,
    overflow: 'hidden',
  },
  kokZemin: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  kokParlama: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '70%',
    height: '55%',
    opacity: 0.85,
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  ustSahne: {
    marginBottom: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.md,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  ustIc: {
    paddingHorizontal: BoslukTokenlari.md,
    paddingTop: BoslukTokenlari.sm,
  },
  ustParlama: {
    position: 'absolute',
    top: -30,
    left: -50,
    width: 180,
    height: 140,
    borderRadius: 90,
  },
  iosCam: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: RenkTokenlari.pressFill,
  },
  androidMaterial: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: RenkTokenlari.scrim,
    opacity: 0.35,
  },
  markaSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  marka: {
    ...TipografiTokenlari.h2,
    fontSize: 20,
    fontWeight: '800',
    color: RenkTokenlari.text,
    letterSpacing: -0.4,
  },
  platformRozet: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.pressFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  platformRozetYazi: {
    ...TipografiTokenlari.micro,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: RenkTokenlari.text,
  },
  profilKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 10,
    paddingRight: 12,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.pressFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: RenkTokenlari.border,
  },
  avatarHarf: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.textOnPrimary,
    fontSize: 14,
  },
  profilCopy: { flex: 1, minWidth: 0, gap: 1 },
  profilAd: {
    ...TipografiTokenlari.h2,
    fontWeight: '800',
    color: RenkTokenlari.text,
    fontSize: 14,
    letterSpacing: -0.2,
  },
  profilUser: {
    ...TipografiTokenlari.micro,
    fontSize: 11,
    color: RenkTokenlari.textMuted,
  },
  listeScroll: { flex: 1 },
  liste: {
    gap: 8,
    paddingHorizontal: BoslukTokenlari.md,
  },
  bolumEtiket: {
    ...TipografiTokenlari.micro,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: RenkTokenlari.textDim,
    marginBottom: 2,
    marginLeft: 6,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  satirPressed: {
    backgroundColor: RenkTokenlari.surface,
    transform: [{ scale: 0.985 }],
  },
  ikonKuyu: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  satirCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  satirBaslik: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    color: RenkTokenlari.text,
    letterSpacing: -0.2,
  },
  satirAlt: {
    ...TipografiTokenlari.micro,
    fontSize: 11,
    color: RenkTokenlari.textMuted,
  },
  pressed: { opacity: 0.88 },
  icerik: {
    flex: 1,
    zIndex: 2,
    backgroundColor: RenkTokenlari.bg,
    overflow: 'hidden',
    // elevation YOK — Android’de tab bar (elevation 200) üstüne çizilip
    // butonları yutmasın. Gölge yalnızca iOS shadow ile.
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 4 },
    shadowRadius: 20,
    shadowOpacity: 0.25,
    elevation: 0,
  },
  kenarIsik: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 30,
  },
  perde: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: RenkTokenlari.scrim,
    // Feed’i örter; tab bar (200) altında kalır
    zIndex: 40,
    elevation: 0,
  },
  hamBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  hamCizgi: {
    width: 17,
    height: 2,
    borderRadius: 1,
    backgroundColor: RenkTokenlari.text,
  },
  hamCizgiOrta: { width: 12 },
});
