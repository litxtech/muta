import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const chips: Array<{ label: string; hot?: boolean }> = [];
  if (vipLevel > 0) chips.push({ label: `VIP ${vipLevel}`, hot: true });
  if (gifterLevel) chips.push({ label: `Hediye ${gifterLevel}` });
  if (charmLevel) chips.push({ label: `Çekicilik ${charmLevel}` });
  if (rechargeLevel) chips.push({ label: `Yükleme ${rechargeLevel}` });
  if (chips.length === 0) return null;

  return (
    <View style={styles.row}>
      {chips.map((c) => (
        <Chip key={c.label} label={c.label} hot={c.hot} />
      ))}
    </View>
  );
}

function Chip({ label, hot }: { label: string; hot?: boolean }) {
  if (hot) {
    return (
      <LinearGradient
        colors={['#F5E6A8', '#D4AF37', '#C49A2A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.chipHot}
      >
        <Text style={styles.textHot}>{label}</Text>
      </LinearGradient>
    );
  }
  return (
    <View style={styles.chip}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  chipHot: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  text: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    fontWeight: '700',
  },
  textHot: {
    ...TipografiTokenlari.micro,
    color: '#3A2A08',
    fontWeight: '800',
  },
});
