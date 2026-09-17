/**
 * Yüzen tab çubuğu — Ana · Durum | + | Mesaj · Profil
 *
 * KALICI iOS DÜZELTME:
 * Custom tabBar + position:absolute → çıkış/geri dönüşte parent width=0,
 * butonlar sola üst üste biner. Bu yüzden tab bar navigator AKIŞINDA
 * (in-flow); yatay ölçüler her zaman piksel.
 */

import React, { memo, useCallback, useContext, useMemo, useRef } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { BottomTabBarHeightCallbackContext } from 'expo-router/build/react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { CamArkaplan } from '../bilesenler/yuzey/CamArkaplan';
import { RenkTokenlari } from '../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useTemayaAboneOl } from '../tasarim-sistemi/tema/useTemayaAboneOl';
import {
  YUZEN_TAB_SHELL_H,
  yuzenTabBarToplamYukseklik,
} from './YuzenTabBosluk';

export { YUZEN_TAB_ICERIK_BOSLUGU } from './YuzenTabBosluk';

type TabIcon = keyof typeof Ionicons.glyphMap;

type TabMeta = {
  label: string;
  active: TabIcon;
  idle: TabIcon;
};

const HIDDEN_TABS = new Set(['cihazlar', 'wallet', 'rooms']);

const TAB_META: Record<string, TabMeta> = {
  index: { label: 'Ana', active: 'home', idle: 'home-outline' },
  durum: { label: 'Durum', active: 'images', idle: 'images-outline' },
  create: { label: 'Oluştur', active: 'add', idle: 'add' },
  messages: {
    label: 'Mesaj',
    active: 'chatbubbles',
    idle: 'chatbubbles-outline',
  },
  profile: { label: 'Profil', active: 'person', idle: 'person-outline' },
};

const LEFT_ORDER = ['index', 'durum'] as const;
const RIGHT_ORDER = ['messages', 'profile'] as const;

const CENTER_W = 58;
const CREATE_SIZE = 48;
const ICON_SIZE = 22;
const H_PAD = BoslukTokenlari.lg;
const SIDE_SLOTS = 2;
const FLOAT_TOP = 6;

function baslangicGenislik(): number {
  const w = Dimensions.get('window').width;
  return w > 0 ? w : 390;
}

function YuzenTabBarInner({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  useTemayaAboneOl();
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const { width: windowWidth } = useWindowDimensions();
  const { profile } = useAuth();

  // Çıkış / resume’da width anlık 0 olursa son geçerli değeri koru
  const sonGenislik = useRef(baslangicGenislik());
  if (windowWidth > 0) {
    sonGenislik.current = windowWidth;
  }
  const screenW = sonGenislik.current;

  const bottomGap =
    Math.max(insets.bottom, BoslukTokenlari.sm) + BoslukTokenlari.xs;
  const shellW = Math.max(screenW - H_PAD * 2, CENTER_W + 80);
  const sideW = Math.max((shellW - CENTER_W) / 2, 40);
  const itemW = Math.max(sideW / SIDE_SLOTS, 40);
  const avatarUrl = profile?.avatar_url ?? null;

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0) onHeightChange?.(h);
    },
    [onHeightChange],
  );

  const byName = useMemo(() => {
    const map = new Map<string, (typeof state.routes)[number]>();
    for (const route of state.routes) {
      if (HIDDEN_TABS.has(route.name)) continue;
      const href = (descriptors[route.key]?.options as { href?: string | null })
        ?.href;
      if (href === null) continue;
      map.set(route.name, route);
    }
    return map;
  }, [state.routes, descriptors]);

  const go = (route: (typeof state.routes)[number]) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    const focused = state.routes[state.index]?.key === route.key;
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const renderSide = (names: readonly string[]) =>
    names.map((name) => {
      const route = byName.get(name);
      if (!route) {
        return (
          <View key={name} style={[styles.item, { width: itemW }]} />
        );
      }
      const focused = state.routes[state.index]?.key === route.key;
      const isProfile = name === 'profile';
      const meta = TAB_META[name];
      if (!meta) {
        return (
          <View key={route.key} style={[styles.item, { width: itemW }]} />
        );
      }
      const color = focused
        ? RenkTokenlari.primarySoft
        : RenkTokenlari.textDim;
      const options = descriptors[route.key]?.options;
      const a11y =
        options?.tabBarAccessibilityLabel ??
        options?.title ??
        meta.label;

      return (
        <Pressable
          key={route.key}
          accessibilityRole="button"
          accessibilityState={focused ? { selected: true } : {}}
          accessibilityLabel={a11y}
          onPress={() => go(route)}
          style={[styles.item, { width: itemW }]}
          hitSlop={6}
        >
          <View style={styles.iconWrap} pointerEvents="none">
            {isProfile && avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={[styles.avatar, focused && styles.avatarActive]}
              />
            ) : (
              <Ionicons
                name={focused ? meta.active : meta.idle}
                size={ICON_SIZE}
                color={color}
              />
            )}
          </View>
          <Text
            style={[styles.label, focused && styles.labelActive]}
            numberOfLines={1}
            pointerEvents="none"
          >
            {meta.label}
          </Text>
        </Pressable>
      );
    });

  const createRoute = byName.get('create');
  const createFocused = createRoute
    ? state.routes[state.index]?.key === createRoute.key
    : false;

  // Yükseklik bildirimi — navigator rezervasyonu
  const toplamH = yuzenTabBarToplamYukseklik(insets.bottom);

  return (
    <View
      onLayout={onLayout}
      collapsable={false}
      style={[
        styles.wrap,
        {
          width: screenW,
          minHeight: toplamH,
          paddingBottom: bottomGap,
          paddingHorizontal: H_PAD,
        },
      ]}
    >
      <View
        collapsable={false}
        style={[styles.shell, { width: shellW, height: YUZEN_TAB_SHELL_H }]}
      >
        <View
          pointerEvents="none"
          collapsable={false}
          style={[
            styles.blurClip,
            {
              width: shellW,
              height: YUZEN_TAB_SHELL_H,
              borderRadius: YaricapTokenlari.xl,
            },
          ]}
        >
          <CamArkaplan
            intensity={Platform.OS === 'ios' ? 56 : 40}
            style={StyleSheet.absoluteFill}
            fallbackColor={RenkTokenlari.tabBarFallback}
            pointerEvents="none"
          />
          <View
            style={[
              styles.glassOverlay,
              { backgroundColor: RenkTokenlari.tabBarOverlay },
            ]}
            pointerEvents="none"
          />
        </View>

        <View
          collapsable={false}
          style={[
            styles.hit,
            { width: shellW, height: YUZEN_TAB_SHELL_H },
          ]}
        >
          <View style={[styles.side, { width: sideW }]}>
            {renderSide(LEFT_ORDER)}
          </View>

          <View style={[styles.center, { width: CENTER_W }]}>
            {createRoute ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={createFocused ? { selected: true } : {}}
                accessibilityLabel="Oluştur"
                onPress={() => go(createRoute)}
                style={styles.createHit}
                hitSlop={10}
              >
                <LinearGradient
                  colors={[...RenkTokenlari.gradientPrimary]}
                  style={styles.createBtn}
                  pointerEvents="none"
                >
                  <Ionicons
                    name="add"
                    size={26}
                    color={RenkTokenlari.textOnPrimary}
                  />
                </LinearGradient>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.side, { width: sideW }]}>
            {renderSide(RIGHT_ORDER)}
          </View>
        </View>
      </View>
    </View>
  );
}

export const YuzenTabBar = memo(YuzenTabBarInner);

const styles = StyleSheet.create({
  wrap: {
    // IN-FLOW — absolute yok. Parent kolon tam genişlik verir; çıkışta bozulmaz.
    alignSelf: 'stretch',
    paddingTop: FLOAT_TOP,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  shell: {
    borderRadius: YaricapTokenlari.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgGlass,
  },
  blurClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    height: YUZEN_TAB_SHELL_H,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    height: YUZEN_TAB_SHELL_H,
  },
  item: {
    height: YUZEN_TAB_SHELL_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingTop: 2,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: YaricapTokenlari.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  avatarActive: {
    borderColor: RenkTokenlari.primarySoft,
  },
  label: {
    ...TipografiTokenlari.micro,
    fontSize: 10,
    lineHeight: 12,
    color: RenkTokenlari.textDim,
    fontWeight: '600',
  },
  labelActive: {
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  createHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtn: {
    width: CREATE_SIZE,
    height: CREATE_SIZE,
    borderRadius: YaricapTokenlari.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
