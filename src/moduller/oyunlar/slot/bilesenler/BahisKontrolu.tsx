/**
 * NOX REELS — bahis kontrolü.
 */

import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  bet: number;
  presets: readonly number[];
  disabled?: boolean;
  onChange: (bet: number) => void;
};

function BahisKontroluInner({ bet, presets, disabled, onChange }: Props) {
  const idx = Math.max(0, presets.indexOf(bet));
  const dec = () => {
    if (disabled || idx <= 0) return;
    onChange(presets[idx - 1]!);
  };
  const inc = () => {
    if (disabled || idx >= presets.length - 1) return;
    onChange(presets[idx + 1]!);
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={dec} disabled={disabled} style={styles.btn}>
        <Text style={styles.btnTxt}>−</Text>
      </Pressable>
      <View style={styles.mid}>
        <Text style={styles.label}>BET</Text>
        <Text style={styles.val}>{bet.toLocaleString('tr-TR')}</Text>
      </View>
      <Pressable onPress={inc} disabled={disabled} style={styles.btn}>
        <Text style={styles.btnTxt}>+</Text>
      </Pressable>
    </View>
  );
}

export const BahisKontrolu = memo(BahisKontroluInner);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232,197,71,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: { color: '#FFE08A', fontSize: 22, fontWeight: '700' },
  mid: { alignItems: 'center', minWidth: 72 },
  label: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  val: { color: '#F7F2E8', fontSize: 18, fontWeight: '800' },
});
