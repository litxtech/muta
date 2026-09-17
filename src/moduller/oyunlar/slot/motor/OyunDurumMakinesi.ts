/**
 * NOX REELS — oyun durum makinesi.
 * Debounce değil; state ile çift spin engellenir.
 */

import type { SlotPhase, SlotSpinResult } from '../tipler/SlotTipleri';

export type SlotMachineEvent =
  | { type: 'SPIN_PRESS' }
  | { type: 'REQUEST_OK'; result: SlotSpinResult }
  | { type: 'REQUEST_FAIL'; error: string; retryable?: boolean }
  | { type: 'REELS_STOPPED' }
  | { type: 'WIN_DONE' }
  | { type: 'BIG_WIN_DONE' }
  | { type: 'BONUS_INTRO_DONE' }
  | { type: 'RECOVER'; result: SlotSpinResult }
  | { type: 'RESET' };

export type SlotMachineState = {
  phase: SlotPhase;
  result: SlotSpinResult | null;
  error: string | null;
  canSpin: boolean;
};

export function createInitialSlotState(): SlotMachineState {
  return {
    phase: 'IDLE',
    result: null,
    error: null,
    canSpin: true,
  };
}

const BUSY: ReadonlySet<SlotPhase> = new Set([
  'REQUESTING',
  'SPINNING',
  'STOPPING',
  'EVALUATING',
  'WIN_ANIMATION',
  'BIG_WIN',
  'BONUS_INTRO',
  'BONUS_SPINNING',
  'RECOVERING',
]);

export function reduceSlotState(
  state: SlotMachineState,
  event: SlotMachineEvent,
): SlotMachineState {
  switch (event.type) {
    case 'SPIN_PRESS': {
      if (!state.canSpin || BUSY.has(state.phase)) return state;
      return {
        ...state,
        phase: 'REQUESTING',
        error: null,
        canSpin: false,
        result: null,
      };
    }
    case 'REQUEST_OK': {
      if (state.phase !== 'REQUESTING' && state.phase !== 'RECOVERING') {
        return state;
      }
      return {
        ...state,
        phase: 'SPINNING',
        result: event.result,
        error: null,
        canSpin: false,
      };
    }
    case 'REQUEST_FAIL': {
      if (state.phase !== 'REQUESTING') return state;
      return {
        ...state,
        phase: event.retryable ? 'RECOVERING' : 'ERROR',
        error: event.error,
        canSpin: !event.retryable,
      };
    }
    case 'REELS_STOPPED': {
      if (state.phase !== 'SPINNING' && state.phase !== 'STOPPING') return state;
      return { ...state, phase: 'EVALUATING' };
    }
    case 'WIN_DONE': {
      const r = state.result;
      if (!r) {
        return { ...state, phase: 'IDLE', canSpin: true };
      }
      if (
        r.winTier === 'BIG_WIN' ||
        r.winTier === 'MEGA_WIN' ||
        r.winTier === 'EPIC_WIN'
      ) {
        return { ...state, phase: 'BIG_WIN' };
      }
      if (r.bonusTriggered) {
        return { ...state, phase: 'BONUS_INTRO' };
      }
      return { ...state, phase: 'IDLE', canSpin: true };
    }
    case 'BIG_WIN_DONE': {
      if (state.result?.bonusTriggered) {
        return { ...state, phase: 'BONUS_INTRO' };
      }
      return { ...state, phase: 'IDLE', canSpin: true };
    }
    case 'BONUS_INTRO_DONE': {
      return { ...state, phase: 'IDLE', canSpin: true };
    }
    case 'RECOVER': {
      return {
        phase: 'SPINNING',
        result: event.result,
        error: null,
        canSpin: false,
      };
    }
    case 'RESET': {
      return createInitialSlotState();
    }
    default:
      return state;
  }
}

export function beginStopping(state: SlotMachineState): SlotMachineState {
  if (state.phase !== 'SPINNING') return state;
  return { ...state, phase: 'STOPPING' };
}

export function beginWinAnimation(state: SlotMachineState): SlotMachineState {
  if (state.phase !== 'EVALUATING') return state;
  const r = state.result;
  if (!r || r.winAmount <= 0) {
    if (r?.bonusTriggered) {
      return { ...state, phase: 'BONUS_INTRO', canSpin: false };
    }
    return { ...state, phase: 'IDLE', canSpin: true };
  }
  return { ...state, phase: 'WIN_ANIMATION' };
}
