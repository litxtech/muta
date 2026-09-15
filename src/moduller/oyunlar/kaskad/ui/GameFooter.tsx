/**
 * Alt kontrol — bahis, spin, autoplay.
 */

import React, { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { AUTOPLAY_OPTIONS } from '../sabitler/KaskadSabitleri';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  bet: number;
  winDisplay: number;
  spinning: boolean;
  canSpin: boolean;
  fastMode: boolean;
  autoplayLeft: number;
  onBetDown: () => void;
  onBetUp: () => void;
  onSpin: () => void;
  onToggleFast: () => void;
  onAutoplay: (n: number) => void;
  onStopAutoplay: () => void;
  onPaytable: () => void;
};

function GameFooterInner({
  bet,
  winDisplay,
  spinning,
  canSpin,
  fastMode,
  autoplayLeft,
  onBetDown,
  onBetUp,
  onSpin,
  onToggleFast,
  onAutoplay,
  onStopAutoplay,
  onPaytable,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.winRow}>
        <Text style={styles.winLabel}>KAZANÇ</Text>
        <Text style={styles.winValue}>{Math.floor(winDisplay)}</Text>
      </View>

      <View style={styles.betRow}>
        <Pressable style={styles.betBtn} onPress={onBetDown} disabled={spinning}>
          <Text style={styles.betBtnText}>−</Text>
        </Pressable>
        <View style={styles.betMid}>
          <Text style={styles.betLabel}>BAHİS</Text>
          <Text style={styles.betValue}>{bet}</Text>
        </View>
        <Pressable style={styles.betBtn} onPress={onBetUp} disabled={spinning}>
          <Text style={styles.betBtnText}>+</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onSpin}
        disabled={!canSpin || spinning}
        style={[styles.spinWrap, (!canSpin || spinning) && styles.spinDisabled]}
      >
        <LinearGradient
          colors={[...RenkTokenlari.gradientPrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.spin}
        >
          {spinning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.spinText}>SPIN</Text>
          )}
        </LinearGradient>
      </Pressable>

      <View style={styles.tools}>
        <Pressable style={[styles.chip, fastMode && styles.chipOn]} onPress={onToggleFast}>
          <Text style={[styles.chipText, fastMode && styles.chipTextOn]}>HIZLI</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={onPaytable}>
          <Text style={styles.chipText}>ÖDEME</Text>
        </Pressable>
        {autoplayLeft > 0 ? (
          <Pressable style={[styles.chip, styles.chipOn]} onPress={onStopAutoplay}>
            <Text style={[styles.chipText, styles.chipTextOn]}>DUR {autoplayLeft}</Text>
          </Pressable>
        ) : (
          AUTOPLAY_OPTIONS.map((n) => (
            <Pressable key={n} style={styles.chip} onPress={() => onAutoplay(n)}>
              <Text style={styles.chipText}>A{n}</Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

export const GameFooter = memo(GameFooterInner);

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.lg,
    gap: 10,
  },
  winRow: { alignItems: 'center' },
  winLabel: {
    color: RenkTokenlari.textDim,
    fontSize: TipografiTokenlari.micro.fontSize,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  winValue: {
    color: RenkTokenlari.mint,
    fontSize: TipografiTokenlari.title.fontSize,
    fontWeight: '800',
  },
  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  betBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  betBtnText: {
    color: RenkTokenlari.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: -2,
  },
  betMid: { alignItems: 'center', minWidth: 80 },
  betLabel: {
    color: RenkTokenlari.textDim,
    fontSize: TipografiTokenlari.micro.fontSize,
    fontWeight: '700',
  },
  betValue: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h1.fontSize,
    fontWeight: '800',
  },
  spinWrap: { alignSelf: 'center' },
  spinDisabled: { opacity: 0.45 },
  spin: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  spinText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  chipOn: {
    borderColor: RenkTokenlari.primary,
    backgroundColor: 'rgba(232,64,145,0.18)',
  },
  chipText: {
    color: RenkTokenlari.textMuted,
    fontSize: TipografiTokenlari.micro.fontSize,
    fontWeight: '700',
  },
  chipTextOn: { color: RenkTokenlari.primarySoft },
});
