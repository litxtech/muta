import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { GizlilikAyarlari } from '../islemler/GizlilikAyarlariniYonet';

type Madde = {
  key: keyof GizlilikAyarlari;
  label: string;
  aciklama?: string;
};

type Props = {
  maddeler: Madde[];
  degerler: GizlilikAyarlari;
  onDegistir: (key: keyof GizlilikAyarlari, v: boolean) => void;
  thumbColor?: string;
};

/** Ortak gizlilik anahtar listesi — ayarlar hub’larında tekrar yok */
export function GizlilikAnahtarListesi({
  maddeler,
  degerler,
  onDegistir,
  thumbColor,
}: Props) {
  return (
    <View>
      {maddeler.map((item, index) => (
        <View
          key={item.key}
          style={[
            styles.row,
            index < maddeler.length - 1 && styles.border,
          ]}
        >
          <View style={styles.copy}>
            <Text style={styles.label}>{item.label}</Text>
            {item.aciklama ? (
              <Text style={styles.hint}>{item.aciklama}</Text>
            ) : null}
          </View>
          <Switch
            value={degerler[item.key]}
            onValueChange={(v) => onDegistir(item.key, v)}
            trackColor={{
              true: RenkTokenlari.primary,
              false: RenkTokenlari.border,
            }}
            thumbColor={thumbColor ?? RenkTokenlari.bgElevated}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    minHeight: 52,
    gap: BoslukTokenlari.md,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  copy: {
    flex: 1,
    gap: 2,
    paddingEnd: BoslukTokenlari.sm,
  },
  label: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  hint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 16,
  },
});
