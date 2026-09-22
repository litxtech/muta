import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';

type Props = {
  yukseklik?: number;
  renk?: string;
  /** true ise animasyon — feed listesinde false tut (titreme) */
  animasyon?: boolean;
};

/**
 * Mini equalizer — varsayılan statik (layout thrash yok).
 * Gerçek ses ölçümü değil; dekoratif.
 */
export function AnaSayfaSesCubuklari({
  yukseklik = 12,
  renk = RenkTokenlari.primarySoft,
  animasyon: _animasyon = false,
}: Props) {
  // Feed scroll: height animasyonu layout titretir → sabit çubuklar
  const yukseklikler = [0.35, 0.7, 0.45, 0.9, 0.55];

  return (
    <View style={[styles.wrap, { height: yukseklik }]}>
      {yukseklikler.map((oran, i) => (
        <View
          key={i}
          style={[
            styles.cubuk,
            {
              height: Math.max(3, oran * yukseklik),
              backgroundColor: renk,
              opacity: 0.55 + oran * 0.35,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  cubuk: {
    width: 2.5,
    borderRadius: 2,
  },
});
