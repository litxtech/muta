/**
 * NOX REELS — tek makara.
 * Yukarıdan aşağı tek kısa kayış: eski üçlü çıkar, yeni üçlü yerine oturur.
 * Uzun strip / çoklu viewport turu yok.
 */

import React, { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import type { SlotQualityMode, SlotSymbolId } from '../tipler/SlotTipleri';
import { ANIMATION_CONFIG } from '../sabitler/AnimasyonAyarlari';
import { reelStopDelayMs } from '../motor/MakaraMotoru';
import { Sembol } from './Sembol';

type Props = {
  reelIndex: number;
  symbols: [SlotSymbolId, SlotSymbolId, SlotSymbolId];
  spinning: boolean;
  landing: boolean;
  spinToken: number;
  symbolSize: number;
  quality: SlotQualityMode;
  winningMask?: boolean[];
  dimLosers?: boolean;
  onStopped?: (reelIndex: number) => void;
};

/** Eski → yeni arası tek filler hücre; travel ≈ 1.3 viewport (tek geçiş) */
const PASS = 1;
const POOL: SlotSymbolId[] = [
  'J',
  'Q',
  'K',
  'A',
  'GEM',
  'RING',
  'CROWN',
  'WATCH',
  'DIAMOND',
  'ROYAL_CROWN',
  'WILD',
  'SCATTER',
];

function fillRandom(count: number, seed: number): SlotSymbolId[] {
  const out: SlotSymbolId[] = [];
  let s = seed >>> 0;
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out.push(POOL[s % POOL.length]!);
  }
  return out;
}

/** offset 0 = önceki üçlü; travel sonunda = yeni üçlü */
function buildDropStrip(
  from: [SlotSymbolId, SlotSymbolId, SlotSymbolId],
  to: [SlotSymbolId, SlotSymbolId, SlotSymbolId],
  seed: number,
): SlotSymbolId[] {
  return [...from, ...fillRandom(PASS, seed), ...to];
}

function MakaraInner({
  reelIndex,
  symbols,
  spinning,
  landing,
  spinToken,
  symbolSize,
  quality,
  winningMask,
  dimLosers,
  onStopped,
}: Props) {
  const offset = useSharedValue(0);
  const blur = useSharedValue(0);
  const cell = symbolSize + 8;
  const notified = useRef(false);
  const fromRef = useRef<[SlotSymbolId, SlotSymbolId, SlotSymbolId]>([
    symbols[0],
    symbols[1],
    symbols[2],
  ]);
  const symbolsRef = useRef(symbols);
  const onStoppedRef = useRef(onStopped);
  const [strip, setStrip] = useState<SlotSymbolId[]>(() => [
    symbols[0],
    symbols[1],
    symbols[2],
  ]);
  const droppedToken = useRef(0);

  symbolsRef.current = symbols;
  onStoppedRef.current = onStopped;

  useEffect(() => {
    if (!spinning) {
      fromRef.current = [symbols[0], symbols[1], symbols[2]];
    }
  }, [spinning, symbols[0], symbols[1], symbols[2]]);

  useEffect(() => {
    const snapIdle = () => {
      const final = symbolsRef.current;
      fromRef.current = [final[0], final[1], final[2]];
      setStrip((prev) => {
        if (
          prev.length === 3 &&
          prev[0] === final[0] &&
          prev[1] === final[1] &&
          prev[2] === final[2]
        ) {
          return prev;
        }
        return [final[0], final[1], final[2]];
      });
      offset.value = 0;
      blur.value = 0;
    };

    const notifyStopped = () => {
      if (notified.current) return;
      notified.current = true;
      snapIdle();
      onStoppedRef.current?.(reelIndex);
    };

    if (!spinning) {
      cancelAnimation(offset);
      cancelAnimation(blur);
      snapIdle();
      return;
    }

    // Sonuç yok: önceki kartlar yerinde, hafif blur (tur atmadan bekle)
    if (!landing) {
      notified.current = false;
      blur.value = withTiming(0.55, { duration: 120 });
      return;
    }

    // Aynı token ile tekrar tetikleme
    if (droppedToken.current === spinToken && notified.current) return;
    droppedToken.current = spinToken;
    notified.current = false;

    const from = fromRef.current;
    const to = symbolsRef.current;
    const seed = Math.max(1, spinToken) * 17 + reelIndex * 31;
    const dropStrip = buildDropStrip(from, to, seed);
    setStrip(dropStrip);

    const travel = cell * (3 + PASS);
    const delay = reelStopDelayMs(reelIndex);
    const duration =
      ANIMATION_CONFIG.spinAccelMs +
      ANIMATION_CONFIG.spinCruiseMs +
      ANIMATION_CONFIG.spinDecelMs;

    cancelAnimation(offset);
    cancelAnimation(blur);
    offset.value = 0;
    blur.value = withTiming(0.7, { duration: 80 });

    const onDone = (finished?: boolean) => {
      'worklet';
      if (!finished) return;
      runOnJS(notifyStopped)();
    };

    // Tek hareket: kısa kayış, yumuşak oturuş — tur yok
    blur.value = withDelay(
      delay,
      withTiming(0, {
        duration: Math.max(90, duration * 0.4),
        easing: Easing.out(Easing.quad),
      }),
    );

    offset.value = withDelay(
      delay,
      withTiming(
        travel,
        {
          duration,
          easing: Easing.bezier(0.22, 0.92, 0.28, 1),
        },
        onDone,
      ),
    );
  }, [spinning, landing, spinToken, reelIndex, cell, offset, blur]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -offset.value }],
  }));

  const blurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      blur.value,
      [0, 1],
      [0, quality === 'LOW' ? 0.08 : 0.22],
    ),
  }));

  const viewportH = cell * 3;
  const idle = !spinning;
  const winPulse = idle && (winningMask?.some(Boolean) ?? false);

  return (
    <View style={[styles.viewport, { width: symbolSize, height: viewportH }]}>
      <Animated.View style={style}>
        {strip.map((id, i) => {
          const row = idle ? i : -1;
          const win = idle && winningMask?.[row] === true;
          const dim =
            idle && dimLosers === true && winningMask && !winningMask[row];
          return (
            <View
              key={`cell-${reelIndex}-${i}`}
              style={{
                height: cell,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sembol
                id={id}
                size={symbolSize}
                quality={spinning ? 'LOW' : quality}
                winning={winPulse ? win : false}
                dimmed={dim === true}
              />
            </View>
          );
        })}
      </Animated.View>

      {spinning ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, blurStyle]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(180,160,255,0.12)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(6,8,18,0.75)', 'transparent']}
        style={styles.vignetteTop}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(6,8,18,0.75)']}
        style={styles.vignetteBot}
      />
    </View>
  );
}

export const Makara = memo(MakaraInner);

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden' },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 14,
  },
  vignetteBot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 14,
  },
});
