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
import type { FeedOggesi } from '../okuma/AnaSayfaIcerikleriniGetir';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  ogeler: FeedOggesi[];
  onPress: (oge: FeedOggesi) => void;
};

/** Yatay canlı yayın odakları — ses odalarından ayrı, üstte */
export function AnaSayfaCanliOdakSeridi({ ogeler, onPress }: Props) {
  if (ogeler.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.baslikSatir}>
        <View style={styles.baslikSol}>
          <AnaSayfaCanliNokta boyut={6} />
          <Text style={styles.baslik}>Canlı odaklar</Text>
        </View>
        <Text style={styles.sayi}>{ogeler.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serit}
        decelerationRate="fast"
      >
        {ogeler.map((oge, index) => {
          const hostAd =
            oge.host?.display_name ??
            (oge.host?.username ? `@${oge.host.username}` : 'Yayıncı');
          return (
            <Pressable
              key={oge.id}
              onPress={() => onPress(oge)}
              style={({ pressed }) => [
                styles.kartPress,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.kart}>
                {oge.cover_url ? (
                  <Image
                    source={{ uri: oge.cover_url }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <LinearGradient
                    colors={[...RenkTokenlari.gradientPlaceholder]}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <LinearGradient
                  colors={[...RenkTokenlari.overlayGradient]}
                  locations={[0.15, 0.5, 1]}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.ust}>
                  <View style={styles.rozet}>
                    <AnaSayfaCanliNokta boyut={5} />
                    <Text style={styles.rozetYazi}>YAYIN</Text>
                  </View>
                  <Ionicons
                    name="videocam"
                    size={12}
                    color={RenkTokenlari.primarySoft}
                  />
                </View>

                <View style={styles.alt}>
                  <Text style={styles.baslikKart} numberOfLines={2}>
                    {oge.title}
                  </Text>
                  <View style={styles.meta}>
                    <Text style={styles.host} numberOfLines={1}>
                      {hostAd}
                    </Text>
                    {oge.listener_count > 0 ? (
                      <View style={styles.izleyici}>
                        <Ionicons
                          name="eye-outline"
                          size={11}
                          color={RenkTokenlari.textMuted}
                        />
                        <Text style={styles.izleyiciYazi}>
                          {oge.listener_count}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: BoslukTokenlari.sm,
    marginBottom: BoslukTokenlari.md,
  },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: BoslukTokenlari.xs,
  },
  baslikSol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  baslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontSize: 13,
  },
  sayi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  serit: {
    gap: BoslukTokenlari.sm + 2,
    paddingRight: BoslukTokenlari.lg,
  },
  kartPress: {
    width: 132,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  kart: {
    height: 176,
    borderRadius: YaricapTokenlari.md + 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.42)',
    justifyContent: 'space-between',
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: BoslukTokenlari.sm + 2,
  },
  rozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(232,64,145,0.28)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.5)',
  },
  rozetYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 9,
    letterSpacing: 0.8,
    fontWeight: '800',
  },
  alt: {
    padding: BoslukTokenlari.sm + 2,
    gap: 4,
  },
  baslikKart: {
    ...TipografiTokenlari.body,
    fontWeight: '700',
    color: RenkTokenlari.textOnOverlay,
    fontSize: 13,
    lineHeight: 17,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  host: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnOverlay,
    opacity: 0.78,
    flex: 1,
  },
  izleyici: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  izleyiciYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnOverlay,
    opacity: 0.78,
    fontWeight: '600',
  },
});
