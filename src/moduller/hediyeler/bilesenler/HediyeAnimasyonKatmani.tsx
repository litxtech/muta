import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  HediyeAnimasyonuKuyrugu,
  type HediyeAnimasyonIslemi,
} from '../animasyon/HediyeAnimasyonuKuyrugu';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

/** Overlay — ses/mic kontrollerini bloklamaz */
export function HediyeAnimasyonKatmani() {
  const [aktif, setAktif] = useState<HediyeAnimasyonIslemi | null>(null);
  const [kuyruk, setKuyruk] = useState(0);

  useEffect(() => {
    return HediyeAnimasyonuKuyrugu.dinle((a, q) => {
      setAktif(a);
      setKuyruk(q);
    });
  }, []);

  if (!aktif) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={[styles.card, aktif.fullScreen && styles.full]}>
        <Text style={styles.emoji}>{aktif.emoji}</Text>
        <Text style={styles.name}>{aktif.name}</Text>
        {kuyruk > 0 ? (
          <Text style={styles.queue}>+{kuyruk} kuyrukta</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  card: {
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(18, 10, 28, 0.82)',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    alignItems: 'center',
    gap: 6,
  },
  full: {
    minWidth: '70%',
    paddingVertical: 40,
  },
  emoji: { fontSize: 56 },
  name: { ...TipografiTokenlari.h1, color: RenkTokenlari.text },
  queue: { ...TipografiTokenlari.caption, color: RenkTokenlari.accent },
});
