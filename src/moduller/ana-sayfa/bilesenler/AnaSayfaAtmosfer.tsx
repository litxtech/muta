import React from 'react';
import { StyleSheet, View } from 'react-native';
import { premiumAtmosferLekeleri } from '../../../tasarim-sistemi/premium/PremiumAmbient';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';

/** Ana sayfa ambient glow — düşük opacity lekeler (sürekli animasyon yok) */
export function AnaSayfaAtmosfer() {
  useTemayaAboneOl();
  const lekeler = premiumAtmosferLekeleri();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lekeler.map((l, i) => (
        <View
          key={i}
          style={[
            styles.leke,
            {
              width: l.w,
              height: l.h,
              borderRadius: l.w / 2,
              backgroundColor: l.renk,
              opacity: l.opacity,
              top: l.top,
              left: l.left,
              right: l.right,
              bottom: l.bottom,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  leke: {
    position: 'absolute',
  },
});
