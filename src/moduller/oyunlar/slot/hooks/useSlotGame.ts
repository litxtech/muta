/**
 * NOX REELS — ana oyun hook'u (spin / recover / state).
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  createInitialSlotState,
  reduceSlotState,
} from '../motor/OyunDurumMakinesi';
import {
  markSlotRoundPlayed,
  newSlotIdempotencyKey,
  requestSlotSpin,
  restoreUnfinishedSlotRound,
  warmupSlotSpin,
} from '../servisler/SlotApiServisi';
import { slotBakiyesiniGetir } from '../servisler/SlotOturumServisi';
import { validateServerResult } from '../motor/SonucDogrulayici';
import { trackSlotEvent } from '../servisler/SlotTelemetri';
import { DEFAULT_MATH_CONFIG } from '../sabitler/SlotAyarlari';
import type { SlotGrid, SlotPaylineWin, SlotSpinResult } from '../tipler/SlotTipleri';
import { playSlotSfx } from '../ses/SlotSesYoneticisi';

const IDLE_GRID: SlotGrid = [
  ['A', 'GEM', 'J'],
  ['K', 'WILD', 'Q'],
  ['DIAMOND', 'CROWN', 'RING'],
  ['WATCH', 'A', 'ROYAL_CROWN'],
  ['Q', 'SCATTER', 'K'],
];

export function useSlotGame(opts: {
  userId?: string | null;
  roomId?: string | null;
  adminTest?: boolean;
}) {
  const [machine, dispatch] = useReducer(
    reduceSlotState,
    undefined,
    createInitialSlotState,
  );
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(DEFAULT_MATH_CONFIG.betPresets[1] ?? 20);
  const [grid, setGrid] = useState<SlotGrid>(IDLE_GRID);
  const [displayWin, setDisplayWin] = useState(0);
  const [activeWins, setActiveWins] = useState<SlotPaylineWin[]>([]);
  const [activeLine, setActiveLine] = useState(-1);
  const [autoLeft, setAutoLeft] = useState(0);
  const [spinToken, setSpinToken] = useState(0);
  const pendingKey = useRef<string | null>(null);
  const machineRef = useRef(machine);
  machineRef.current = machine;

  const refreshBalance = useCallback(async () => {
    if (!opts.userId) return;
    const c = await slotBakiyesiniGetir(opts.userId);
    setBalance(c);
  }, [opts.userId]);

  useEffect(() => {
    trackSlotEvent('slot_opened');
    void warmupSlotSpin();
    void refreshBalance();
    void (async () => {
      const unfinished = await restoreUnfinishedSlotRound();
      if (unfinished?.result) {
        dispatch({ type: 'RECOVER', result: unfinished.result });
        setGrid(unfinished.result.grid);
        setBalance(unfinished.result.balanceAfter);
      }
    })();
    return () => {
      trackSlotEvent('slot_closed');
    };
  }, [refreshBalance]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshBalance();
    });
    return () => sub.remove();
  }, [refreshBalance]);

  const presentWins = useCallback(async (result: SlotSpinResult) => {
    if (result.winAmount <= 0) {
      setActiveWins([]);
      setDisplayWin(0);
      dispatch({ type: 'WIN_DONE' });
      return;
    }

    setActiveWins(result.lineWins);
    setDisplayWin(result.winAmount);
    if (result.wildPositions.length > 0) playSlotSfx('wild_hit');
    if (result.scatterCount > 0) playSlotSfx('scatter_hit');
    playSlotSfx(result.winAmount >= result.betAmount * 5 ? 'medium_win' : 'small_win');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    for (let i = 0; i < result.lineWins.length; i++) {
      setActiveLine(result.lineWins[i]!.lineIndex);
      setActiveWins([result.lineWins[i]!]);
      await sleep(420);
    }
    setActiveWins(result.lineWins);
    setActiveLine(-1);
    await sleep(280);
    dispatch({ type: 'WIN_DONE' });
  }, []);

  const onAllReelsStopped = useCallback(() => {
    dispatch({ type: 'REELS_STOPPED' });
    const result = machineRef.current.result;
    // STOPPING → EVALUATING sonrası win
    setTimeout(() => {
      const r = machineRef.current.result ?? result;
      if (!r) {
        dispatch({ type: 'WIN_DONE' });
        return;
      }
      setGrid(r.grid);
      setBalance(r.balanceAfter);
      if (r.roundId) void markSlotRoundPlayed(r.roundId);
      trackSlotEvent('slot_spin_completed', {
        win: r.winAmount,
        tier: r.winTier,
      });
      void presentWins(r);
    }, 40);
  }, [presentWins]);

  const spin = useCallback(async () => {
    if (!machineRef.current.canSpin) return;
    if (balance < bet && !opts.adminTest) {
      trackSlotEvent('slot_error', { code: 'insufficient' });
      return;
    }

    dispatch({ type: 'SPIN_PRESS' });
    playSlotSfx('button_press');
    playSlotSfx('spin_start');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trackSlotEvent('slot_spin_requested', { bet });

    const key = newSlotIdempotencyKey();
    pendingKey.current = key;

    const res = await requestSlotSpin({
      betAmount: bet,
      idempotencyKey: key,
      roomId: opts.roomId,
      adminTest: opts.adminTest,
    });

    if (!res.ok) {
      dispatch({
        type: 'REQUEST_FAIL',
        error: res.hata,
        retryable: res.retryable,
      });
      trackSlotEvent('slot_error', { code: res.code ?? 'fail' });
      if (res.retryable) {
        const again = await requestSlotSpin({
          betAmount: bet,
          idempotencyKey: key,
          roomId: opts.roomId,
          adminTest: opts.adminTest,
        });
        if (again.ok) {
          const v = validateServerResult(again.data);
          if (!v.ok && __DEV__) {
            console.warn('[nox] win mismatch', v.reasons);
          }
          setGrid(again.data.grid);
          setBalance(again.data.balanceBefore);
          setSpinToken((t) => t + 1);
          dispatch({ type: 'REQUEST_OK', result: again.data });
          return;
        }
        dispatch({ type: 'RESET' });
        void refreshBalance();
      } else {
        dispatch({ type: 'RESET' });
        void refreshBalance();
      }
      return;
    }

    const v = validateServerResult(res.data);
    if (!v.ok && __DEV__) console.warn('[nox] validate', v.reasons);
    setGrid(res.data.grid);
    setBalance(res.data.balanceBefore);
    setDisplayWin(0);
    setActiveWins([]);
    setSpinToken((t) => t + 1);
    dispatch({ type: 'REQUEST_OK', result: res.data });
  }, [balance, bet, opts.adminTest, opts.roomId, refreshBalance]);

  const onBigWinDone = useCallback(() => {
    dispatch({ type: 'BIG_WIN_DONE' });
  }, []);

  const onBonusIntroDone = useCallback(() => {
    trackSlotEvent('slot_bonus_started');
    dispatch({ type: 'BONUS_INTRO_DONE' });
  }, []);

  return {
    machine,
    balance,
    bet,
    setBet,
    grid,
    displayWin,
    activeWins,
    activeLine,
    autoLeft,
    setAutoLeft,
    spinToken,
    spin,
    onAllReelsStopped,
    onBigWinDone,
    onBonusIntroDone,
    refreshBalance,
    presets: DEFAULT_MATH_CONFIG.betPresets,
  };
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
