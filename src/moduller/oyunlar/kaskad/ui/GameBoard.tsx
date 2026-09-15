/**
 * 6×5 oyun tahtası — hücre bazlı memo grid.
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRID_COLUMNS, GRID_ROWS } from '../sabitler/KaskadSabitleri';
import type { GridMatrix, PerformanceProfile } from '../tipler/KaskadTipleri';
import { SymbolRenderer, type SymbolVisualState } from '../symbols/SymbolRenderer';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { YaricapTokenlari } from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { DROP_MS_PER_CELL } from '../sabitler/KaskadSabitleri';

type Props = {
  grid: GridMatrix;
  matchedIds?: ReadonlySet<string>;
  destroyingIds?: ReadonlySet<string>;
  dropping?: Record<string, number>;
  performance?: PerformanceProfile;
  bonusMode?: boolean;
  speedFactor?: number;
};

function GameBoardInner({
  grid,
  matchedIds,
  destroyingIds,
  dropping,
  performance = 'HIGH',
  bonusMode = false,
  speedFactor = 1,
}: Props) {
  const { width } = useWindowDimensions();
  const boardPad = 12;
  const maxW = Math.min(width - 28, 420);
  const cell = Math.floor((maxW - boardPad * 2) / GRID_COLUMNS);

  const flat = useMemo(() => grid.flat(), [grid]);

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={
          bonusMode
            ? ['#2A1040', '#1A0A28', '#120818']
            : [RenkTokenlari.bgCard, '#16101F', RenkTokenlari.bg]
        }
        style={[
          styles.board,
          {
            width: cell * GRID_COLUMNS + boardPad * 2,
            borderColor: bonusMode
              ? 'rgba(167,139,250,0.55)'
              : RenkTokenlari.borderAccent,
          },
        ]}
      >
        <View
          style={[
            styles.grid,
            {
              width: cell * GRID_COLUMNS,
              height: cell * GRID_ROWS,
            },
          ]}
        >
          {flat.map((cellData) => {
            let visual: SymbolVisualState = 'normal';
            if (destroyingIds?.has(cellData.instanceId)) visual = 'destroy';
            else if (matchedIds?.has(cellData.instanceId)) visual = 'matched';

            const dist = dropping?.[cellData.instanceId] ?? 0;
            const capped = Math.min(5, Math.max(0, dist)) as 0 | 1 | 2 | 3 | 4 | 5;
            const baseMs =
              capped === 0
                ? 0
                : DROP_MS_PER_CELL[capped as 1 | 2 | 3 | 4 | 5] ?? 260;

            return (
              <SymbolRenderer
                key={cellData.instanceId}
                cell={cellData}
                size={cell}
                visualState={visual}
                dropDistanceCells={dist}
                dropDurationMs={Math.round(baseMs * speedFactor)}
                performance={performance}
              />
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}

export const GameBoard = memo(GameBoardInner);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  board: {
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    padding: 12,
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
