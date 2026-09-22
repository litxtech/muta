/**
 * Root tab chrome — Tabs navigator DIŞINDA.
 *
 * Neden: iOS fullScreenModal (ses odası) alttaki Tabs’ı freeze eder;
 * custom tabBar Tabs içindeyse çıkınca layout/dokunuş bozulur.
 * Bu bileşen root’ta yaşar → oda gir/çık etkilemez.
 */

import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  DeviceEventEmitter,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useMesajOkunmamis } from '../moduller/mesajlasma/baglam/MesajOkunmamisSaglayici';
import { MedyaUriGuvenli } from '../moduller/mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { RenkTokenlari } from '../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../tasarim-sistemi/TipografiTokenlari';
import { useTemayaAboneOl } from '../tasarim-sistemi/tema/useTemayaAboneOl';
import { kullaniciTemaKodunuAl } from '../tasarim-sistemi/tema/TemaDurumu';
import {
  YUZEN_TAB_SHELL_H,
  guvenliTabAltInset,
  yuzenTabBarToplamYukseklik,
} from './YuzenTabBosluk';
import {
  TAB_BAR_ELEVATION,
  TAB_BAR_Z_INDEX,
  TabBarGuvenliGenislik,
  TabBarGuvenlikKur,
  TabBarSyncDinle,
} from './tab-navigasyon/TabBarGuvenlik';
import {
  GORUNUR_TAB_SIRASI,
  type GorunurTabAdi,
} from './tab-navigasyon/GorunurTabSirasi';

export { YUZEN_TAB_ICERIK_BOSLUGU } from './YuzenTabBosluk';

type TabIcon = keyof typeof Ionicons.glyphMap;

const TAB_META: Record<
  GorunurTabAdi,
  { label: string; active: TabIcon; idle: TabIcon }
> = {
  index: { label: 'Ana', active: 'home', idle: 'home-outline' },
  durum: { label: 'Durum', active: 'images', idle: 'images-outline' },
  create: {
    label: 'Oluştur',
    active: 'add-circle',
    idle: 'add-circle-outline',
  },
  messages: {
    label: 'Mesaj',
    active: 'chatbubble-ellipses',
    idle: 'chatbubble-ellipses-outline',
  },
  profile: {
    label: 'Profil',
    active: 'person-circle',
    idle: 'person-circle-outline',
  },
};

const HREF: Record<GorunurTabAdi, string> = {
  index: '/(tabs)',
  durum: '/(tabs)/durum',
  create: '/(tabs)/create',
  messages: '/(tabs)/messages',
  profile: '/(tabs)/profile',
};

/** Ana sekmesine tekrar basınca feed en üste — index dinler */
export const ANA_TAB_YENIDEN_EVENT = 'tamuso.anaTabYeniden';

const ICON_SIZE = 26;
const CREATE_SIZE = 30;
const AVATAR = 26;

function tabsIcindeMi(segments: string[]): boolean {
  return segments[0] === '(tabs)';
}

/**
 * Görünür sekme adı. wallet / rooms / cihazlar gibi gizli sekmelerde
 * null döner — Ana'yı seçili göstermemek kritik (aksi halde Ana'ya
 * basmak no-op olur / navigasyon karışır).
 */
function aktifTabAdi(segments: string[]): GorunurTabAdi | null {
  if (!tabsIcindeMi(segments)) return null;
  const ad = (segments[1] ?? 'index') as string;
  if ((GORUNUR_TAB_SIRASI as readonly string[]).includes(ad)) {
    return ad as GorunurTabAdi;
  }
  return null;
}

/** Tab geçişi — IAP / AppState sonrası navigate fail olursa replace */
function tabGit(href: string) {
  try {
    router.navigate(href as never);
  } catch {
    try {
      router.replace(href as never);
    } catch {
      /* ignore */
    }
  }
}

/** Modal / tam ekran — tab chrome üstüne binmesin */
function tamEkranMu(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname.includes('/room/')) return true;
  if (pathname.includes('/gorusme/')) return true;
  if (/\/canli\/[^/]+/.test(pathname)) return true;
  return false;
}

function YuzenTabBarIc() {
  useTemayaAboneOl();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const pathname = usePathname();
  const { width: windowWidth } = useWindowDimensions();
  const { profile, session } = useAuth();
  const { okunmamis: mesajOkunmamis } = useMesajOkunmamis();
  const avatarUrl = MedyaUriGuvenli(profile?.avatar_url);
  const [, setTick] = useState(0);
  const acikTema = kullaniciTemaKodunuAl() === 'acik';

  useEffect(() => {
    TabBarGuvenlikKur();
    return TabBarSyncDinle(() => setTick((n) => n + 1));
  }, []);

  const segList = useMemo(() => segments.map(String), [segments]);
  const focused = aktifTabAdi(segList);
  // Cüzdan/odalar gizli olsa da tab bar kalsın (focused null olabilir)
  const gorunur =
    tabsIcindeMi(segList) && !!session && !tamEkranMu(pathname);

  const barW = TabBarGuvenliGenislik(windowWidth);
  const bottomPad = guvenliTabAltInset(insets.bottom);
  const toplamH = yuzenTabBarToplamYukseklik(insets.bottom);

  if (!gorunur) {
    return null;
  }

  return (
    <View
      collapsable={false}
      pointerEvents="box-none"
      style={styles.anchor}
    >
      <View
        collapsable={false}
        pointerEvents="auto"
        style={[
          styles.bar,
          {
            width: barW,
            height: toplamH,
            paddingBottom: bottomPad,
            backgroundColor: acikTema
              ? RenkTokenlari.tabBarOverlay
              : RenkTokenlari.tabBarFallback,
            borderTopColor: RenkTokenlari.border,
          },
        ]}
      >
        <View style={[styles.row, { width: barW }]}>
          {GORUNUR_TAB_SIRASI.map((name) => {
            const meta = TAB_META[name];
            const secili = focused === name;
            const isCreate = name === 'create';
            const isProfile = name === 'profile';
            const isMessages = name === 'messages';
            const color = secili
              ? RenkTokenlari.primarySoft
              : RenkTokenlari.textMuted;
            const badge =
              isMessages && !secili && mesajOkunmamis > 0
                ? mesajOkunmamis
                : 0;

            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityState={secili ? { selected: true } : {}}
                accessibilityLabel={
                  badge > 0
                    ? `${meta.label}, ${badge} okunmamış`
                    : meta.label
                }
                onPress={() => {
                  if (secili) {
                    if (name === 'index') {
                      DeviceEventEmitter.emit(ANA_TAB_YENIDEN_EVENT);
                    }
                    return;
                  }
                  tabGit(HREF[name]);
                }}
                style={styles.slot}
                hitSlop={8}
              >
                <View style={[styles.iconWrap, isCreate && styles.createWrap]}>
                  {isCreate ? (
                    <LinearGradient
                      colors={[...RenkTokenlari.gradientPrimary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.createBtn,
                        secili && styles.createBtnAktif,
                      ]}
                    >
                      <Ionicons
                        name="add"
                        size={CREATE_SIZE}
                        color={RenkTokenlari.textOnPrimary}
                      />
                    </LinearGradient>
                  ) : isProfile && avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={[
                        styles.avatar,
                        {
                          borderColor: secili
                            ? RenkTokenlari.primarySoft
                            : 'transparent',
                          borderWidth: secili ? 2 : 1.5,
                        },
                      ]}
                    />
                  ) : (
                    <Ionicons
                      name={secili ? meta.active : meta.idle}
                      size={ICON_SIZE}
                      color={color}
                    />
                  )}
                  {badge > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {badge > 99 ? '99+' : String(badge)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export const YuzenTabBar = memo(YuzenTabBarIc);

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: TAB_BAR_Z_INDEX,
    elevation: TAB_BAR_ELEVATION,
    alignItems: 'center',
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    alignSelf: 'center',
  },
  row: {
    height: YUZEN_TAB_SHELL_H,
    flexDirection: 'row',
    alignItems: 'center',
  },
  slot: {
    flex: 1,
    height: YUZEN_TAB_SHELL_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createWrap: {
    width: 48,
    height: 48,
    marginTop: -10,
  },
  createBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: RenkTokenlari.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  createBtnAktif: {
    shadowOpacity: 0.55,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: RenkTokenlari.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: RenkTokenlari.bg,
  },
  badgeText: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
    lineHeight: 12,
  },
});
