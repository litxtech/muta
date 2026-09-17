import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { WalletChip } from '../../../components/WalletChip';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  kullaniciAdi?: string | null;
  coins: number;
  diamonds: number;
  onWalletPress: () => void;
  solAksiyon?: ReactNode;
};

function gunlukFisilti(saat: number): string {
  if (saat < 6) return 'Gece sahnesi açık';
  if (saat < 12) return 'Sabah akışı';
  if (saat < 17) return 'Gündüz akışı';
  if (saat < 22) return 'Bu gece senin';
  return 'Gece vardiyası';
}

/** Ana sayfa üst bar — hamburger + selam + cüzdan */
export function AnaSayfaMarkaBasligi({
  kullaniciAdi,
  coins,
  diamonds,
  onWalletPress,
  solAksiyon,
}: Props) {
  const belirme = useRef(new Animated.Value(0)).current;
  const fisilti = useMemo(() => gunlukFisilti(new Date().getHours()), []);

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
              Merhaba, {kullaniciAdi}
            </Text>
          ) : (
            <Text style={styles.selam}>Merhaba</Text>
          )}
        </View>
        <Pressable onPress={onWalletPress} hitSlop={8} accessibilityLabel="Cüzdan">
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
