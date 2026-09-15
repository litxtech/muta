import React, { useMemo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { CamArkaplan } from '../bilesenler/yuzey/CamArkaplan';
import { RenkTokenlari } from '../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari, YaricapTokenlari } from '../tasarim-sistemi/BoslukVeYaricapTokenlari';

export { YUZEN_TAB_ICERIK_BOSLUGU } from './YuzenTabBosluk';

type TabIcon = keyof typeof Ionicons.glyphMap;

type TabMeta = {
  label: string;
  active: TabIcon;
  idle: TabIcon;
};

const HIDDEN_TABS = new Set(['cihazlar', 'wallet', 'rooms']);

/** Sıra: Ana · Durum | + | Mesaj · Profil */
const TAB_META: Record<string, TabMeta> = {
  index: { label: 'Ana', active: 'home', idle: 'home-outline' },
  durum: { label: 'Durum', active: 'images', idle: 'images-outline' },
  rooms: { label: 'Odalar', active: 'headset', idle: 'headset-outline' },
  create: { label: 'Oluştur', active: 'add', idle: 'add' },
  messages: { label: 'Mesaj', active: 'chatbubbles', idle: 'chatbubbles-outline' },
  profile: { label: 'Profil', active: 'person', idle: 'person-outline' },
};

const LEFT_ORDER = ['index', 'durum'] as const;
const RIGHT_ORDER = ['messages', 'profile'] as const;

/**
 * Modern yüzen tab — artı her zaman ortada; cihazlar/wallet tabda yok.
 */
export function YuzenTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { profile } = useAuth();
  const bottomGap = Math.max(insets.bottom, BoslukTokenlari.sm) + BoslukTokenlari.sm;
  const avatarUrl = profile?.avatar_url ?? null;

  const byName = useMemo(() => {
    const map = new Map<string, (typeof state.routes)[number]>();
    for (const route of state.routes) {
      if (HIDDEN_TABS.has(route.name)) continue;
      const href = (descriptors[route.key]?.options as { href?: string | null })?.href;
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
      if (!route) return <View key={name} style={styles.item} />;
      const focused = state.routes[state.index]?.key === route.key;
      const isProfile = name === 'profile';
      const meta = TAB_META[name];
      const color = focused ? RenkTokenlari.primarySoft : RenkTokenlari.textDim;
      const options = descriptors[route.key]?.options;
      const a11y =
        options?.tabBarAccessibilityLabel ?? options?.title ?? meta?.label ?? name;

      return (
        <Pressable
          key={route.key}
          accessibilityRole="button"
          accessibilityState={focused ? { selected: true } : {}}
          accessibilityLabel={a11y}
          onPress={() => go(route)}
          style={styles.item}
        >
          <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
            {isProfile && avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={[styles.avatar, focused && styles.avatarActive]}
              />
            ) : (
              <Ionicons
                name={focused ? meta.active : meta.idle}
                size={22}
                color={color}
              />
            )}
          </View>
          <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
            {meta.label}
          </Text>
        </Pressable>
      );
    });

  const createRoute = byName.get('create');
  const createFocused = createRoute
    ? state.routes[state.index]?.key === createRoute.key
    : false;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: bottomGap }]}>
      <View style={styles.shell}>
        <CamArkaplan
          intensity={Platform.OS === 'ios' ? 60 : 42}
          tint="dark"
          style={StyleSheet.absoluteFill}
          fallbackColor="rgba(18, 16, 24, 0.96)"
        />
        <View style={styles.glassOverlay} />
        <View style={styles.row}>
          <View style={styles.side}>{renderSide(LEFT_ORDER)}</View>

          <View style={styles.center}>
            {createRoute ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={createFocused ? { selected: true } : {}}
                accessibilityLabel="Ses odası aç"
                onPress={() => go(createRoute)}
                style={styles.createHit}
              >
                <LinearGradient
                  colors={[...RenkTokenlari.gradientPrimary]}
                  style={styles.createBtn}
                >
                  <Ionicons name="add" size={28} color="#12040C" />
                </LinearGradient>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.side}>{renderSide(RIGHT_ORDER)}</View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: BoslukTokenlari.lg,
    zIndex: 40,
    elevation: 40,
  },
  shell: {
    height: 72,
    borderRadius: YaricapTokenlari.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgGlass,
  },
  glassOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(18, 16, 24, 0.4)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  center: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: YaricapTokenlari.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  avatarActive: {
    borderColor: RenkTokenlari.primarySoft,
  },
  label: {
    ...TipografiTokenlari.micro,
    fontSize: 10,
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
    width: 52,
    height: 52,
    borderRadius: YaricapTokenlari.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
