import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CamArkaplan } from '../../../bilesenler/yuzey/CamArkaplan';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { YUZEN_TAB_ICERIK_BOSLUGU } from '../../../components/YuzenTabBosluk';

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
};

const EKRAN_W = Dimensions.get('window').width;
/** X tarzı dar çekmece — metin listesi */
const MENU_W = Math.min(Math.round(EKRAN_W * 0.78), 320);
const EDGE = 36;
const SPRING = { damping: 26, stiffness: 240, mass: 0.78 };

/**
 * Hamburger menü — X (Twitter) gibi alt alta metin satırları.
 * Modal: yüzen tab bar üstünde açılır.
 */
export function AnaSayfaCekmeceMenu({
  acik,
  onAcikDegisti,
  ogeler,
  onOgeSec,
  profil,
  onProfilPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const acikSv = useSharedValue(0);
  const surukleBaslangic = useSharedValue(0);
  const [modalAcik, setModalAcik] = useState(acik);

  useEffect(() => {
    if (acik) {
      setModalAcik(true);
      acikSv.value = withSpring(1, SPRING);
      return;
    }
    acikSv.value = withSpring(0, SPRING, (bitti) => {
      if (bitti) runOnJS(setModalAcik)(false);
    });
  }, [acik, acikSv]);

  const setAcik = useCallback(
    (v: boolean) => {
      onAcikDegisti(v);
    },
    [onAcikDegisti],
  );

  const openModalIfNeeded = useCallback(() => {
    setModalAcik(true);
  }, []);

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-28, 28])
    .onBegin(() => {
      surukleBaslangic.value = acikSv.value;
    })
    .onUpdate((e) => {
      const soldan = e.absoluteX < EDGE + 12 && surukleBaslangic.value < 0.2;
      const menuIci = surukleBaslangic.value > 0.15;
      if (!soldan && !menuIci && Math.abs(e.translationX) < 10) return;

      if (e.translationX > 8 && surukleBaslangic.value < 0.2) {
        runOnJS(openModalIfNeeded)();
      }

      const delta = e.translationX / MENU_W;
      const next = Math.min(1, Math.max(0, surukleBaslangic.value + delta));
      acikSv.value = next;
    })
    .onEnd((e) => {
      const hiz = e.velocityX;
      const ac =
        hiz > 450
          ? true
          : hiz < -450
            ? false
            : acikSv.value > 0.28;
      acikSv.value = withSpring(ac ? 1 : 0, SPRING, (bitti) => {
        if (!ac && bitti) runOnJS(setModalAcik)(false);
      });
      runOnJS(setAcik)(ac);
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (acikSv.value - 1) * MENU_W }],
  }));

  const perdeStyle = useAnimatedStyle(() => ({
    opacity: acikSv.value * 0.55,
  }));

  const edgeStyle = useAnimatedStyle(() => ({
    opacity: 1 - acikSv.value,
  }));

  const ad = profil?.displayName?.trim() || 'Kullanıcı';
  const harf = (ad[0] ?? 'K').toUpperCase();
  const altBosluk = YUZEN_TAB_ICERIK_BOSLUGU + Math.max(insets.bottom, 8);

  return (
    <>
      <View style={styles.edgeKok} pointerEvents="box-none">
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.edgeHit, { top: insets.top + 8 }, edgeStyle]}
            pointerEvents={acik || modalAcik ? 'none' : 'auto'}
          />
        </GestureDetector>
      </View>

      <Modal
        visible={modalAcik}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setAcik(false)}
      >
        <View style={styles.modalKok} pointerEvents="box-none">
          <Animated.View style={[styles.perde, perdeStyle]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setAcik(false)}
            />
          </Animated.View>

          <GestureDetector gesture={pan}>
            <Animated.View
              style={[
                styles.panel,
                {
                  width: MENU_W,
                  paddingTop: insets.top + 8,
                  paddingBottom: Math.max(insets.bottom, 12),
                },
                panelStyle,
              ]}
              pointerEvents="auto"
            >
              <CamArkaplan
                intensity={48}
                tint="dark"
                style={StyleSheet.absoluteFill}
                fallbackColor={RenkTokenlari.bgElevated}
                pointerEvents="none"
              />
              <LinearGradient
                colors={['#1A1224', '#121018']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.panelIc} pointerEvents="box-none">
              <View style={styles.ustBar}>
                <Pressable
                  onPress={() => {
                    setAcik(false);
                    onProfilPress();
                  }}
                  style={({ pressed }) => [
                    styles.profilBlok,
                    pressed && styles.pressed,
                  ]}
                  accessibilityLabel="Profilime git"
                >
                  {profil?.avatarUrl ? (
                    <Image
                      source={{ uri: profil.avatarUrl }}
                      style={styles.avatar}
                    />
                  ) : (
                    <LinearGradient
                      colors={[...RenkTokenlari.gradientPrimary]}
                      style={styles.avatar}
                    >
                      <Text style={styles.avatarHarf}>{harf}</Text>
                    </LinearGradient>
                  )}
                  <View style={styles.profilCopy}>
                    <Text style={styles.profilAd} numberOfLines={1}>
                      {ad}
                    </Text>
                    {profil?.username ? (
                      <Text style={styles.profilUser} numberOfLines={1}>
                        @{profil.username}
                      </Text>
                    ) : (
                      <Text style={styles.profilUser}>Profili görüntüle</Text>
                    )}
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => setAcik(false)}
                  style={styles.kapat}
                  accessibilityLabel="Menüyü kapat"
                  hitSlop={8}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={RenkTokenlari.textMuted}
                  />
                </Pressable>
              </View>

              <View style={styles.cizgi} />

              <ScrollView
                style={styles.listeScroll}
                contentContainerStyle={[
                  styles.liste,
                  { paddingBottom: altBosluk },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {ogeler.map((oge) => (
                  <Pressable
                    key={oge.key}
                    onPress={() => {
                      setAcik(false);
                      onOgeSec(oge.href);
                    }}
                    style={({ pressed }) => [
                      styles.satir,
                      pressed && styles.satirPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${oge.baslik}. ${oge.alt}`}
                  >
                    <Ionicons
                      name={oge.icon}
                      size={24}
                      color={RenkTokenlari.text}
                      style={styles.satirIkon}
                    />
                    <View style={styles.satirMetin}>
                      <Text style={styles.satirBaslik} numberOfLines={1}>
                        {oge.baslik}
                      </Text>
                      {oge.alt ? (
                        <Text style={styles.satirAlt} numberOfLines={1}>
                          {oge.alt}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </Modal>
    </>
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
  edgeKok: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
  },
  modalKok: {
    flex: 1,
  },
  edgeHit: {
    position: 'absolute',
    left: 0,
    width: EDGE,
    height: 140,
    zIndex: 40,
  },
  perde: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    zIndex: 50,
    elevation: 8,
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 60,
    elevation: 28,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: BoslukTokenlari.lg,
    overflow: 'hidden',
    backgroundColor: RenkTokenlari.bgElevated,
  },
  panelIc: {
    flex: 1,
    zIndex: 2,
    elevation: 6,
  },
  ustBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: BoslukTokenlari.md,
  },
  profilBlok: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingRight: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHarf: {
    ...TipografiTokenlari.h2,
    color: '#12040C',
    fontSize: 20,
  },
  profilCopy: { flex: 1, minWidth: 0, gap: 2 },
  profilAd: {
    ...TipografiTokenlari.h2,
    fontWeight: '800',
    color: RenkTokenlari.text,
    fontSize: 18,
  },
  profilUser: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  kapat: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cizgi: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: BoslukTokenlari.sm,
  },
  listeScroll: { flex: 1 },
  liste: {
    paddingTop: 4,
    gap: 0,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: YaricapTokenlari.md,
  },
  satirPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  satirIkon: {
    width: 28,
    textAlign: 'center',
  },
  satirMetin: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  satirBaslik: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: RenkTokenlari.text,
    letterSpacing: -0.2,
  },
  satirAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  pressed: { opacity: 0.85 },
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
