import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  coins: number;
  diamonds: number;
};

export function WalletChip({ coins, diamonds }: Props) {
  return (
    <View style={styles.row}>
      <LinearGradient colors={[...RenkTokenlari.gradientGold]} style={styles.chip}>
        <Text style={styles.emoji}>🪙</Text>
        <Text style={styles.value}>{format(coins)}</Text>
      </LinearGradient>
      <LinearGradient colors={[...RenkTokenlari.gradientDiamond]} style={styles.chip}>
        <Text style={styles.emoji}>💎</Text>
        <Text style={styles.value}>{format(diamonds)}</Text>
      </LinearGradient>
    </View>
  );
}

function format(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  emoji: {
    fontSize: 12,
  },
  value: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '700',
  },
});
