/**
 * Feed iskeleti — 2'li kart yerleşimi. Statik placeholder (sürekli shimmer yok).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FEED_KART_ORANI } from '../sabitler/FeedKartOrani';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

function IskeletKart() {
  return (
    <View style={styles.kart}>
      <View style={styles.ust}>
        <View style={styles.rozet} />
        <View style={styles.sayac} />
      </View>
      <View style={styles.alt}>
        <View style={[styles.satir, { width: '82%' }]} />
        <View style={[styles.satir, { width: '56%' }]} />
        <View style={styles.host}>
          <View style={styles.avatar} />
          <View style={[styles.satir, { width: '44%', height: 8 }]} />
        </View>
      </View>
    </View>
  );
}

export function AnaSayfaIskelet({ satir = 3 }: { satir?: number }) {
  return (
    <View style={styles.wrap}>
      {Array.from({ length: satir }, (_, r) => (
        <View key={r} style={styles.izgaraSatir}>
          <IskeletKart />
          <IskeletKart />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
    paddingTop: BoslukTokenlari.xs,
  },
  izgaraSatir: {
    flexDirection: 'row',
    gap: BoslukTokenlari.md,
  },
  kart: {
    flex: 1,
    aspectRatio: FEED_KART_ORANI,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.borderAccent,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: BoslukTokenlari.sm + 2,
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rozet: {
    width: 54,
    height: 18,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
  },
  sayac: {
    width: 36,
    height: 18,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
  },
  alt: {
    gap: 6,
  },
  satir: {
    height: 10,
    borderRadius: 4,
    backgroundColor: RenkTokenlari.surface,
  },
  host: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: RenkTokenlari.surface,
  },
});
