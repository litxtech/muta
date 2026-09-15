/**
 * 8×8 oyun tahtası — swipe + cascade FX (temizlenme / spawn / sarsıntı).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { BoardState, GridPos } from '../tipler/KristalTipleri';
import { BOARD_SIZE } from '../sabitler/KristalSabitleri';
import { posKey } from '../motor/TahtaYardimcilari';
import type { BoardFx } from '../animasyon/CascadeOynatici';
import { BOS_FX } from '../animasyon/CascadeOynatici';
import { OyunTasi } from './OyunTasi';

type Props = {
  board: BoardState;
  locked?: boolean;
  fx?: BoardFx;
  onSwipe: (from: GridPos, to: GridPos) => void;
};

const SWIPE_THRESHOLD = 18;

export function OyunTahtasi({
  board,
  locked = false,
  fx = BOS_FX,
  onSwipe,
}: Props) {
  const [boardWidth, setBoardWidth] = useState(0);
  const [selected, setSelected] = useState<GridPos | null>(null);
  const startRow = useSharedValue(-1);
  const startCol = useSharedValue(-1);
  const shakeX = useSharedValue(0);

  const size = board.size || BOARD_SIZE;
  const cellSize = boardWidth > 0 ? Math.floor((boardWidth - 4) / size) : 0;

  useEffect(() => {
    if (!fx.shake) return;
    shakeX.value = withSequence(
      withTiming(-8, { duration: 40 }),
      withTiming(8, { duration: 50 }),
      withTiming(-6, { duration: 40 }),
      withTiming(6, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
  }, [fx.shake, shakeX]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setBoardWidth(e.nativeEvent.layout.width);
  }, []);

  const emitSwipe = useCallback(
    (from: GridPos, dir: 'up' | 'down' | 'left' | 'right') => {
      if (locked) return;
      const to: GridPos = { ...from };
      if (dir === 'up') to.row -= 1;
      if (dir === 'down') to.row += 1;
      if (dir === 'left') to.col -= 1;
      if (dir === 'right') to.col += 1;
      if (to.row < 0 || to.col < 0 || to.row >= size || to.col >= size) return;
      onSwipe(from, to);
      setSelected(null);
    },
    [locked, onSwipe, size],
  );

  const onTapCell = useCallback(
    (pos: GridPos) => {
      if (locked) return;
      if (!selected) {
        setSelected(pos);
        return;
      }
      if (selected.row === pos.row && selected.col === pos.col) {
        setSelected(null);
        return;
      }
      const adj =
        (Math.abs(selected.row - pos.row) === 1 && selected.col === pos.col) ||
        (Math.abs(selected.col - pos.col) === 1 && selected.row === pos.row);
      if (adj) {
        onSwipe(selected, pos);
        setSelected(null);
      } else {
        setSelected(pos);
      }
    },
    [locked, onSwipe, selected],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!locked)
        .onBegin((e) => {
          if (cellSize <= 0) return;
          const col = Math.floor(e.x / cellSize);
          const row = Math.floor(e.y / cellSize);
          startRow.value = row;
          startCol.value = col;
        })
        .onEnd((e) => {
          const row = startRow.value;
          const col = startCol.value;
          if (row < 0 || col < 0) return;
          const dx = e.translationX;
          const dy = e.translationY;
          if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
            runOnJS(onTapCell)({ row, col });
            return;
          }
          if (Math.abs(dx) > Math.abs(dy)) {
            runOnJS(emitSwipe)({ row, col }, dx > 0 ? 'right' : 'left');
          } else {
            runOnJS(emitSwipe)({ row, col }, dy > 0 ? 'down' : 'up');
          }
        }),
    [cellSize, emitSwipe, locked, onTapCell, startCol, startRow],
  );

  const gridAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.grid,
            {
              width: cellSize * size,
              height: cellSize * size,
            },
            gridAnim,
          ]}
        >
          {cellSize > 0
            ? board.cells.map((row, r) =>
                row.map((cell, c) => {
                  const key = posKey({ row: r, col: c });
                  return (
                    <View
                      key={cell.id}
                      style={{ width: cellSize, height: cellSize, padding: 2 }}
                    >
                      <OyunTasi
                        cell={cell}
                        size={cellSize - 4}
                        selected={
                          !!selected &&
                          selected.row === r &&
                          selected.col === c
                        }
                        clearing={fx.clearing.has(key)}
                        spawning={fx.spawning.has(cell.id)}
                      />
                    </View>
                  );
                }),
              )
            : null}
        </Animated.View>
      </GestureDetector>

      {fx.floatingScore != null && fx.floatingScore > 0 ? (
        <View pointerEvents="none" style={styles.floatWrap}>
          <Text style={styles.floatScore}>
            +{fx.floatingScore.toLocaleString('tr-TR')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.bgElevated,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    padding: BoslukTokenlari.xs,
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  floatWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatScore: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.accent,
    fontWeight: '900',
    fontSize: 36,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
