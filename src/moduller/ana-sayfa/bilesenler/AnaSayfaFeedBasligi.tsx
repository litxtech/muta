import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnaSayfaCanliNokta } from './AnaSayfaCanliNokta';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  sesSayisi: number;
  yayinSayisi: number;
  solAksiyon?: ReactNode;
  sagAksiyon?: ReactNode;
};

/** Feed üst bar — marka + canlı nabız sayacı (cam çip) */
export function AnaSayfaFeedBasligi({
  sesSayisi,
  yayinSayisi,
  solAksiyon,
  sagAksiyon,
}: Props) {
  const insets = useSafeAreaInsets();
  const toplam = sesSayisi + yayinSayisi;
  const parcalar = [
    yayinSayisi > 0 ? `${yayinSayisi} yayın` : null,
    sesSayisi > 0 ? `${sesSayisi} ses odası` : null,
  ].filter(Boolean);
  const alt = parcalar.length > 0 ? parcalar.join(' · ') : 'Sahne sessiz — ilk odayı sen aç';

  return (
    <Animated.View
      entering={FadeInDown.duration(AnimasyonTokenlari.yavas)
        .springify()
        .damping(18)}
      style={[styles.wrap, { paddingTop: insets.top + BoslukTokenlari.sm }]}
    >
      <View style={styles.sol}>
        {solAksiyon}
        <View style={styles.baslikBlok}>
          <View style={styles.markaSatir}>
            <Text style={styles.marka}>Tamuso</Text>
            <LinearGradient
              colors={[...RenkTokenlari.gradientPrimary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.markaNokta}
            />
          </View>
          <View style={styles.canliSatir}>
            <View style={styles.canliCip}>
              <AnaSayfaCanliNokta boyut={6} />
              <Text style={styles.canliYazi}>
                {toplam > 0 ? `${toplam} CANLI` : 'CANLI'}
              </Text>
            </View>
            <Text style={styles.alt} numberOfLines={1}>
              {alt}
            </Text>
          </View>
        </View>
      </View>
      {sagAksiyon ? <View style={styles.sag}>{sagAksiyon}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.sm,
    gap: BoslukTokenlari.md,
  },
  sol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    flex: 1,
    minWidth: 0,
  },
  baslikBlok: { flex: 1, minWidth: 0, gap: 6 },
  markaSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  marka: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  markaNokta: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  canliSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  canliCip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 9,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(232, 64, 145, 0.14)',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  canliYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    flex: 1,
    minWidth: 0,
    lineHeight: 14,
  },
  sag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
