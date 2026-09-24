import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  misafir: boolean;
  kapali: boolean;
  onAksiyon: () => void;
};

export function MesajBosDurum({ misafir, kapali, onAksiyon }: Props) {
  const { t } = useCeviri();
  const baslik = kapali
    ? t('mesajlar.bosKapaliBaslik')
    : misafir
      ? t('mesajlar.bosMisafirBaslik')
      : t('mesajlar.bosSohbetBaslik');
  const govde = kapali
    ? t('mesajlar.bosKapaliBody')
    : misafir
      ? t('mesajlar.bosMisafirBody')
      : t('mesajlar.bosSohbetBody');
  const cta = misafir ? t('ortak.hesabiTamamla') : t('mesajlar.yeniSohbet');

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[...RenkTokenlari.gradientPlaceholder]}
        style={styles.kart}
      >
        <View style={styles.ikon}>
          <Ionicons name="chatbubbles-outline" size={28} color={RenkTokenlari.primarySoft} />
        </View>
        <Text style={styles.baslik}>{baslik}</Text>
        <Text style={styles.govde}>{govde}</Text>
        {!kapali ? (
          <Pressable onPress={onAksiyon} style={styles.ctaHit}>
            <LinearGradient
              colors={[...RenkTokenlari.gradientPrimary]}
              style={styles.cta}
            >
              <Ionicons
                name={misafir ? 'person-outline' : 'create-outline'}
                size={16}
                color="#12040C"
              />
              <Text style={styles.ctaYazi}>{cta}</Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingTop: BoslukTokenlari.xxl,
  },
  kart: {
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.xxl,
    paddingHorizontal: BoslukTokenlari.xl,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  ikon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 64, 145, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.35)',
    marginBottom: BoslukTokenlari.xs,
  },
  baslik: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    textAlign: 'center',
  },
  govde: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
  ctaHit: {
    marginTop: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  ctaYazi: {
    ...TipografiTokenlari.body,
    fontWeight: '800',
    color: '#12040C',
  },
});
