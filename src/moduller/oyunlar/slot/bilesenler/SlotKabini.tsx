/**
 * NOX REELS — kabin çerçevesi + yardımcı paneller.
 */

import React, { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SlotBigWinTickerItem } from '../servisler/SlotRealtimeServisi';
import { DEFAULT_MATH_CONFIG } from '../sabitler/SlotAyarlari';

export const SlotKabini = memo(function SlotKabini({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <LinearGradient
      colors={['#1A1030', '#0A0C18', '#12081F']}
      style={styles.cabin}
    >
      <View style={styles.frame}>{children}</View>
    </LinearGradient>
  );
});

export const SonKazananlarSeridi = memo(function SonKazananlarSeridi({
  items,
}: {
  items: SlotBigWinTickerItem[];
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.ticker}>
      {items.slice(0, 3).map((it) => (
        <Text key={it.id} style={styles.tickerTxt} numberOfLines={1}>
          {it.displayName} — {it.winAmount.toLocaleString('tr-TR')} coin
        </Text>
      ))}
    </View>
  );
});

export const OyunBilgiPaneli = memo(function OyunBilgiPaneli({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  if (!visible) return null;
  const pt = DEFAULT_MATH_CONFIG.paytable;
  return (
    <View style={styles.info}>
      <Text style={styles.infoTitle}>PAYTABLE</Text>
      {Object.entries(pt).map(([sym, rows]) =>
        rows ? (
          <Text key={sym} style={styles.infoRow}>
            {sym}: 3×{rows[3]} · 4×{rows[4]} · 5×{rows[5]}
          </Text>
        ) : null,
      )}
      <Pressable onPress={onClose} style={styles.infoClose}>
        <Text style={styles.infoCloseTxt}>Kapat</Text>
      </Pressable>
    </View>
  );
});

export const SesKontrolu = memo(function SesKontrolu({
  effects,
  music,
  onToggleEffects,
  onToggleMusic,
}: {
  effects: boolean;
  music: boolean;
  onToggleEffects: () => void;
  onToggleMusic: () => void;
}) {
  return (
    <View style={styles.audioRow}>
      <Pressable onPress={onToggleEffects} style={styles.chip}>
        <Text style={styles.chipTxt}>SFX {effects ? 'ON' : 'OFF'}</Text>
      </Pressable>
      <Pressable onPress={onToggleMusic} style={styles.chip}>
        <Text style={styles.chipTxt}>MUS {music ? 'ON' : 'OFF'}</Text>
      </Pressable>
    </View>
  );
});

export const OyunYukleniyor = memo(function OyunYukleniyor() {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingTxt}>NOX REELS</Text>
      <Text style={styles.loadingSub}>Sahne hazırlanıyor…</Text>
    </View>
  );
});

export const OtomatikOyunPaneli = memo(function OtomatikOyunPaneli({
  left,
  onStop,
}: {
  left: number;
  onStop: () => void;
}) {
  if (left <= 0) return null;
  return (
    <Pressable onPress={onStop} style={styles.auto}>
      <Text style={styles.autoTxt}>AUTO {left} · DURDUR</Text>
    </Pressable>
  );
});

export const KazancCizgisi = memo(function KazancCizgisi({
  lineIndex,
}: {
  lineIndex: number;
}) {
  return (
    <View pointerEvents="none" style={styles.lineHint}>
      <Text style={styles.lineTxt}>LINE {lineIndex + 1}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  cabin: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(183,148,246,0.35)',
  },
  frame: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(232,197,71,0.2)',
    margin: 3,
    borderRadius: 16,
  },
  ticker: {
    gap: 2,
    marginBottom: 6,
  },
  tickerTxt: {
    color: 'rgba(255,224,138,0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
    info: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(6,8,18,0.94)',
      padding: 20,
      zIndex: 20,
    },
  infoTitle: {
    color: '#FFE08A',
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 12,
  },
  infoRow: { color: '#E8E4F0', fontSize: 12, marginBottom: 4 },
  infoClose: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  infoCloseTxt: { color: '#FFF', fontWeight: '700' },
  audioRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipTxt: { color: '#D8D0E8', fontSize: 11, fontWeight: '700' },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  loadingTxt: {
    color: '#FFE08A',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
  },
  loadingSub: { color: 'rgba(255,255,255,0.5)', marginTop: 8 },
  auto: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(232,197,71,0.2)',
  },
  autoTxt: { color: '#FFE08A', fontWeight: '800', fontSize: 12 },
  lineHint: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,216,107,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lineTxt: { color: '#FFE08A', fontWeight: '800', fontSize: 11 },
});
