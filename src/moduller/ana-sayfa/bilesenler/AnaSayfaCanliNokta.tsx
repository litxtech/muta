import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { AnimasyonTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  boyut?: number;
  renk?: string;
  /** false ise sabit nokta (liste performansı) */
  nabiz?: boolean;
};

/** Canlı yayın nabız noktası — markanın imza hareketi */
export function AnaSayfaCanliNokta({
  boyut = 7,
  renk = RenkTokenlari.live,
  nabiz: nabizAcik = true,
}: Props) {
  const nabiz = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!nabizAcik) {
      nabiz.setValue(0);
      return;
    }
    const dongu = Animated.loop(
      Animated.sequence([
        Animated.timing(nabiz, {
          toValue: 1,
          duration: AnimasyonTokenlari.yavas + 120,
          useNativeDriver: true,
        }),
        Animated.timing(nabiz, {
          toValue: 0,
          duration: AnimasyonTokenlari.yavas + 80,
          useNativeDriver: true,
        }),
      ]),
    );
    dongu.start();
    return () => dongu.stop();
  }, [nabiz, nabizAcik]);

  const halkaOlcek = nabiz.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.4],
  });
  const halkaOpaklik = nabiz.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0],
  });

  return (
    <View style={[styles.wrap, { width: boyut * 2.6, height: boyut * 2.6 }]}>
      {nabizAcik ? (
        <Animated.View
          style={[
            styles.halka,
            {
              width: boyut,
              height: boyut,
              borderRadius: boyut / 2,
              backgroundColor: renk,
              opacity: halkaOpaklik,
              transform: [{ scale: halkaOlcek }],
            },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.cekirdek,
          {
            width: boyut,
            height: boyut,
            borderRadius: boyut / 2,
            backgroundColor: renk,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halka: {
    position: 'absolute',
  },
  cekirdek: {},
});
