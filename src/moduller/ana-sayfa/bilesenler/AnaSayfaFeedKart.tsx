/**
 * Feed canlı kartı — 2'li pencere. Yayın (pembe) ve ses odası (mint).
 * Ağır ken-burns / tarama / equalizer yok; aura yalnızca aktif kartlarda.
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AnaSayfaCanliNokta } from './AnaSayfaCanliNokta';
import { FeedPencereCerceve } from './FeedPencereCerceve';
import { FEED_KART_ORANI } from '../sabitler/FeedKartOrani';
import type { FeedOggesi } from '../okuma/AnaSayfaIcerikleriniGetir';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

const MODE_LABEL: Record<string, string> = {
  party: 'Parti',
  dating: 'Flört',
  karaoke: 'Karaoke',
  game: 'Oyun',
  private: 'Özel',
  solo: 'Tekli',
  pk: 'PK',
};

type Props = {
  oge: FeedOggesi;
  onPress: () => void;
  index?: number;
  /** Aura / nabız — yalnızca ilk görünür satırlarda */
  aktif?: boolean;
};

function sayacBicimle(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

export function AnaSayfaFeedKart({ oge, onPress, index = 0, aktif = false }: Props) {
  const ses = oge.tur === 'oda';
  const hostAd =
    oge.host?.display_name ??
    (oge.host?.username ? `@${oge.host.username}` : 'Ev sahibi');
  const mod = oge.mode && MODE_LABEL[oge.mode] ? MODE_LABEL[oge.mode] : null;

  const ana = ses ? RenkTokenlari.mint : oge.popular ? RenkTokenlari.accent : RenkTokenlari.primary;
  const anaYumusak = ses
    ? RenkTokenlari.mint
    : oge.popular
      ? '#FFD36B'
      : RenkTokenlari.primarySoft;
  const aura = ses
    ? (['#3DCFB0', '#6FE3FF'] as const)
    : oge.popular
      ? (['#F0B429', '#E84091'] as const)
      : (['#E84091', '#C43BFF'] as const);

  return (
    <View style={styles.dis}>
      <FeedPencereCerceve renkler={aura} aktif={aktif} index={index}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${oge.title}. ${ses ? 'Ses odası' : 'Canlı yayın'}`}
          style={styles.press}
        >
          <View style={styles.kart}>
            {oge.cover_url ? (
              <Image
                source={{ uri: oge.cover_url }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={StyleSheet.absoluteFill}>
                <LinearGradient
                  colors={[...RenkTokenlari.gradientPlaceholder]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.bosIkon}>
                  <Ionicons
                    name={ses ? 'mic' : 'videocam'}
                    size={38}
                    color={`${anaYumusak}55`}
                  />
                </View>
              </View>
            )}

            <LinearGradient
              colors={[...RenkTokenlari.overlayGradient]}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['transparent', `${ana}2E`]}
              start={{ x: 0, y: 0.4 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <View style={styles.ust}>
              <View style={[styles.rozet, { borderColor: `${anaYumusak}80` }]}>
                <AnaSayfaCanliNokta boyut={5} renk={anaYumusak} nabiz={aktif} />
                <Text style={[styles.rozetYazi, { color: anaYumusak }]}>
                  {ses ? 'SES' : 'CANLI'}
                </Text>
              </View>
              {oge.listener_count > 0 ? (
                <View style={styles.sayac}>
                  <Ionicons
                    name={ses ? 'headset' : 'eye'}
                    size={10}
                    color={RenkTokenlari.textOnOverlay}
                  />
                  <Text style={styles.sayacYazi}>{sayacBicimle(oge.listener_count)}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.alt}>
              {oge.popular && !ses ? (
                <View style={styles.populer}>
                  <Ionicons name="flame" size={10} color="#FFD36B" />
                  <Text style={styles.populerYazi}>Popüler</Text>
                </View>
              ) : mod ? (
                <Text style={[styles.mod, { color: anaYumusak }]}>{mod.toUpperCase()}</Text>
              ) : null}
              <Text style={styles.baslik} numberOfLines={2}>
                {oge.title}
              </Text>
              <View style={styles.host}>
                <View style={[styles.avatarHalka, { borderColor: `${anaYumusak}AA` }]}>
                  {oge.host?.avatar_url ? (
                    <Image source={{ uri: oge.host.avatar_url }} style={styles.avatar} />
                  ) : (
                    <LinearGradient
                      colors={[...RenkTokenlari.gradientPrimary]}
                      style={styles.avatar}
                    >
                      <Ionicons name="person" size={9} color={RenkTokenlari.textOnPrimary} />
                    </LinearGradient>
                  )}
                </View>
                <Text style={styles.hostAd} numberOfLines={1}>
                  {hostAd}
                </Text>
                {oge.host?.level && oge.host.level > 1 ? (
                  <View style={styles.seviye}>
                    <Text style={styles.seviyeYazi}>Lv{oge.host.level}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </Pressable>
      </FeedPencereCerceve>
    </View>
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
  },
  press: {
    borderRadius: YaricapTokenlari.lg,
  },
  kart: {
    aspectRatio: FEED_KART_ORANI,
    overflow: 'hidden',
    borderRadius: YaricapTokenlari.lg - 2,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  bosIkon: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ust: {
    position: 'absolute',
    top: BoslukTokenlari.sm,
    left: BoslukTokenlari.sm,
    right: BoslukTokenlari.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: RenkTokenlari.chipFill,
  },
  rozetYazi: {
    ...TipografiTokenlari.micro,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sayac: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.chipFill,
  },
  sayacYazi: {
    ...TipografiTokenlari.micro,
    fontSize: 9,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '700',
  },
  alt: {
    position: 'absolute',
    left: BoslukTokenlari.sm,
    right: BoslukTokenlari.sm,
    bottom: BoslukTokenlari.sm,
    gap: 4,
  },
  populer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
  },
  populerYazi: {
    ...TipografiTokenlari.micro,
    fontSize: 9,
    color: '#FFD36B',
    fontWeight: '700',
  },
  mod: {
    ...TipografiTokenlari.micro,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  baslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '700',
    lineHeight: 16,
  },
  host: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  avatarHalka: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAd: {
    ...TipografiTokenlari.micro,
    flex: 1,
    color: RenkTokenlari.textOnOverlay,
    opacity: 0.82,
    fontWeight: '600',
  },
  seviye: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: RenkTokenlari.pressFill,
  },
  seviyeYazi: {
    ...TipografiTokenlari.micro,
    fontSize: 8,
    color: RenkTokenlari.textOnOverlay,
    opacity: 0.75,
    fontWeight: '700',
  },
});
