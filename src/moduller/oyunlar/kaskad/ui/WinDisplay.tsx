/**
 * WinDisplay — kazanç alanı: BASE WIN ve TOPLAM ÇARPAN ayrı gösterilir,
 * sonra BASE × MULT count-up ile toplam kazanca dönüşür.
 */

import React, { memo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AnimatedNumber,
  type AnimatedNumberHandle,
} from '../animasyonlar/AnimatedNumber';
import { winCountDurationMs } from '../sabitler/KaskadSabitleri';
import type { WinTier } from '../tipler/KaskadTipleri';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  totalWin: number;
  baseWin: number;
  totalMultiplier: number;
  tier: WinTier;
  visible: boolean;
};

function WinDisplayInner({ totalWin, baseWin, totalMultiplier, tier, visible }: Props) {
  const numberRef = useRef<AnimatedNumberHandle>(null);

  if (!visible || totalWin <= 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>KAZANÇ</Text>
        <Text style={styles.idle}>—</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>KAZANÇ</Text>
      <View style={styles.row}>
        {totalMultiplier > 1 ? (
          <Text style={styles.formula}>
            {Math.floor(baseWin).toLocaleString('tr-TR')} × {totalMultiplier} ={' '}
          </Text>
        ) : null}
        <AnimatedNumber
          ref={numberRef}
          value={Math.floor(totalWin)}
          durationMs={winCountDurationMs(tier)}
          style={styles.value}
        />
      </View>
    </View>
  );
}

export const WinDisplay = memo(WinDisplayInner);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,162,74,0.35)',
    backgroundColor: 'rgba(12,14,24,0.55)',
  },
  label: {
    color: 'rgba(232,200,120,0.75)',
    fontSize: TipografiTokenlari.micro.fontSize,
    letterSpacing: 1.6,
    fontWeight: '800',
  },
  row: { flexDirection: 'row', alignItems: 'baseline' },
  formula: {
    color: 'rgba(247,242,232,0.55)',
    fontSize: TipografiTokenlari.body.fontSize,
    fontWeight: '700',
  },
  value: {
    color: '#FFE08A',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(240,180,41,0.45)',
    textShadowRadius: 10,
  },
  idle: {
    color: 'rgba(247,242,232,0.35)',
    fontSize: 22,
    fontWeight: '800',
  },
});
