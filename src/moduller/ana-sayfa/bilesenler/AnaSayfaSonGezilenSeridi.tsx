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
import type { SonGezilenGorunum } from '../depolama/SonGezilenDepolama';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  ogeler: SonGezilenGorunum[];
  onPress: (oge: SonGezilenGorunum) => void;
};

/** Feed üstü — son izlenen yayın / gezilen ses odası kartları */
export function AnaSayfaSonGezilenSeridi({ ogeler, onPress }: Props) {
  if (ogeler.length === 0) return null;

  const canliSayisi = ogeler.filter((o) => o.canli).length;

  return (
    <View style={styles.wrap}>
      <View style={styles.baslikSatir}>
        <View style={styles.baslikSol}>
          <AnaSayfaCanliNokta boyut={6} nabiz={canliSayisi > 0} />
          <Text style={styles.baslik}>Son gezilenler</Text>
        </View>
        <Text style={styles.sayi}>
          {canliSayisi > 0 ? `${canliSayisi} canlı` : `${ogeler.length}`}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serit}
        decelerationRate="fast"
      >
        {ogeler.map((oge) => {
          const kapak = MedyaUriGuvenli(oge.coverUrl ?? oge.hostAvatar);
          const yayinMi = oge.tur === 'canli';
          const tint = yayinMi ? RenkTokenlari.live : RenkTokenlari.mint;
          const border =
            oge.canli
              ? yayinMi
                ? 'rgba(232, 64, 145, 0.5)'
                : 'rgba(61, 207, 176, 0.48)'
              : 'rgba(255,255,255,0.12)';

          return (
            <Pressable
              key={`${oge.tur}:${oge.id}`}
              onPress={() => onPress(oge)}
              style={({ pressed }) => [
                styles.kartPress,
                pressed && styles.pressed,
                !oge.canli && styles.kartSoluk,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${oge.title}, ${yayinMi ? 'yayın' : 'ses odası'}`}
            >
              <View style={[styles.kart, { borderColor: border }]}>
                {kapak ? (
                  <Image source={{ uri: kapak }} style={StyleSheet.absoluteFill} />
                ) : (
                  <LinearGradient
                    colors={[...RenkTokenlari.gradientPlaceholder]}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <LinearGradient
                  colors={['rgba(8,6,14,0.15)', 'rgba(8,6,14,0.55)', 'rgba(8,6,14,0.92)']}
                  locations={[0.1, 0.45, 1]}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.ust}>
                  <View
                    style={[
                      styles.rozet,
                      {
                        backgroundColor: oge.canli
                          ? yayinMi
                            ? 'rgba(232,64,145,0.32)'
                            : 'rgba(61,207,176,0.28)'
                          : 'rgba(255,255,255,0.12)',
                        borderColor: oge.canli
                          ? yayinMi
                            ? 'rgba(232,64,145,0.55)'
                            : 'rgba(61,207,176,0.5)'
                          : 'rgba(255,255,255,0.18)',
                      },
                    ]}
                  >
                    {oge.canli ? <AnaSayfaCanliNokta boyut={4} renk={tint} /> : null}
                    <Text style={[styles.rozetYazi, { color: oge.canli ? tint : RenkTokenlari.textDim }]}>
                      {oge.canli ? (yayinMi ? 'YAYIN' : 'SES') : 'SON'}
                    </Text>
                  </View>
                  <Ionicons
                    name={yayinMi ? 'videocam' : 'headset'}
                    size={12}
                    color={oge.canli ? tint : RenkTokenlari.textDim}
                  />
                </View>

                <View style={styles.alt}>
                  <Text style={styles.baslikKart} numberOfLines={2}>
                    {oge.title}
                  </Text>
                  <View style={styles.meta}>
                    <Text style={styles.host} numberOfLines={1}>
                      {oge.hostAd ?? (yayinMi ? 'Yayıncı' : 'Oda')}
                    </Text>
                    {oge.canli && oge.listenerCount > 0 ? (
                      <View style={styles.izleyici}>
                        <Ionicons
                          name={yayinMi ? 'eye-outline' : 'people-outline'}
                          size={11}
                          color={RenkTokenlari.textOnOverlay}
                        />
                        <Text style={styles.izleyiciYazi}>{oge.listenerCount}</Text>
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
    marginBottom: BoslukTokenlari.sm,
  },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.xs,
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
    paddingRight: BoslukTokenlari.sm,
    paddingBottom: 2,
  },
  kartPress: {
    width: 118,
  },
  kartSoluk: {
    opacity: 0.72,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  kart: {
    height: 168,
    borderRadius: YaricapTokenlari.md + 2,
    overflow: 'hidden',
    borderWidth: 1,
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
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
  },
  rozetYazi: {
    ...TipografiTokenlari.micro,
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
    fontSize: 12,
    lineHeight: 16,
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
