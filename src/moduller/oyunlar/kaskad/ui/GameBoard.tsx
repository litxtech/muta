/**
 * 6×5 oyun tahtası — kolon tünelleri, ornate gold frame, tumble partikülleri.
 */

import React, { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { dusmeSuresiMs } from '../../ortak/grid/DusmeMesafeleri';
import { GRID_COLUMNS, GRID_ROWS } from '../sabitler/KaskadSabitleri';
import type {
  GridCell,
  GridMatrix,
  PerformanceProfile,
} from '../tipler/KaskadTipleri';
import {
  SymbolRenderer,
  type SymbolVisualState,
} from '../symbols/SymbolRenderer';
import {
  isEmptyInstanceId,
  isMultiplier,
  isScatter,
} from '../symbols/SymbolRules';
import {
  ParticleBurst,
  newBurstId,
  type ActiveBurst,
} from '../animasyonlar/ParticleController';
import { STORM_ART_BIBLE } from '../assets/ArtBible';

const BOARD_PAD = 6;
const MAX_BOARD_WIDTH = 412;
const MAX_ACTIVE_BURSTS = 10;
const REEL_GAP = 3;
const P = STORM_ART_BIBLE.palette;

type Props = {
  grid: GridMatrix;
  matchedIds?: ReadonlySet<string>;
  destroyingIds?: ReadonlySet<string>;
  dropping?: Record<string, number>;
  anticipation?: boolean;
  performance?: PerformanceProfile;
  bonusMode?: boolean;
  speedFactor?: number;
};

function ReelSymbol({
  cell,
  size,
  visualState,
  dropDistanceCells,
  dropDurationMs,
  dropDelayMs,
  performance,
}: {
  cell: GridCell;
  size: number;
  visualState: SymbolVisualState;
  dropDistanceCells: number;
  dropDurationMs: number;
  dropDelayMs: number;
  performance: PerformanceProfile;
}) {
  const targetY = cell.row * size;
  const y = useSharedValue(
    dropDistanceCells > 0 ? targetY - dropDistanceCells * size : targetY,
  );

  useEffect(() => {
    const target = cell.row * size;
    if (dropDistanceCells > 0) {
      y.value = target - dropDistanceCells * size;
      y.value = withDelay(
        dropDelayMs,
        withTiming(target, {
          duration: Math.max(dropDurationMs, 1),
          easing: Easing.bezier(0.2, 0.86, 0.24, 1),
        }),
      );
      return;
    }
    y.value = target;
  }, [
    cell.instanceId,
    cell.row,
    dropDelayMs,
    dropDistanceCells,
    dropDurationMs,
    size,
    y,
  ]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          width: size,
          height: size,
        },
        anim,
      ]}
    >
      <SymbolRenderer
        cell={cell}
        size={size}
        visualState={visualState}
        dropDistanceCells={0}
        performance={performance}
      />
    </Animated.View>
  );
}

function GameBoardInner({
  grid,
  matchedIds,
  destroyingIds,
  dropping,
  anticipation = false,
  performance = 'HIGH',
  bonusMode = false,
  speedFactor = 1,
}: Props) {
  const { width } = useWindowDimensions();
  const maxW = Math.min(width - 12, MAX_BOARD_WIDTH);
  const inner = maxW - BOARD_PAD * 2;
  const cell = Math.floor((inner - REEL_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  const boardW = cell * GRID_COLUMNS + REEL_GAP * (GRID_COLUMNS - 1) + BOARD_PAD * 2;
  const highlightActive = (matchedIds?.size ?? 0) > 0;
  const [bursts, setBursts] = useState<ActiveBurst[]>([]);
  const framePulse = useSharedValue(0.45);

  const columns = useMemo(() => {
    const cols: GridCell[][] = Array.from({ length: GRID_COLUMNS }, () => []);
    for (const row of grid) {
      for (const cellData of row) {
        if (!isEmptyInstanceId(cellData.instanceId)) {
          cols[cellData.column]?.push(cellData);
        }
      }
    }
    return cols;
  }, [grid]);

  const flat = useMemo(() => grid.flat(), [grid]);

  useEffect(() => {
    if (anticipation || bonusMode) {
      framePulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.4, { duration: 420, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      framePulse.value = withTiming(0.45, { duration: 280 });
    }
  }, [anticipation, bonusMode, framePulse]);

  useEffect(() => {
    if (!destroyingIds || destroyingIds.size === 0) return;
    if (performance === 'LOW') return;
    const limit =
      performance === 'MEDIUM' ? 4 : Math.min(8, destroyingIds.size);
    const next: ActiveBurst[] = [];
    for (const c of flat) {
      if (!destroyingIds.has(c.instanceId)) continue;
      if (next.length >= limit) break;
      next.push({
        id: newBurstId(),
        preset: isMultiplier(c.symbolType)
          ? 'MULTIPLIER_ENERGY'
          : isScatter(c.symbolType)
            ? 'SCATTER_PORTAL'
            : 'CRYSTAL_BREAK',
        x: c.column * (cell + REEL_GAP) + cell / 2,
        y: c.row * cell + cell / 2,
      });
    }
    if (next.length > 0) {
      setBursts((prev) => [...prev, ...next].slice(-MAX_ACTIVE_BURSTS));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destroyingIds]);

  const frameOuter = bonusMode
    ? 'rgba(167,139,250,0.85)'
    : anticipation
      ? P.electricCyan
      : P.antiqueGold;

  const frameGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + framePulse.value * 0.55,
    shadowOpacity: 0.25 + framePulse.value * 0.55,
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.frameOuter,
          { borderColor: frameOuter, shadowColor: frameOuter },
          frameGlowStyle,
        ]}
      >
        <View style={[styles.frameMid, { borderColor: 'rgba(255,224,138,0.35)' }]}>
          <LinearGradient
            colors={
              bonusMode
                ? (['#1A0A2E', '#120818', '#0B0614'] as const)
                : (['#16122A', '#0E1220', '#0A0C16'] as const)
            }
            style={[
              styles.board,
              {
                width: boardW,
                borderColor: bonusMode
                  ? 'rgba(167,139,250,0.4)'
                  : 'rgba(201,162,74,0.4)',
              },
            ]}
          >
            <View style={styles.reels}>
              {columns.map((colCells, col) => {
                const colMax = colCells.reduce(
                  (m, c) => Math.max(m, dropping?.[c.instanceId] ?? 0),
                  0,
                );
                return (
                <View
                  key={`reel-${col}`}
                  style={[
                    styles.reel,
                    {
                      width: cell,
                      height: cell * GRID_ROWS,
                      marginRight: col === GRID_COLUMNS - 1 ? 0 : REEL_GAP,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={
                      col % 2 === 0
                        ? (['rgba(255,224,138,0.03)', 'rgba(0,0,0,0.12)'] as const)
                        : (['rgba(255,224,138,0.015)', 'rgba(0,0,0,0.16)'] as const)
                    }
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  {Array.from({ length: GRID_ROWS }, (_, r) => (
                    <View
                      key={`slot-${col}-${r}`}
                      pointerEvents="none"
                      style={[
                        styles.slot,
                        {
                          top: r * cell,
                          height: cell,
                        },
                      ]}
                    />
                  ))}
                  {colCells.map((cellData) => {
                    let visual: SymbolVisualState = 'normal';
                    if (destroyingIds?.has(cellData.instanceId)) visual = 'destroy';
                    else if (matchedIds?.has(cellData.instanceId)) visual = 'matched';
                    else if (anticipation && isScatter(cellData.symbolType)) {
                      visual = 'anticipation';
                    } else if (highlightActive) visual = 'dimmed';

                    const dist = dropping?.[cellData.instanceId] ?? 0;
                    return (
                      <ReelSymbol
                        key={cellData.instanceId}
                        cell={cellData}
                        size={cell}
                        visualState={visual}
                        dropDistanceCells={dist}
                        dropDurationMs={dusmeSuresiMs(
                          dist > 0 ? colMax : 0,
                          speedFactor,
                        )}
                        dropDelayMs={0}
                        performance={performance}
                      />
                    );
                  })}
                  <View
                    pointerEvents="none"
                    style={[styles.reelRail, styles.reelRailLeft]}
                  />
                  <View
                    pointerEvents="none"
                    style={[styles.reelRail, styles.reelRailRight]}
                  />
                </View>
                );
              })}
              {bursts.map((b) => (
                <ParticleBurst
                  key={b.id}
                  preset={b.preset}
                  performance={performance}
                  x={b.x}
                  y={b.y}
                  onDone={() =>
                    setBursts((prev) => prev.filter((p) => p.id !== b.id))
                  }
                />
              ))}
            </View>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
}

export const GameBoard = memo(GameBoardInner);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameOuter: {
    borderRadius: 20,
    borderWidth: 2.5,
    padding: 4,
    backgroundColor: '#0A0C16',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  frameMid: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 2,
    overflow: 'hidden',
    backgroundColor: '#070910',
  },
  board: {
    borderRadius: 14,
    borderWidth: 1,
    padding: BOARD_PAD,
  },
  reels: {
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
  },
  reel: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#05070F',
  },
  slot: {
    position: 'absolute',
    left: 3,
    right: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(201,162,74,0.16)',
  },
  reelRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: 'rgba(255,224,138,0.38)',
  },
  reelRailLeft: { left: 0 },
  reelRailRight: { right: 0 },
});
