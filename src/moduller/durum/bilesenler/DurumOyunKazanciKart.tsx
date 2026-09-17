import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { DurumOyunKazanciPayload } from '../islemler/DurumIslemleri';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

const TIER_GRADIENTS: Record<string, readonly [string, string, string]> = {
  STORM: ['#1B2A4A', '#2C4A7A', '#4DA3FF'],
  THUNDER: ['#3B1F4A', '#6B2FA0', '#C43BFF'],
  COSMIC: ['#3B1F4A', '#E84091', '#F0B429'],
  DIVINE: ['#2A1040', '#E84091', '#FFE28A'],
};

const TIER_LABELS: Record<string, string> = {
  STORM: 'STORM WIN',
  THUNDER: 'THUNDER WIN',
  COSMIC: 'COSMIC STORM',
  DIVINE: 'DIVINE STORM',
};

function formatCoin(n: number): string {
  return Math.floor(n).toLocaleString('tr-TR');
}

type Props = {
  payload: DurumOyunKazanciPayload;
  /** Profil ızgarası için kompakt kare */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function DurumOyunKazanciKart({ payload, compact, style }: Props) {
  const tier = (payload.win_tier || 'STORM').toUpperCase();
  const gradient = TIER_GRADIENTS[tier] ?? TIER_GRADIENTS.STORM;
  const tierLabel = TIER_LABELS[tier] ?? 'WIN';
  const mult = Number(payload.total_multiplier ?? 1);
  const title = payload.game_title || 'Realm of Storms';

  if (compact) {
    return (
      <LinearGradient
        colors={[...gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.compact, style]}
      >
        <Ionicons name="trophy" size={14} color="rgba(255,255,255,0.9)" />
        <Text style={styles.compactAmount} numberOfLines={1}>
          {formatCoin(payload.total_win)}
        </Text>
        <Text style={styles.compactTier} numberOfLines={1}>
          {tierLabel.split(' ')[0]}
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[...gradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, style]}
    >
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Ionicons name="game-controller" size={12} color="#fff" />
          <Text style={styles.badgeText}>{title}</Text>
        </View>
      </View>
      <Text style={styles.tier}>{tierLabel}</Text>
      {mult > 1 ? (
        <Text style={styles.formula}>
          {formatCoin(payload.base_win)} × {mult}
        </Text>
      ) : null}
      <Text style={styles.amount}>{formatCoin(payload.total_win)}</Text>
      <Text style={styles.coinHint}>coin kazandı</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: 168,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  badgeRow: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  badgeText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tier: {
    marginTop: 8,
    color: '#fff',
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 6,
  },
  formula: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '700',
  },
  amount: {
    marginTop: 4,
    color: '#FFE28A',
    fontSize: 36,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 6,
  },
  coinHint: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.65)',
    fontSize: TipografiTokenlari.micro.fontSize,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  compact: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: 6,
  },
  compactAmount: {
    color: '#FFE28A',
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  compactTier: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
