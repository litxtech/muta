import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TakipIliskiEtiketi } from '../TakipSayacFormat';
import type { TakipIliskiDurumu } from '../TakipTipleri';

export function IliskiEtiketi({
  state,
  followsYou,
  isMutual,
}: {
  state: TakipIliskiDurumu | string;
  followsYou?: boolean;
  isMutual?: boolean;
}) {
  const yazi = TakipIliskiEtiketi({ state, followsYou, isMutual });
  if (!yazi) return null;
  return (
    <View style={styles.pill} accessibilityRole="text" accessibilityLabel={yazi}>
      <Text style={styles.yazi}>{yazi}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: BoslukTokenlari.sm,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.bgElevated,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  yazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
    fontSize: 11,
  },
});
