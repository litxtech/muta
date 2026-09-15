/**
 * Üst bar — logo, bakiye, ses.
 */

import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { GAME_DISPLAY_NAME } from '../sabitler/KaskadSabitleri';

type Props = {
  balance: number;
  avatarUrl?: string | null;
  musicOn: boolean;
  sfxOn: boolean;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
  onInfo: () => void;
  onClose: () => void;
  multiplierTotal: number;
  bonusLabel?: string | null;
};

function GameHeaderInner({
  balance,
  avatarUrl,
  musicOn,
  sfxOn,
  onToggleMusic,
  onToggleSfx,
  onInfo,
  onClose,
  multiplierTotal,
  bonusLabel,
}: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn}>
        <Ionicons name="close" size={22} color={RenkTokenlari.text} />
      </Pressable>

      <View style={styles.brand}>
        <Text style={styles.logo}>{GAME_DISPLAY_NAME}</Text>
        {bonusLabel ? <Text style={styles.bonus}>{bonusLabel}</Text> : null}
      </View>

      <View style={styles.right}>
        <View style={styles.multChip}>
          <Text style={styles.multText}>{multiplierTotal}x</Text>
        </View>
        <View style={styles.balanceChip}>
          <Text style={styles.balance}>{Math.floor(balance)}</Text>
        </View>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPh]} />
        )}
        <Pressable onPress={onToggleMusic} hitSlop={8} style={styles.iconBtn}>
          <Ionicons
            name={musicOn ? 'musical-notes' : 'musical-notes-outline'}
            size={18}
            color={RenkTokenlari.textMuted}
          />
        </Pressable>
        <Pressable onPress={onToggleSfx} hitSlop={8} style={styles.iconBtn}>
          <Ionicons
            name={sfxOn ? 'volume-high' : 'volume-mute'}
            size={18}
            color={RenkTokenlari.textMuted}
          />
        </Pressable>
        <Pressable onPress={onInfo} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="information-circle-outline" size={20} color={RenkTokenlari.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

export const GameHeader = memo(GameHeaderInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.sm,
    gap: 8,
  },
  brand: { flex: 1 },
  logo: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  bonus: {
    color: RenkTokenlari.violet,
    fontSize: TipografiTokenlari.micro.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceChip: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  balance: {
    color: RenkTokenlari.accent,
    fontWeight: '800',
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  multChip: {
    backgroundColor: 'rgba(255,107,157,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.45)',
  },
  multText: {
    color: '#FFB3C9',
    fontWeight: '800',
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarPh: { backgroundColor: RenkTokenlari.surface },
  iconBtn: { padding: 4 },
});
