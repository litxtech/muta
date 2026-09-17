/**
 * Feed pencere çerçevesi — hafif aura. Kıvılcım/toz parçacıkları yok.
 */

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { OyunAuraCerceve } from '../../oyunlar/ortak/bilesenler/OyunAuraCerceve';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export const FEED_PENCERE_YARICAP = YaricapTokenlari.lg;

type Props = {
  renkler: readonly [string, string] | readonly [string, string, string];
  aktif?: boolean;
  index?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export function FeedPencereCerceve({
  renkler,
  aktif = false,
  index = 0,
  style,
  children,
}: Props) {
  const r0 = renkler[0];

  return (
    <View style={[styles.dis, style]}>
      <OyunAuraCerceve
        renkler={renkler}
        yaricap={FEED_PENCERE_YARICAP}
        kalinlik={1.5}
        hizMs={7200 + index * 400}
        aktif={aktif}
        parlamaRengi={r0}
      >
        <View style={styles.pencereIc}>
          {children}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.03)', 'transparent']}
              locations={[0, 0.35, 1]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 0.42 }}
              style={styles.camUst}
            />
            <View
              style={[styles.camRim, { borderColor: RenkTokenlari.border }]}
            />
          </View>
        </View>
      </OyunAuraCerceve>
    </View>
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
  },
  pencereIc: {
    overflow: 'hidden',
  },
  camUst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '38%',
    borderTopLeftRadius: FEED_PENCERE_YARICAP - 2,
    borderTopRightRadius: FEED_PENCERE_YARICAP - 2,
  },
  camRim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: FEED_PENCERE_YARICAP - 2,
    borderWidth: 1,
  },
});