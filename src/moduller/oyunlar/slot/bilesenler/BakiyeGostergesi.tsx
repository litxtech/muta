/**
 * NOX REELS — bakiye / kazanç göstergeleri.
 */

import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const BakiyeGostergesi = memo(function BakiyeGostergesi({
  balance,
}: {
  balance: number;
}) {
  const [shown, setShown] = useState(balance);
  useEffect(() => {
    if (balance === shown) return;
    const start = shown;
    const diff = balance - start;
    const t0 = Date.now();
    const dur = 420;
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / dur);
      setShown(Math.round(start + diff * p));
      if (p >= 1) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [balance]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.box}>
      <Text style={styles.label}>BALANCE</Text>
      <Text style={styles.val}>{shown.toLocaleString('tr-TR')}</Text>
    </View>
  );
});

export const KazancGostergesi = memo(function KazancGostergesi({
  win,
}: {
  win: number;
}) {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>WIN</Text>
      <Text style={[styles.val, win > 0 && styles.win]}>
        {win.toLocaleString('tr-TR')}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  box: { alignItems: 'center', minWidth: 88 },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  val: { color: '#F7F2E8', fontSize: 18, fontWeight: '800' },
  win: { color: '#FFE08A' },
});
