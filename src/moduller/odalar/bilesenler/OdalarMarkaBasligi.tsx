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
          <View>
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
    paddingTop: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.md,
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    letterSpacing: 1.6,
    fontSize: 10,
  },
  baslik: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    letterSpacing: -0.6,
    fontSize: 28,
    lineHeight: 32,
  },
  slogan: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  canliRozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(232, 64, 145, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.md,
    minWidth: 78,
  },
  canliSayi: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    lineHeight: 22,
  },
  canliEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
