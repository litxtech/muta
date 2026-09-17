/**
 * NOX REELS — 5 makara alanı + metalik çerçeve.
 */

import React, { memo, useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SlotGrid, SlotPaylineWin, SlotQualityMode } from '../tipler/SlotTipleri';
import { Makara } from './Makara';
import { playSlotSfx } from '../ses/SlotSesYoneticisi';

type Props = {
  grid: SlotGrid;
  spinning: boolean;
  /** Sunucu sonucu geldi — makaralar inişe geçer */
  landing: boolean;
  spinToken: number;
  symbolSize: number;
  quality: SlotQualityMode;
  activeWins?: SlotPaylineWin[];
  onAllStopped?: () => void;
};

function MakaraAlaniInner({
  grid,
  spinning,
  landing,
  spinToken,
  symbolSize,
  quality,
  activeWins,
  onAllStopped,
}: Props) {
  const stopped = useRef(new Set<number>());

  const handleStop = useCallback(
    (reel: number) => {
      playSlotSfx('reel_stop');
      stopped.current.add(reel);
      if (stopped.current.size >= 5) {
        stopped.current.clear();
        onAllStopped?.();
      }
    },
    [onAllStopped],
  );

  if (spinning && stopped.current.size > 0) {
    stopped.current.clear();
  }

  const winMask: boolean[][] = [
    [false, false, false],
    [false, false, false],
    [false, false, false],
    [false, false, false],
    [false, false, false],
  ];
  for (const w of activeWins ?? []) {
    for (const p of w.positions) {
      if (winMask[p.reel]) winMask[p.reel]![p.row] = true;
    }
  }
  const dimLosers = (activeWins?.length ?? 0) > 0;
  const cellGap = 5;
  const boardW = symbolSize * 5 + cellGap * 4 + 20;
  const boardH = (symbolSize + 8) * 3 + 20;

  return (
    <View style={styles.wrap}>
      {/* Dış metal çerçeve */}
      <LinearGradient
        colors={['#3D2A10', '#C9A24A', '#5C4010', '#E8C547', '#2A1C08']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.outerFrame, { width: boardW + 10, padding: 3 }]}
      >
        <LinearGradient
          colors={['#1A1030', '#080A14', '#140820']}
          style={[styles.inner, { minHeight: boardH }]}
        >
          {/* Yatay payline kılavuzları */}
          <View pointerEvents="none" style={styles.guides}>
            {[0.16, 0.5, 0.84].map((p) => (
              <View
                key={p}
                style={[
                  styles.guide,
                  { top: `${p * 100}%`, opacity: dimLosers ? 0.15 : 0.28 },
                ]}
              />
            ))}
          </View>

          <View style={[styles.row, { gap: cellGap }]}>
            {[0, 1, 2, 3, 4].map((reel) => (
              <View key={reel} style={styles.reelCol}>
                <Makara
                  reelIndex={reel}
                  symbols={[
                    grid[reel]?.[0] ?? 'A',
                    grid[reel]?.[1] ?? 'K',
                    grid[reel]?.[2] ?? 'Q',
                  ]}
                  spinning={spinning}
                  landing={landing}
                  spinToken={spinToken}
                  symbolSize={symbolSize}
                  quality={quality}
                  winningMask={winMask[reel]}
                  dimLosers={dimLosers}
                  onStopped={handleStop}
                />
                {/* Makara ayırıcı */}
                {reel < 4 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>

          {/* Cam yansıma */}
          {quality !== 'LOW' ? (
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.08)', 'transparent', 'transparent']}
              style={styles.glass}
            />
          ) : null}
        </LinearGradient>
      </LinearGradient>

      {/* Altın köşe ışıkları */}
      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />
    </View>
  );
}

export const MakaraAlani = memo(MakaraAlaniInner);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerFrame: {
    borderRadius: 18,
    alignSelf: 'center',
  },
  inner: {
    borderRadius: 15,
    padding: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(183,148,246,0.25)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  reelCol: {
    position: 'relative',
  },
  divider: {
    position: 'absolute',
    right: -3,
    top: 8,
    bottom: 8,
    width: 1,
    backgroundColor: 'rgba(232,197,71,0.2)',
  },
  guides: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
  },
  guide: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 1,
    backgroundColor: 'rgba(232,197,71,0.35)',
  },
  glass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  corner: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#FFE08A',
    opacity: 0.7,
  },
  tl: { top: 2, left: 2 },
  tr: { top: 2, right: 2 },
  bl: { bottom: 2, left: 2 },
  br: { bottom: 2, right: 2 },
});
