/**
 * BetSelector — modern bahis seçici bottom sheet.
 * Bet seçenekleri backend config'ten gelir; client arbitrary bet gönderemez.
 */

import React, { memo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  visible: boolean;
  presets: readonly number[];
  current: number;
  balance: number;
  onSelect: (bet: number) => void;
  onClose: () => void;
};

function BetSelectorInner({
  visible,
  presets,
  current,
  balance,
  onSelect,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <LinearGradient
            colors={['rgba(26,36,68,0.98)', 'rgba(12,14,24,0.98)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.handle} />
          <Text style={styles.title}>Bahis seç</Text>
          <Text style={styles.hint}>Bakiyene uygun tutarı seç</Text>
          <View style={styles.grid}>
            {presets.map((p) => {
              const affordable = p <= balance;
              const active = p === current;
              return (
                <Pressable
                  key={p}
                  disabled={!affordable}
                  style={({ pressed }) => [
                    styles.chip,
                    active && styles.chipOn,
                    !affordable && styles.chipDisabled,
                    pressed && affordable && styles.chipPressed,
                  ]}
                  onPress={() => {
                    if (!affordable) return;
                    onSelect(p);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextOn,
                      !affordable && styles.chipTextDisabled,
                    ]}
                  >
                    {p.toLocaleString('tr-TR')}
                  </Text>
                  {active ? <Text style={styles.chipBadge}>AKTİF</Text> : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Kapat</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export const BetSelector = memo(BetSelectorInner);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: BoslukTokenlari.lg,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: 'rgba(201,162,74,0.3)',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: 12,
  },
  title: {
    color: '#F7F2E8',
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '900',
    textAlign: 'center',
  },
  hint: {
    color: RenkTokenlari.textMuted,
    fontSize: TipografiTokenlari.caption.fontSize,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  chip: {
    minWidth: 96,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: 'rgba(42,51,72,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  chipOn: {
    borderColor: 'rgba(232,64,145,0.75)',
    backgroundColor: 'rgba(232,64,145,0.2)',
  },
  chipPressed: {
    transform: [{ scale: 0.97 }],
  },
  chipDisabled: { opacity: 0.35 },
  chipText: {
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: TipografiTokenlari.body.fontSize,
  },
  chipTextOn: { color: '#FFB3D0' },
  chipTextDisabled: { color: RenkTokenlari.textDim },
  chipBadge: {
    marginTop: 4,
    color: '#FFB3D0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  close: {
    marginTop: 18,
    alignSelf: 'center',
    padding: 10,
  },
  closeText: {
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
});
