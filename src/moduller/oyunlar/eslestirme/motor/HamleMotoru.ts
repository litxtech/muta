/**
 * Hamle motoru — swap → eşleşme → özel → düşürme → doldurma → cascade.
 * `steps` ara tahta anlıklarını taşır; UI animasyon bitene kadar input kilidi tutar.
 */

import type {
  BoardState,
  CascadeEvent,
  CascadeResult,
  CascadeStep,
  GridPos,
  SeededRandom,
  SpecialType,
} from '../tipler/KristalTipleri';
import { MAX_CASCADE_STEPS } from '../sabitler/KristalSabitleri';
import { allMatchedPositions, findMatches } from './EslesmeBulucu';
import { areAdjacent, isValidSwap } from './HamleKontrolu';
import { comboLevelFromCascade } from './ComboMotoru';
import { scoreClearedSpecials, scoreMatchGroups } from './SkorMotoru';
import { swapCells } from './TasDegistirici';
import { applyGravity } from './TasDusurucu';
import { fillEmptyCells } from './YeniTasOlusturucu';
import { hasValidMove } from './GecerliHamleBulucu';
import { shuffleBoard } from './TahtaKaristirici';
import { cloneBoard, getCell, posKey } from './TahtaYardimcilari';
import {
  clearPositions,
  placeSpecialsFromMatches,
} from '../ozeltaslar/OzelTasMotoru';
import {
  getSwapSpecialClears,
  shouldActivateOnSwap,
} from '../ozeltaslar/OzelTasKombinasyonlari';

function pushStep(
  events: CascadeEvent[],
  steps: CascadeStep[],
  event: CascadeEvent,
  board: BoardState,
): void {
  events.push(event);
  steps.push({ event, board: cloneBoard(board) });
}

function clearMatchedKeepingSpecials(
  board: BoardState,
  matched: GridPos[],
  keep: Set<string>,
): BoardState {
  const toClear = matched.filter((p) => !keep.has(posKey(p)));
  return clearPositions(board, toClear);
}

function runCascadeLoop(
  startBoard: BoardState,
  rng: SeededRandom,
  events: CascadeEvent[],
  steps: CascadeStep[],
  startCombo: number,
): { board: BoardState; scoreDelta: number; comboReached: number } {
  let board = startBoard;
  let scoreDelta = 0;
  let combo = startCombo;
  let comboReached = startCombo;

  for (let step = 0; step < MAX_CASCADE_STEPS; step++) {
    const groups = findMatches(board);
    if (groups.length === 0) break;

    combo = comboLevelFromCascade(combo + 1);
    comboReached = Math.max(comboReached, combo);
    const cleared = allMatchedPositions(groups);
    const gain = scoreMatchGroups(groups, combo);
    scoreDelta += gain;
    pushStep(
      events,
      steps,
      { kind: 'match', groups, cleared, scoreGain: gain },
      board,
    );

    const placed = placeSpecialsFromMatches(board, groups);
    const keep = new Set(placed.created.map((c) => posKey(c.at)));
    board = clearMatchedKeepingSpecials(placed.board, cleared, keep);
    for (const c of placed.created) {
      pushStep(
        events,
        steps,
        {
          kind: 'special_created',
          at: c.at,
          special: c.special,
          type: c.type,
        },
        board,
      );
    }

    board = applyGravity(board);
    pushStep(events, steps, { kind: 'drop' }, board);
    board = fillEmptyCells(board, rng);
    pushStep(events, steps, { kind: 'fill' }, board);
  }

  if (!hasValidMove(board)) {
    board = shuffleBoard(board, rng);
    pushStep(events, steps, { kind: 'shuffle' }, board);
  }

  return { board, scoreDelta, comboReached };
}

function invalid(
  board: BoardState,
  from: GridPos,
  to: GridPos,
): CascadeResult {
  const event: CascadeEvent = { kind: 'invalid_swap', from, to };
  return {
    board,
    scoreDelta: 0,
    comboReached: board.combo,
    events: [event],
    steps: [{ event, board: cloneBoard(board) }],
    valid: false,
  };
}

export function applyMove(
  board: BoardState,
  from: GridPos,
  to: GridPos,
  rng: SeededRandom,
): CascadeResult {
  const events: CascadeEvent[] = [];
  const steps: CascadeStep[] = [];

  if (!areAdjacent(from, to)) {
    return invalid(board, from, to);
  }

  const cellFrom = getCell(board, from);
  const cellTo = getCell(board, to);
  if (!cellFrom || !cellTo || cellFrom.empty || cellTo.empty) {
    return invalid(board, from, to);
  }

  const specialSwap = shouldActivateOnSwap(cellFrom, cellTo);
  if (!specialSwap && !isValidSwap(board, from, to)) {
    return invalid(board, from, to);
  }

  let next = swapCells(board, from, to);
  pushStep(events, steps, { kind: 'swap', from, to }, next);

  let scoreDelta = 0;
  let combo = 0;
  let comboReached = board.highestCombo;

  if (specialSwap) {
    const cleared = getSwapSpecialClears(next, from, to) ?? [];
    const specials: SpecialType[] = [];
    const a = getCell(next, from);
    const b = getCell(next, to);
    if (a && a.special !== 'none') specials.push(a.special);
    if (b && b.special !== 'none') specials.push(b.special);

    combo = 1;
    comboReached = Math.max(comboReached, combo);
    const gain = scoreClearedSpecials(specials, combo);
    scoreDelta += gain;
    pushStep(
      events,
      steps,
      {
        kind: 'special_activated',
        at: to,
        special: b?.special ?? a?.special ?? 'none',
        cleared,
        scoreGain: gain,
      },
      next,
    );
    next = clearPositions(next, cleared);
    next = applyGravity(next);
    pushStep(events, steps, { kind: 'drop' }, next);
    next = fillEmptyCells(next, rng);
    pushStep(events, steps, { kind: 'fill' }, next);
  }

  const cascade = runCascadeLoop(next, rng, events, steps, combo);
  next = cascade.board;
  scoreDelta += cascade.scoreDelta;
  comboReached = Math.max(comboReached, cascade.comboReached);

  const finalBoard: BoardState = {
    ...cloneBoard(next),
    moveCount: board.moveCount + 1,
    score: board.score + scoreDelta,
    combo: cascade.comboReached,
    highestCombo: Math.max(board.highestCombo, comboReached),
  };

  // Son adımın skor/combo alanlarını final ile hizala
  if (steps.length > 0) {
    steps[steps.length - 1] = {
      ...steps[steps.length - 1],
      board: cloneBoard(finalBoard),
    };
  }

  return {
    board: finalBoard,
    scoreDelta,
    comboReached,
    events,
    steps,
    valid: true,
  };
}
