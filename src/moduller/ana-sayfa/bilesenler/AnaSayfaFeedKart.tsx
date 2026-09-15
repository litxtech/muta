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
import { AnaSayfaCanliNokta } from './AnaSayfaCanliNokta';
import { AnaSayfaSesCubuklari } from './AnaSayfaSesCubuklari';
import type { FeedOggesi } from '../okuma/AnaSayfaIcerikleriniGetir';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  GolgeTokenlari,
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
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Ana akım canlı kart — 2’li grid, premium ses hissi */
export function AnaSayfaFeedKart({ oge, onPress, index = 0 }: Props) {
  const olcek = useSharedValue(1);
  const hostAd =
    oge.host?.display_name ??
    (oge.host?.username ? `@${oge.host.username}` : 'Ev sahibi');
  const mod =
    oge.mode && MODE_LABEL[oge.mode]
      ? MODE_LABEL[oge.mode]
      : oge.tur === 'canli'
        ? 'Yayın'
        : null;

  const stil = useAnimatedStyle(() => ({
    transform: [{ scale: olcek.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        olcek.value = withSpring(0.97, { damping: 16, stiffness: 280 });
      }}
      onPressOut={() => {
        olcek.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={[styles.press, stil]}
    >
        <View style={[styles.kart, oge.popular && styles.kartPopuler]}>
          {oge.cover_url ? (
            <Image source={{ uri: oge.cover_url }} style={styles.kapak} />
          ) : (
            <LinearGradient
              colors={
                index % 2 === 0
                  ? ['#3A1A38', '#1A1226', '#120E1A']
                  : ['#2A1840', '#16101F', '#100C18']
              }
              style={styles.kapak}
            />
          )}
          <LinearGradient
            colors={[
              'rgba(10,6,16,0.08)',
              'rgba(10,6,16,0.45)',
              'rgba(8,4,14,0.97)',
            ]}
            locations={[0, 0.38, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.ust}>
            <View style={styles.canli}>
              <AnaSayfaCanliNokta boyut={5} />
              <Text style={styles.canliYazi}>
                {oge.tur === 'canli' ? 'YAYIN' : 'CANLI'}
              </Text>
              {index < 8 ? (
                <AnaSayfaSesCubuklari
                  yukseklik={9}
                  renk={RenkTokenlari.primarySoft}
                />
              ) : null}
            </View>
            {oge.popular ? (
              <View style={styles.populerRozet}>
                <Text style={styles.populer}>Popüler</Text>
              </View>
            ) : mod ? (
              <Text style={styles.mod}>{mod}</Text>
            ) : null}
          </View>

          <View style={styles.alt}>
            <Text style={styles.baslik} numberOfLines={2}>
              {oge.title}
            </Text>
            {oge.topic ? (
              <Text style={styles.topic} numberOfLines={1}>
                {oge.topic}
              </Text>
            ) : null}
            <View style={styles.meta}>
              <View style={styles.host}>
                {oge.host?.avatar_url ? (
                  <Image
                    source={{ uri: oge.host.avatar_url }}
                    style={styles.avatar}
                  />
                ) : (
                  <LinearGradient
                    colors={[...RenkTokenlari.gradientPrimary]}
                    style={styles.avatar}
                  >
                    <Ionicons name="person" size={10} color="#12040C" />
                  </LinearGradient>
                )}
                <Text style={styles.hostAd} numberOfLines={1}>
                  {hostAd}
                </Text>
              </View>
              {oge.listener_count > 0 ? (
                <View style={styles.dinleyici}>
                  <Ionicons
                    name="headset"
                    size={11}
                    color={RenkTokenlari.primarySoft}
                  />
                  <Text style={styles.dinleyiciYazi}>{oge.listener_count}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  press: {
    flex: 1,
  },
  kart: {
    height: 188,
    borderRadius: YaricapTokenlari.md + 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.32)',
    justifyContent: 'space-between',
    ...GolgeTokenlari.card,
  },
  kartPopuler: {
    borderColor: 'rgba(240, 180, 41, 0.55)',
  },
  kapak: {
    ...StyleSheet.absoluteFillObject,
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.sm + 2,
    paddingTop: BoslukTokenlari.sm + 2,
  },
  canli: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(8,4,14,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.45)',
  },
  canliYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '800',
  },
  mod: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  populerRozet: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(240,180,41,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(240,180,41,0.4)',
  },
  populer: {
    ...TipografiTokenlari.micro,
    color: '#F0B429',
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  alt: {
    padding: BoslukTokenlari.sm + 2,
    gap: 2,
  },
  baslik: {
    ...TipografiTokenlari.body,
    fontWeight: '700',
    color: RenkTokenlari.text,
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  topic: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 6,
  },
  host: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAd: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    flex: 1,
  },
  dinleyici: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dinleyiciYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
});
