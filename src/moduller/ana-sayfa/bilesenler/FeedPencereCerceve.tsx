/**
 * Feed pencere çerçevesi — hafif statik kenar (aura/gölge yok = ısınma/titreme yok).
 */

import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
  style,
  children,
}: Props) {
  const r0 = renkler[0];

  return (
    <View
      style={[
        styles.dis,
        styles.statikCerceve,
        { borderColor: `${r0}66` },
        style,
      ]}
    >
      <View style={styles.pencereIc}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
  },
  statikCerceve: {
    borderRadius: FEED_PENCERE_YARICAP,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pencereIc: {
    overflow: 'hidden',
    borderRadius: FEED_PENCERE_YARICAP - 2,
  },
});
