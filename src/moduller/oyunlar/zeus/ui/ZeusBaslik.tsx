import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { GAME_DISPLAY_NAME, GAME_SUBTITLE } from '../config/ZeusSabitleri';

type Props = {
  balance: number;
  multiplierTotal: number;
  persistentMultiplier?: number;
  bonusLabel?: string | null;
  onClose: () => void;
  onInfo: () => void;
  /** Ses odası kartı içinde — oda üstte görünür. */
  compact?: boolean;
};

function ZeusBaslikInner({
  balance,
  multiplierTotal,
  persistentMultiplier = 0,
  bonusLabel,
  onClose,
  onInfo,
  compact = false,
}: Props) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Pressable
        onPress={onClose}
        hitSlop={10}
        style={styles.exitBtn}
        accessibilityLabel="Oyunu bitir"
      >
        <Ionicons
          name={compact ? 'chevron-down' : 'arrow-back'}
          size={22}
          color={RenkTokenlari.text}
        />
        {compact ? null : <Text style={styles.exitLabel}>Oyunu bitir</Text>}
      </Pressable>

      <View style={styles.brand}>
        <Text style={styles.logo}>{GAME_DISPLAY_NAME}</Text>
        <Text style={styles.subtitle}>
          {bonusLabel ?? GAME_SUBTITLE.toUpperCase()}
        </Text>
      </View>

      <View style={styles.right}>
        {multiplierTotal > 1 ? (
          <View style={styles.multChip}>
            <Text style={styles.multText}>{multiplierTotal}×</Text>
          </View>
        ) : null}
        {persistentMultiplier > 0 ? (
          <View style={[styles.multChip, styles.persistChip]}>
            <Text style={styles.persistText}>Σ {persistentMultiplier}×</Text>
          </View>
        ) : null}
        <View style={styles.balanceChip}>
          <Ionicons name="server" size={12} color="#E8C547" />
          <Text style={styles.balance}>
            {Math.floor(balance).toLocaleString('tr-TR')}
          </Text>
        </View>
        <Pressable
          onPress={onInfo}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityLabel="Ödeme tablosu"
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={RenkTokenlari.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

export const ZeusBaslik = memo(ZeusBaslikInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.sm,
    gap: 8,
  },
  rowCompact: {
    paddingVertical: 4,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 6,
  },
  exitLabel: {
    color: RenkTokenlari.text,
    fontSize: 12,
    fontWeight: '700',
  },
  brand: { flex: 1 },
  logo: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  subtitle: {
    color: '#E8C547',
    fontSize: TipografiTokenlari.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginTop: 2,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(12,14,24,0.7)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(232,197,71,0.35)',
  },
  balance: {
    color: '#E8C547',
    fontWeight: '800',
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  multChip: {
    backgroundColor: 'rgba(232,197,71,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(232,197,71,0.45)',
  },
  persistChip: {
    backgroundColor: 'rgba(77,168,255,0.18)',
    borderColor: 'rgba(77,168,255,0.5)',
  },
  persistText: {
    color: '#4DA8FF',
    fontWeight: '800',
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  multText: {
    color: '#F6E27A',
    fontWeight: '800',
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
