import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  vipLevel: number;
  gifterLevel?: number | null;
  charmLevel?: number;
  rechargeLevel?: number | null;
};

export function PrestigeRozetSatiri({
  vipLevel,
  gifterLevel,
  charmLevel,
  rechargeLevel,
}: Props) {
  return (
    <View style={styles.row}>
      {vipLevel > 0 ? <Chip label={`VIP ${vipLevel}`} hot /> : null}
      {gifterLevel ? <Chip label={`Gifter ${gifterLevel}`} /> : null}
      {charmLevel ? <Chip label={`Charm ${charmLevel}`} /> : null}
      {rechargeLevel ? <Chip label={`Recharge ${rechargeLevel}`} /> : null}
    </View>
  );
}

function Chip({ label, hot }: { label: string; hot?: boolean }) {
  return (
    <View style={[styles.chip, hot && styles.hot]}>
      <Text style={[styles.text, hot && styles.textHot]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
  hot: {
    borderColor: RenkTokenlari.primary,
    backgroundColor: 'rgba(232, 64, 145, 0.18)',
  },
  text: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted },
  textHot: { color: RenkTokenlari.primarySoft },
});
