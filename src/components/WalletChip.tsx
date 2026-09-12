import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii, typography } from '../theme/colors';

type Props = {
  coins: number;
  diamonds: number;
};

export function WalletChip({ coins, diamonds }: Props) {
  return (
    <View style={styles.row}>
      <LinearGradient colors={['#3A2040', '#241028']} style={styles.chip}>
        <Text style={styles.emoji}>🪙</Text>
        <Text style={styles.value}>{format(coins)}</Text>
      </LinearGradient>
      <LinearGradient colors={['#1F2A4A', '#182038']} style={styles.chip}>
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
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: {
    fontSize: 12,
  },
  value: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
});
