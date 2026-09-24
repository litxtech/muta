import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnaSayfaCanliNokta } from '../../ana-sayfa/bilesenler/AnaSayfaCanliNokta';
import { guvenliGeriDon } from '../../../components/EkranBasligi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  canliSayisi: number;
  onGeri?: () => void;
};

/** Keşfet — premium marka başlığı + canlı sayaç */
export function KesfetMarkaBasligi({ canliSayisi, onGeri }: Props) {
  const { t } = useCeviri();
  return (
    <View style={styles.wrap}>
      <View style={styles.ust}>
        <Pressable
          style={styles.geri}
          onPress={onGeri ?? (() => guvenliGeriDon('/(tabs)'))}
          hitSlop={8}
          accessibilityLabel={t('ortak.geri')}
        >
          <Ionicons name="chevron-back" size={22} color={RenkTokenlari.text} />
        </Pressable>

        <View style={styles.markaBlok}>
          <Text style={styles.fisilti}>{t('kesfet.fisilti')}</Text>
          <Text style={styles.baslik}>{t('kesfet.sahneBul')}</Text>
          <Text style={styles.slogan}>{t('kesfet.slogan')}</Text>
        </View>

        <View style={styles.canliRozet}>
          <AnaSayfaCanliNokta boyut={6} />
          <View style={styles.canliMetin}>
            <Text style={styles.canliSayi}>{canliSayisi}</Text>
            <Text style={styles.canliEtiket}>{t('kesfet.canliEtiket')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.xs,
    paddingBottom: BoslukTokenlari.md,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BoslukTokenlari.sm,
  },
  geri: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.bgElevated,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    marginTop: 2,
  },
  markaBlok: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingTop: 2,
  },
  fisilti: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1.6,
    fontSize: 10,
    lineHeight: 13,
  },
  baslik: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    letterSpacing: -0.6,
    fontSize: 28,
    lineHeight: 34,
  },
  slogan: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    letterSpacing: 0.4,
    lineHeight: 18,
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
    marginTop: 2,
  },
  canliMetin: {
    gap: 2,
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
    lineHeight: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
