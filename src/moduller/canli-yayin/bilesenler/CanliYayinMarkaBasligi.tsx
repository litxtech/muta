import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnaSayfaCanliNokta } from '../../ana-sayfa/bilesenler/AnaSayfaCanliNokta';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  canliSayisi: number;
  onGeri?: () => void;
};

/** Canlı yayın açma / keşfet marka başlığı */
export function CanliYayinMarkaBasligi({ canliSayisi, onGeri }: Props) {
  const { t } = useCeviri();
  return (
    <Animated.View
      entering={FadeInDown.duration(AnimasyonTokenlari.yavas)
        .springify()
        .damping(18)}
      style={styles.wrap}
    >
      <View style={styles.ust}>
        {onGeri ? (
          <Pressable
            onPress={onGeri}
            accessibilityLabel={t('ortak.geri')}
            hitSlop={10}
            style={({ pressed }) => [styles.geri, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={20} color={RenkTokenlari.text} />
          </Pressable>
        ) : null}
        <View style={styles.markaBlok}>
          <Text style={styles.fisilti}>{t('canliYayin.fisilti')}</Text>
          <Text style={styles.baslik}>{t('canliYayin.baslik')}</Text>
          <Text style={styles.slogan}>{t('canliYayin.slogan')}</Text>
        </View>
        <View style={styles.canliRozet}>
          <AnaSayfaCanliNokta boyut={6} />
          <View style={styles.canliMetin}>
            <Text style={styles.canliSayi}>{canliSayisi}</Text>
            <Text style={styles.canliEtiket}>{t('canliYayin.canliEtiket')}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.sm,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
  },
  geri: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
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
    fontSize: 26,
    lineHeight: 32,
  },
  slogan: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    letterSpacing: 0.3,
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
