import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnaSayfaCanliNokta } from '../../ana-sayfa/bilesenler/AnaSayfaCanliNokta';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  canliSayisi: number;
};

/** Odalar sekmesi marka başlığı */
export function OdalarMarkaBasligi({ canliSayisi }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.ust}>
        <View style={styles.markaBlok}>
          <Text style={styles.fisilti}>SES ODALARI</Text>
          <Text style={styles.baslik}>Canlı odalar</Text>
          <Text style={styles.slogan}>Katıl · dinle · sohbet et</Text>
        </View>
        <View style={styles.canliRozet}>
          <AnaSayfaCanliNokta boyut={6} />
          <View style={styles.canliMetin}>
            <Text style={styles.canliSayi}>{canliSayisi}</Text>
            <Text style={styles.canliEtiket}>canlı</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingTop: 0,
    paddingBottom: BoslukTokenlari.sm,
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
  },
  markaBlok: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  fisilti: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1.4,
    fontSize: 9,
    lineHeight: 12,
  },
  baslik: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    letterSpacing: -0.5,
    fontSize: 22,
    lineHeight: 28,
  },
  slogan: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    letterSpacing: 0.4,
    fontSize: 12,
    lineHeight: 16,
  },
  canliRozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(232, 64, 145, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    minWidth: 64,
  },
  canliMetin: {
    gap: 2,
  },
  canliSayi: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 16,
    lineHeight: 20,
  },
  canliEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
