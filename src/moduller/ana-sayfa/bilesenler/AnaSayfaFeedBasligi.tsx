import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  /** Toplam canlı (yayın + ses) — tek kompakt chip */
  canliSayisi: number;
  solAksiyon?: ReactNode;
  sagAksiyon?: ReactNode;
};

/** Feed üst bar — profil avatar · Tamuso · ● N CANLI · bildirim */
export function AnaSayfaFeedBasligi({
  canliSayisi,
  solAksiyon,
  sagAksiyon,
}: Props) {
  useTemayaAboneOl();
  const { t } = useCeviri();
  const insets = useSafeAreaInsets();

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
            <View style={styles.markaBlok} accessibilityRole="header">
              <View style={styles.markaCizgi} />
              <Text style={styles.marka} accessibilityLabel="Tamuso">
                <Text style={styles.markaTamu}>Tamu</Text>
                <Text style={styles.markaSo}>so</Text>
              </Text>
            </View>
            {canliSayisi > 0 ? (
              <View style={styles.canliCip}>
                <AnaSayfaCanliNokta boyut={6} nabiz={false} />
                <Text style={styles.canliYazi}>{t('anaSayfa.canliSayac', { adet: canliSayisi })}</Text>
              </View>
            ) : (
              <View style={[styles.canliCip, styles.canliCipSessiz]}>
                <AnaSayfaCanliNokta boyut={5} nabiz={false} />
                <Text style={[styles.canliYazi, styles.canliYaziSessiz]}>{t('anaSayfa.sahneRozet')}</Text>
              </View>
            )}
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
  baslikBlok: { flex: 1, minWidth: 0 },
  markaSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  markaBlok: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  markaCizgi: {
    width: 2.5,
    height: 12,
    borderRadius: 2,
    backgroundColor: RenkTokenlari.primary,
  },
  marka: {
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  markaTamu: {
    color: RenkTokenlari.text,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  markaSo: {
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  canliCip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingEnd: 8,
    paddingStart: 4,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(232, 64, 145, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.borderAccent,
  },
  canliCipSessiz: {
    backgroundColor: RenkTokenlari.pressFill,
    borderColor: RenkTokenlari.border,
  },
  canliYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.1,
    fontWeight: '800',
  },
  canliYaziSessiz: {
    color: RenkTokenlari.textDim,
  },
  sag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
