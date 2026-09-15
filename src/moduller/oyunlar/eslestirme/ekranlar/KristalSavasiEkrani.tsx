/**
 * Kristal Savaşı — oda içi oyun ekranı (cascade animasyon + SFX).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type {
  GameSessionPlayer,
  RoomGameMeta,
} from '../../ortak/tipler/OyunTipleri';
import { CanliSkorPaneli } from '../../ortak/bilesenler/CanliSkorPaneli';
import { MiniOdaSeridi } from '../../ortak/bilesenler/MiniOdaSeridi';
import { useCanliSkor } from '../../ortak/hooks/useCanliSkor';
import type { BoardState, GridPos } from '../tipler/KristalTipleri';
import { GAME_DISPLAY_NAME } from '../sabitler/KristalSabitleri';
import { createBoard } from '../motor/TahtaOlusturucu';
import { createSeededRandom } from '../motor/SeedMotoru';
import { applyMove } from '../motor/HamleMotoru';
import { boardHash } from '../motor/TahtaHash';
import { validateMoveBounds } from '../guvenlik/HamleDogrulama';
import { validateScoreSanity } from '../guvenlik/SkorDogrulama';
import { loadMatch3SesAyarlari } from '../ses/Match3SesAyarlari';
import { playMatch3Sfx } from '../ses/Match3Sesleri';
import {
  BOS_FX,
  playCascadeSteps,
  type BoardFx,
} from '../animasyon/CascadeOynatici';
import { OyunTahtasi } from '../bilesenler/OyunTahtasi';
import { SkorGostergesi } from '../bilesenler/SkorGostergesi';
import { SureGostergesi } from '../bilesenler/SureGostergesi';
import { ComboGostergesi } from '../bilesenler/ComboGostergesi';

export type KristalSavasiEkraniProps = {
  sessionId: string;
  seed: number;
  endsAt: string;
  roomMeta: RoomGameMeta;
  players: GameSessionPlayer[];
  durationSeconds?: number;
  inputLocked?: boolean;
  timerArmed?: boolean;
  /** Admin / yerel pratik — skor RPC yok, çıkış uyarısı yumuşak */
  practiceMode?: boolean;
  onExit: () => void;
  onFinished?: (payload: {
    score: number;
    moveCount: number;
    highestCombo: number;
    boardHash: string;
  }) => void;
};

export function KristalSavasiEkrani({
  sessionId,
  seed,
  endsAt,
  roomMeta,
  players,
  durationSeconds = 90,
  inputLocked = false,
  timerArmed = true,
  practiceMode = false,
  onExit,
  onFinished,
}: KristalSavasiEkraniProps) {
  const insets = useSafeAreaInsets();
  const rngRef = useRef(createSeededRandom((seed ^ 0x51eed) >>> 0));
  const [board, setBoard] = useState<BoardState>(() => createBoard(seed));
  const [fx, setFx] = useState<BoardFx>(BOS_FX);
  const [scorePunch, setScorePunch] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(durationSeconds);
  const finishedRef = useRef(false);
  const startedAtRef = useRef(Date.now());
  const boardRef = useRef(board);
  boardRef.current = board;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const playSignalRef = useRef({ cancelled: false });

  const canli = useCanliSkor({
    sessionId: practiceMode ? undefined : sessionId,
    enabled: !practiceMode && timerArmed && !inputLocked,
  });
  const flushNow = canli.flushNow;

  useEffect(() => {
    playSignalRef.current.cancelled = true;
    playSignalRef.current = { cancelled: false };
    setBoard(createBoard(seed));
    setFx(BOS_FX);
    rngRef.current = createSeededRandom((seed ^ 0x51eed) >>> 0);
    startedAtRef.current = Date.now();
    finishedRef.current = false;
    setRemaining(durationSeconds);
    setLocked(false);
  }, [seed, durationSeconds]);

  useEffect(() => {
    return () => {
      playSignalRef.current.cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!timerArmed) {
      setRemaining(durationSeconds);
      return;
    }
    const tick = () => {
      const end = Date.parse(endsAt);
      const left = Number.isFinite(end)
        ? Math.max(0, Math.ceil((end - Date.now()) / 1000))
        : 0;
      setRemaining(left);
      if (left <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        setLocked(true);
        playSignalRef.current.cancelled = true;
        void playMatch3Sfx('game_end');
        void (async () => {
          await flushNow();
          const b = boardRef.current;
          onFinishedRef.current?.({
            score: b.score,
            moveCount: b.moveCount,
            highestCombo: b.highestCombo,
            boardHash: boardHash(b),
          });
        })();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, flushNow, timerArmed, durationSeconds]);

  const onSwipe = useCallback(
    async (from: GridPos, to: GridPos) => {
      if (locked || inputLocked || finishedRef.current || !timerArmed) return;
      const bounds = validateMoveBounds(board, from, to);
      if (!bounds.ok) {
        void playMatch3Sfx('move_invalid');
        setFx({ ...BOS_FX, shake: true });
        setTimeout(() => setFx(BOS_FX), 280);
        return;
      }

      setLocked(true);
      const result = applyMove(board, from, to, rngRef.current);
      if (!result.valid) {
        await playCascadeSteps({
          steps: result.steps,
          comboReached: 0,
          onBoard: setBoard,
          onFx: setFx,
          signal: playSignalRef.current,
        });
        setLocked(false);
        return;
      }

      const signal = playSignalRef.current;
      await playCascadeSteps({
        steps: result.steps,
        comboReached: result.comboReached,
        onBoard: setBoard,
        onFx: setFx,
        signal,
      });

      if (signal.cancelled) {
        setBoard(result.board);
        setFx(BOS_FX);
      } else {
        setBoard(result.board);
        setScorePunch(result.scoreDelta);
        setTimeout(() => setScorePunch(null), 500);
      }

      canli.updateScore({
        score: result.board.score,
        moveCount: result.board.moveCount,
        highestCombo: result.board.highestCombo,
        boardHash: boardHash(result.board),
      });

      const ayar = await loadMatch3SesAyarlari();
      if (ayar.haptic) {
        if (result.comboReached >= 5) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (result.comboReached >= 2) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }

      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      validateScoreSanity({
        score: result.board.score,
        elapsedSeconds: elapsed,
        moveCount: result.board.moveCount,
        highestCombo: result.board.highestCombo,
        durationSeconds,
      });

      setLocked(false);
    },
    [board, canli, durationSeconds, inputLocked, locked, timerArmed],
  );

  const confirmExit = useCallback(() => {
    if (practiceMode) {
      Alert.alert('Testi bitir', 'Denetim oturumu kapanır; skor kaydedilmez.', [
        { text: 'Devam et', style: 'cancel' },
        { text: 'Kapat', style: 'destructive', onPress: onExit },
      ]);
      return;
    }
    Alert.alert(
      'Oyundan ayrıl',
      'Maç devam ediyor. Ayrılırsan tamamlanmamış sayılabilir. Sesli odada kalırsın.',
      [
        { text: 'Devam et', style: 'cancel' },
        { text: 'Oyundan çık', style: 'destructive', onPress: onExit },
      ],
    );
  }, [onExit, practiceMode]);

  const headerPlayers = useMemo(() => players, [players]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      <MiniOdaSeridi meta={roomMeta} />

      <View style={styles.header}>
        <Pressable onPress={confirmExit} hitSlop={12}>
          <Text style={styles.exit}>Kapat</Text>
        </Pressable>
        <Text style={styles.title}>{GAME_DISPLAY_NAME}</Text>
        <SureGostergesi remainingSeconds={remaining} />
      </View>

      <View style={styles.stats}>
        <SkorGostergesi score={board.score} punch={scorePunch} />
        <ComboGostergesi combo={board.combo} />
      </View>

      <CanliSkorPaneli players={headerPlayers} />

      <View style={styles.boardWrap}>
        <OyunTahtasi
          board={board}
          fx={fx}
          locked={locked || inputLocked || !timerArmed}
          onSwipe={onSwipe}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: RenkTokenlari.bg,
    paddingHorizontal: BoslukTokenlari.md,
    gap: BoslukTokenlari.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exit: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    minWidth: 48,
  },
  title: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  stats: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    alignItems: 'center',
  },
  boardWrap: {
    flex: 1,
    justifyContent: 'center',
  },
});
