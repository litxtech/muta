/**
 * Canlı yayın kartı — Twitch/YouTube tarzı profesyonel kapak + Muta imza.
 */

import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AnaSayfaCanliNokta } from '../../ana-sayfa/bilesenler/AnaSayfaCanliNokta';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export const CANLI_KATEGORI_ETIKET: Record<string, string> = {
  sohbet: 'Sohbet',
  oyun: 'Oyun',
  muzik: 'Müzik',
  dans: 'Dans',
  eglence: 'Eğlence',
  egitim: 'Eğitim',
  flort: 'Flört',
  pk: 'PK Arena',
};

export type CanliYayinKartVeri = {
  id: string;
  title: string;
  category?: string | null;
  topic?: string | null;
  mode?: string | null;
  viewer_count?: number | null;
  like_count?: number | null;
  gift_count?: number | null;
  total_coins_earned?: number | null;
  score?: number | null;
  host?: {
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
};

type Props = {
  item: CanliYayinKartVeri;
  onPress: () => void;
  index?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CanliYayinKarti({ item, onPress, index = 0 }: Props) {
  const olcek = useSharedValue(1);
  const host = item.host;
  const ad =
    host?.display_name?.trim() ||
    host?.username?.trim() ||
    'Yayıncı';
  const kapak = host?.avatar_url ?? null;
  const viewers = item.viewer_count ?? 0;
  const gifts = item.gift_count ?? 0;
  const coins = item.total_coins_earned ?? item.score ?? 0;
  const likes = item.like_count ?? 0;
  const kategori =
    (item.category && CANLI_KATEGORI_ETIKET[item.category]) ||
    item.topic?.trim() ||
    null;

  const stil = useAnimatedStyle(() => ({
    transform: [{ scale: olcek.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        olcek.value = withSpring(0.975, { damping: 16, stiffness: 280 });
      }}
      onPressOut={() => {
        olcek.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={[styles.press, stil]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, canlı yayın`}
    >
      <View style={styles.card}>
        {kapak ? (
          <Image source={{ uri: kapak }} style={styles.kapak} />
        ) : (
          <LinearGradient
            colors={[...RenkTokenlari.gradientPlaceholder]}
            style={styles.kapak}
          />
        )}
        <LinearGradient
          colors={[...RenkTokenlari.overlayGradient]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.top}>
          <View style={styles.livePill}>
            <AnaSayfaCanliNokta boyut={5} />
            <Text style={styles.liveText}>YAYIN</Text>
            <Ionicons
              name="videocam"
              size={10}
              color={RenkTokenlari.primarySoft}
            />
          </View>
          <View style={styles.viewerChip}>
            <Ionicons name="eye" size={11} color={RenkTokenlari.mint} />
            <Text style={styles.viewerText}>{viewers}</Text>
          </View>
        </View>

        {kategori ? (
          <View style={styles.catChip}>
            <Text style={styles.catText}>{kategori}</Text>
          </View>
        ) : null}

        <View style={styles.bottom}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.hostRow}>
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                style={styles.avatar}
              >
                <Ionicons name="person" size={10} color="#12040C" />
              </LinearGradient>
              <Text style={styles.host} numberOfLines={1}>
                {ad}
              </Text>
            </View>
            <View style={styles.stats}>
              {likes > 0 ? (
                <Text style={styles.stat}>♥ {likes}</Text>
              ) : null}
              {gifts > 0 ? (
                <Text style={styles.stat}>🎁 {gifts}</Text>
              ) : null}
              {coins > 0 ? (
                <Text style={styles.stat}>🪙 {coins}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  card: {
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.28)',
    aspectRatio: 16 / 10,
    justifyContent: 'space-between',
    backgroundColor: RenkTokenlari.bgCard,
  },
  kapak: { ...StyleSheet.absoluteFillObject },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.md,
    paddingTop: BoslukTokenlari.md,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.chipFill,
  },
  liveText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  viewerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.chipFill,
  },
  viewerText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  catChip: {
    alignSelf: 'flex-start',
    marginLeft: BoslukTokenlari.md,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(232,64,145,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,64,145,0.4)',
  },
  catText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  bottom: {
    paddingHorizontal: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.md,
    gap: 8,
  },
  title: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  host: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  stat: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
});
