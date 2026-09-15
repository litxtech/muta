import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  baslik: string;
  sayac?: number | null;
  alt?: string;
};

/** Keşfet — bölüm başlığı + opsiyonel sayaç */
export function KesfetBolumBasligi({ baslik, sayac, alt }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.satir}>
        <Text style={styles.baslik}>{baslik}</Text>
        <View style={styles.cizgi} />
        {typeof sayac === 'number' ? (
          <Text style={styles.sayac}>{sayac}</Text>
        ) : null}
      </View>
      {alt ? <Text style={styles.alt}>{alt}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
  },
  baslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  cizgi: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: RenkTokenlari.border,
  },
  sayac: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    backgroundColor: RenkTokenlari.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
});
