import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';

type Props = {
  yogunluk?: 'kapali' | 'hafif' | 'normal';
};

/**
 * Sesli oda sahnesi — statik atmosfer.
 * Animasyon yok: titreme / GPU kasma üretmez.
 */
export function OdaCanliAtmosfer({ yogunluk = 'hafif' }: Props) {
  const noktalar = useMemo(() => {
    if (yogunluk === 'kapali') return [];
    const n = yogunluk === 'hafif' ? 5 : 8;
    const renkler = [
      RenkTokenlari.primary,
      RenkTokenlari.accent,
      RenkTokenlari.mint,
      RenkTokenlari.violet,
    ];
    return Array.from({ length: n }, (_, i) => ({
      key: `a_${i}`,
      left: `${10 + ((i * 19) % 80)}%` as `${number}%`,
      top: `${12 + ((i * 27) % 68)}%` as `${number}%`,
      size: 3 + (i % 3),
      color: renkler[i % renkler.length],
      opacity: 0.18 + (i % 3) * 0.08,
    }));
  }, [yogunluk]);

  if (yogunluk === 'kapali') return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.aura} />
      {noktalar.map((n) => (
        <View
          key={n.key}
          style={{
            position: 'absolute',
            left: n.left,
            top: n.top,
            width: n.size,
            height: n.size,
            borderRadius: n.size / 2,
            backgroundColor: n.color,
            opacity: n.opacity,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  aura: {
    position: 'absolute',
    alignSelf: 'center',
    top: '14%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: RenkTokenlari.primary,
    opacity: 0.07,
  },
});
