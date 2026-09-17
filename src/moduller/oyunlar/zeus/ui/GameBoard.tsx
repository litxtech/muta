import React, { memo, useEffect, useLayoutEffect, useMemo } from 'react';
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
import {
  DUSME_BOUNCE_MS,
  dusmeSuresiMs,
} from '../../ortak/grid/DusmeMesafeleri';
import {
  GRID_COLUMNS,
  GRID_ROWS,
  ZEUS_PALETTE,
} from '../config/ZeusSabitleri';
import type { GridCell, GridMatrix, PerformanceProfile } from '../tipler/ZeusTipleri';
import {
  SymbolRenderer,
  type SymbolVisualState,
} from '../symbols/SymbolRenderer';
import { isEmptyInstanceId, isScatter } from '../symbols/SymbolRules';

const BOARD_PAD = 5;
const MAX_BOARD_WIDTH = 420;
const REEL_GAP = 4;
const FRAME_CHROME = 22;

type Props = {
  grid: GridMatrix;
  matchedIds?: ReadonlySet<string>;
  destroyingIds?: ReadonlySet<string>;
  dropping?: Record<string, number>;
  anticipation?: boolean;
  performance?: PerformanceProfile;
  bonusMode?: boolean;
  speedFactor?: number;
  compact?: boolean;
  maxHeight?: number;
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
  const startY =
    dropDistanceCells > 0 ? targetY - dropDistanceCells * size : targetY;
  const y = useSharedValue(startY);

  useLayoutEffect(() => {
    const target = cell.row * size;
    if (dropDistanceCells > 0) {
      y.value = target - dropDistanceCells * size;
      y.value = withDelay(
        dropDelayMs,
        withSequence(
          withTiming(target + Math.min(5, size * 0.06), {
            duration: Math.max(dropDurationMs, 1),
            easing: Easing.bezier(0.2, 0.78, 0.22, 1),
          }),
          withTiming(target, {
            duration: DUSME_BOUNCE_MS,
            easing: Easing.out(Easing.cubic),
          }),
        ),
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
  compact = false,
  maxHeight,
}: Props) {
  const { width } = useWindowDimensions();
  const maxW = Math.min(
    width - (compact ? 18 : 12),
    compact ? 360 : MAX_BOARD_WIDTH,
  );
  const innerW = maxW - BOARD_PAD * 2;
  let cell = Math.floor(
    (innerW - REEL_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS,
  );
  if (maxHeight && maxHeight > 80) {
    const byH = Math.floor((maxHeight - FRAME_CHROME) / GRID_ROWS);
    cell = Math.min(cell, byH);
  }
  cell = Math.max(cell, compact ? 34 : 40);

  const boardW =
    cell * GRID_COLUMNS + REEL_GAP * (GRID_COLUMNS - 1) + BOARD_PAD * 2;
  const boardH = cell * GRID_ROWS + BOARD_PAD * 2;
  const highlightActive = (matchedIds?.size ?? 0) > 0;
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

  const frameOuter = bonusMode
    ? 'rgba(77,168,255,0.9)'
    : anticipation
      ? ZEUS_PALETTE.electricBlue
      : '#E8C547';

  const frameGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + framePulse.value * 0.55,
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
        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
        <View style={styles.frameMid}>
          <LinearGradient
            colors={
              bonusMode
                ? (['#24105A', '#14082E', '#070614'] as const)
                : (['#2A1A08', '#140E22', '#07070F'] as const)
            }
            style={[styles.board, { width: boardW, height: boardH }]}
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
                        ? ([
                            'rgba(62, 38, 14, 0.42)',
                            'rgba(28, 16, 8, 0.55)',
                            'rgba(16, 10, 6, 0.62)',
                          ] as const)
                        : ([
                            'rgba(48, 30, 12, 0.38)',
                            'rgba(22, 12, 8, 0.52)',
                            'rgba(12, 8, 5, 0.6)',
                          ] as const)
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
                  <LinearGradient
                    pointerEvents="none"
                    colors={[
                      'rgba(8, 4, 0, 0.14)',
                      'transparent',
                      'transparent',
                      'rgba(8, 4, 0, 0.12)',
                    ]}
                    locations={[0, 0.05, 0.95, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  {colCells.map((cellData) => {
                    let visual: SymbolVisualState = 'normal';
                    if (destroyingIds?.has(cellData.instanceId)) visual = 'destroy';
                    else if (matchedIds?.has(cellData.instanceId)) visual = 'matched';
                    else if (anticipation && isScatter(cellData.type)) {
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
            </View>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
}

export const GameBoard = memo(GameBoardInner);

const CORNER = {
  position: 'absolute' as const,
  width: 14,
  height: 14,
  borderColor: '#F6E27A',
};
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  frameOuter: {
    borderRadius: 18,
    borderWidth: 3,
    padding: 6,
    backgroundColor: '#1A1208',
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  frameMid: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(246,226,122,0.55)',
    padding: 3,
    backgroundColor: '#0A0814',
    overflow: 'hidden',
  },
  board: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  reels: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  reel: {
    overflow: 'hidden',
    borderRadius: 7,
    backgroundColor: '#120C08',
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 74, 0.28)',
  },
  slot: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(232,197,71,0.12)',
  },
  reelRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(246,226,122,0.38)',
  },
  reelRailLeft: { left: 0 },
  reelRailRight: { right: 0 },
  cornerTL: {
    ...CORNER,
    top: 2,
    left: 2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    ...CORNER,
    top: 2,
    right: 2,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    ...CORNER,
    bottom: 2,
    left: 2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    ...CORNER,
    bottom: 2,
    right: 2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
});
