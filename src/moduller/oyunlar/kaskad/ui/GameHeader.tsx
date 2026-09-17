/**
 * Üst bar — REALM OF STORMS markası, bakiye, çarpan, ayarlar.
 */

import React, { memo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { GAME_DISPLAY_NAME, GAME_SUBTITLE } from '../sabitler/KaskadSabitleri';
import { MultiplierRenderer } from '../multipliers/MultiplierRenderer';

type Props = {
  balance: number;
  musicOn: boolean;
  sfxOn: boolean;
  hapticsOn: boolean;
  multiplierTotal: number;
  persistentMultiplier?: number;
  bonusLabel?: string | null;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
  onToggleHaptics: () => void;
  onInfo: () => void;
  onClose: () => void;
  compact?: boolean;
};

function GameHeaderInner({
  balance,
  musicOn,
  sfxOn,
  hapticsOn,
  multiplierTotal,
  persistentMultiplier = 0,
  bonusLabel,
  onToggleMusic,
  onToggleSfx,
  onToggleHaptics,
  onInfo,
  onClose,
  compact = false,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        <Text style={styles.logo}>{GAME_DISPLAY_NAME.toUpperCase()}</Text>
        <Text style={styles.subtitle}>
          {bonusLabel ?? GAME_SUBTITLE.toUpperCase()}
        </Text>
      </View>

      <View style={styles.right}>
        {multiplierTotal > 1 ? (
          <View style={styles.multChip}>
            <MultiplierRenderer total={multiplierTotal} />
          </View>
        ) : null}
        {persistentMultiplier > 0 ? (
          <View style={[styles.multChip, styles.persistChip]}>
            <Text style={styles.persistText}>Σ {persistentMultiplier}×</Text>
          </View>
        ) : null}
        <View style={styles.balanceChip}>
          <Ionicons name="server" size={12} color={RenkTokenlari.accent} />
          <Text style={styles.balance}>
            {Math.floor(balance).toLocaleString('tr-TR')}
          </Text>
        </View>
        <Pressable
          onPress={() => setSettingsOpen(true)}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityLabel="Ayarlar"
        >
          <Ionicons name="settings-outline" size={20} color={RenkTokenlari.textMuted} />
        </Pressable>
      </View>

      <Modal
        visible={settingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSettingsOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Oyun Ayarları</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Müzik</Text>
              <Switch value={musicOn} onValueChange={onToggleMusic} />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Ses efektleri</Text>
              <Switch value={sfxOn} onValueChange={onToggleSfx} />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Titreşim</Text>
              <Switch value={hapticsOn} onValueChange={onToggleHaptics} />
            </View>
            <Pressable
              style={styles.sheetBtn}
              onPress={() => {
                setSettingsOpen(false);
                onInfo();
              }}
            >
              <Text style={styles.sheetBtnText}>Ödeme tablosu</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetBtn, styles.sheetBtnSecondary]}
              onPress={() => setSettingsOpen(false)}
            >
              <Text style={styles.sheetBtnText}>Kapat</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  rowCompact: {
    paddingVertical: 4,
  },
  brand: { flex: 1 },
  logo: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  subtitle: {
    color: RenkTokenlari.violet,
    fontSize: TipografiTokenlari.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginTop: 2,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.45)',
  },
  persistChip: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.5)',
  },
  persistText: {
    color: '#C4B5FD',
    fontWeight: '800',
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  iconBtn: { padding: 4 },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  exitLabel: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.caption.fontSize,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: '82%',
    backgroundColor: RenkTokenlari.bgElevated,
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.lg,
    gap: 12,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  sheetTitle: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '800',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.body.fontSize,
  },
  sheetBtn: {
    marginTop: 4,
    backgroundColor: RenkTokenlari.primary,
    borderRadius: YaricapTokenlari.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetBtnSecondary: {
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  sheetBtnText: { color: '#fff', fontWeight: '700' },
});
