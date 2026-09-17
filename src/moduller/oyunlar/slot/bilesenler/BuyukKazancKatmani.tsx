/**
 * NOX REELS — büyük kazanç katmanı.
 */

import React, { memo, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SlotWinTier } from '../tipler/SlotTipleri';
import { WIN_TIER_LABELS } from '../sabitler/SlotAyarlari';
import { ANIMATION_CONFIG } from '../sabitler/AnimasyonAyarlari';

type Props = {
  visible: boolean;
  tier: SlotWinTier;
  amount: number;
  onDone: () => void;
};

function BuyukKazancKatmaniInner({ visible, tier, amount, onDone }: Props) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!visible) {
      setShown(0);
      return;
    }
    const dur = ANIMATION_CONFIG.bigWinCountMs;
    const t0 = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(amount * eased));
      if (p >= 1) {
        clearInterval(id);
        setTimeout(onDone, 700);
      }
    }, 32);
    return () => clearInterval(id);
  }, [visible, amount, onDone]);

  if (!visible || tier === 'NONE' || tier === 'NORMAL_WIN') return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.root}>
        <LinearGradient
          colors={['rgba(8,4,20,0.88)', 'rgba(40,16,60,0.92)']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.tier}>{WIN_TIER_LABELS[tier]}</Text>
        <Text style={styles.amount}>{shown.toLocaleString('tr-TR')}</Text>
        <Text style={styles.sub}>COIN</Text>
      </View>
    </Modal>
  );
}

export const BuyukKazancKatmani = memo(BuyukKazancKatmaniInner);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tier: {
    color: '#FFE08A',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 12,
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '900',
  },
  sub: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
    letterSpacing: 2,
    fontWeight: '700',
  },
});
