import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { WalletChip } from '../../../components/WalletChip';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri, type CeviriAnahtari } from '../../../i18n/useCeviri';

type Props = {
  kullaniciAdi?: string | null;
  coins: number;
  diamonds: number;
  onWalletPress: () => void;
  solAksiyon?: ReactNode;
};

function gunlukFisiltiAnahtar(saat: number): CeviriAnahtari {
  if (saat < 6) return 'anaSayfa.fisiltiGeceSahne';
  if (saat < 12) return 'anaSayfa.fisiltiSabah';
  if (saat < 17) return 'anaSayfa.fisiltiGunduz';
  if (saat < 22) return 'anaSayfa.fisiltiBuGece';
  return 'anaSayfa.fisiltiGeceVardiya';
}

/** Ana sayfa üst bar — hamburger + selam + cüzdan */
export function AnaSayfaMarkaBasligi({
  kullaniciAdi,
  coins,
  diamonds,
  onWalletPress,
  solAksiyon,
}: Props) {
  const { t } = useCeviri();
  const belirme = useRef(new Animated.Value(0)).current;
  const fisilti = useMemo(
    () => t(gunlukFisiltiAnahtar(new Date().getHours())),
    [t],
  );

  useEffect(() => {
    Animated.timing(belirme, {
      toValue: 1,
      duration: AnimasyonTokenlari.yavas + 40,
      useNativeDriver: true,
    }).start();
  }, [belirme]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: belirme,
          transform: [
            {
              translateY: belirme.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.ust}>
        {solAksiyon ? <View style={styles.sol}>{solAksiyon}</View> : null}
        <View style={styles.orta}>
          <Text style={styles.fisilti}>{fisilti}</Text>
          {kullaniciAdi ? (
            <Text style={styles.selam} numberOfLines={1}>
              {t('anaSayfa.selamAd', { ad: kullaniciAdi })}
            </Text>
          ) : (
            <Text style={styles.selam}>{t('anaSayfa.selam')}</Text>
          )}
        </View>
        <Pressable onPress={onWalletPress} hitSlop={8} accessibilityLabel={t('sekmeler.cuzdan')}>
          <WalletChip coins={coins} diamonds={diamonds} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingTop: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.lg,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
  },
  sol: {},
  orta: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  fisilti: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 10,
    lineHeight: 13,
  },
  selam: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 18,
    lineHeight: 24,
  },
});
