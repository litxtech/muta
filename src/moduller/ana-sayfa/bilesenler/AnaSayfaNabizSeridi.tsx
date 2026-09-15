import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AnaSayfaCanliNokta } from './AnaSayfaCanliNokta';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { Room } from '../../../types/models';

const MODE_LABEL: Record<Room['mode'], string> = {
  party: 'Parti',
  dating: 'Flört',
  karaoke: 'Karaoke',
  game: 'Oyun',
  private: 'Özel',
};

type Props = {
  odalar: Room[];
  onOdaPress: (oda: Room) => void;
};

/** Yatay canlı nabız şeridi — portrait sahne kartları */
export function AnaSayfaNabizSeridi({ odalar, onOdaPress }: Props) {
  if (odalar.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.serit}
      decelerationRate="fast"
      snapToInterval={156}
    >
      {odalar.map((oda, index) => {
        const kapak = oda.cover_url ?? oda.host?.avatar_url ?? null;
        return (
          <Pressable
            key={oda.id}
            onPress={() => onOdaPress(oda)}
            style={({ pressed }) => [styles.kartPress, pressed && styles.pressed]}
          >
            <View style={styles.kart}>
              {kapak ? (
                <Image source={{ uri: kapak }} style={StyleSheet.absoluteFill} />
              ) : (
                <LinearGradient
                  colors={
                    index % 2 === 0
                      ? ['#3A1A38', '#1A1226', '#120E1A']
                      : ['#2A1840', '#16101F', '#100C18']
                  }
                  style={StyleSheet.absoluteFill}
                />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(10,6,16,0.45)', 'rgba(8,4,14,0.95)']}
                locations={[0.2, 0.55, 1]}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.ust}>
                <View style={styles.canli}>
                  <AnaSayfaCanliNokta boyut={5} />
                  <Text style={styles.canliYazi}>CANLI</Text>
                </View>
                <Text style={styles.mod}>{MODE_LABEL[oda.mode]}</Text>
              </View>

              <View style={styles.alt}>
                <Text style={styles.baslik} numberOfLines={2}>
                  {oda.title}
                </Text>
                <View style={styles.meta}>
                  <Ionicons name="headset" size={11} color={RenkTokenlari.primarySoft} />
                  <Text style={styles.metaYazi}>{oda.listener_count}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  serit: {
    paddingHorizontal: BoslukTokenlari.xl,
    gap: BoslukTokenlari.md,
    paddingBottom: 2,
  },
  kartPress: {
    width: 148,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  kart: {
    height: 210,
    borderRadius: YaricapTokenlari.md + 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.28)',
    justifyContent: 'space-between',
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: BoslukTokenlari.sm + 2,
  },
  canli: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(8,4,14,0.55)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
  },
  canliYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  mod: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  alt: {
    padding: BoslukTokenlari.md,
    gap: 6,
  },
  baslik: {
    ...TipografiTokenlari.body,
    fontWeight: '700',
    color: RenkTokenlari.text,
    lineHeight: 19,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
});
