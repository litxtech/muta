import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';

/** Ana sayfa ambient glow — statik lekeler (sürekli animasyon yok) */
export function AnaSayfaAtmosfer() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={[
          styles.leke,
          {
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: RenkTokenlari.primary,
            opacity: 0.12,
            top: -90,
            left: -100,
          },
        ]}
      />
      <View
        style={[
          styles.leke,
          {
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: RenkTokenlari.violet,
            opacity: 0.09,
            top: 160,
            right: -80,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  leke: {
    position: 'absolute',
  },
});
