/**
 * Kozmik Kaskad ana ekranı — SERVER sonuç, CLIENT playback.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../../contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../admin/yetki/AdminYetkisiVarMi';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { BigWinAnimation } from '../animasyonlar/BigWinAnimation';
import { BonusIntroAnimation } from '../animasyonlar/BonusIntroAnimation';
import { GameHaptics, loadKaskadHapticsEnabled } from '../haptikler/GameHaptics';
import { createPlaybackController } from '../motor/PlaybackEngine';
import {
  DEFAULT_MATH_CONFIG,
  FAST_SPEED_FACTOR,
  SYMBOL_LABELS,
} from '../sabitler/KaskadSabitleri';
import {
  fetchKaskadConfig,
  markKaskadRoundPlayed,
  newKaskadIdempotencyKey,
  requestKaskadSpin,
  restoreUnfinishedKaskadRound,
} from '../servisler/GameApi';
import {
  getKaskadAudioSettings,
  loadKaskadAudioSettings,
  playKaskadSfx,
  saveKaskadAudioSettings,
  setKaskadVoiceDuck,
  startKaskadMusic,
  stopKaskadMusic,
} from '../ses/GameAudioManager';
import type {
  BonusAward,
  GridMatrix,
  KaskadMathConfig,
  KaskadPhase,
  PerformanceProfile,
  SpinResult,
  WinTier,
} from '../tipler/KaskadTipleri';
import { GameBoard } from '../ui/GameBoard';
import { GameFooter } from '../ui/GameFooter';
import { GameHeader } from '../ui/GameHeader';
import { createEmptyGrid } from '../grid/GridGenerator';
import { clampBet } from '../paytable/PaytableEngine';

export type KozmikKaskadEkraniProps = {
  roomId?: string | null;
  onClose: () => void;
  voiceActive?: boolean;
};

export function KozmikKaskadEkrani({
  roomId,
  onClose,
  voiceActive = true,
}: KozmikKaskadEkraniProps) {
  const insets = useSafeAreaInsets();
  const { wallet, profile, patchWallet, refreshWallet } = useAuth();
  const isAdmin = AdminYetkisiVarMi(profile);
  const [config, setConfig] = useState<KaskadMathConfig>(DEFAULT_MATH_CONFIG);
  const [bet, setBet] = useState(DEFAULT_MATH_CONFIG.betPresets[1] ?? 20);
  const [grid, setGrid] = useState<GridMatrix>(() =>
    createEmptyGrid(DEFAULT_MATH_CONFIG.columns, DEFAULT_MATH_CONFIG.rows),
  );
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [destroyingIds, setDestroyingIds] = useState<Set<string>>(new Set());
  const [dropping, setDropping] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<KaskadPhase>('IDLE');
  const [spinning, setSpinning] = useState(false);
  const [winDisplay, setWinDisplay] = useState(0);
  const [multTotal, setMultTotal] = useState(1);
  const [fastMode, setFastMode] = useState(false);
  const [autoplayLeft, setAutoplayLeft] = useState(0);
  const [bonusSpins, setBonusSpins] = useState(0);
  const [bonusMode, setBonusMode] = useState(false);
  const [bonusIntro, setBonusIntro] = useState<BonusAward | null>(null);
  const [showBonusIntro, setShowBonusIntro] = useState(false);
  const [bigWin, setBigWin] = useState<{ tier: WinTier; amount: number } | null>(
    null,
  );
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [performance] = useState<PerformanceProfile>('HIGH');
  const [ready, setReady] = useState(false);
  const [loadPct, setLoadPct] = useState(0);
  const playbackRef = useRef<ReturnType<typeof createPlaybackController> | null>(
    null,
  );
  const autoplayStop = useRef(false);
  const balance = wallet?.coins ?? 0;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadPct(25);
      await loadKaskadAudioSettings();
      await loadKaskadHapticsEnabled();
      setLoadPct(50);
      const cfg = await fetchKaskadConfig();
      if (!alive) return;
      setConfig(cfg);
      setBet(clampBet(cfg, cfg.betPresets[1] ?? cfg.minBet));
      setGrid(createEmptyGrid(cfg.columns, cfg.rows));
      setLoadPct(75);
      const unfinished = await restoreUnfinishedKaskadRound();
      setLoadPct(100);
      setReady(true);
      const audio = getKaskadAudioSettings();
      setMusicOn(audio.music);
      setSfxOn(audio.sfx);
      setKaskadVoiceDuck(voiceActive);
      void startKaskadMusic(false);
      void playKaskadSfx('game_open');
      if (unfinished?.status === 'pending_playback') {
        void playResult(unfinished.result);
      }
    })();
    return () => {
      alive = false;
      playbackRef.current?.cancel();
      stopKaskadMusic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setKaskadVoiceDuck(voiceActive);
  }, [voiceActive]);

  const speedFactor = fastMode ? FAST_SPEED_FACTOR : 1;

  const playResult = useCallback(
    async (result: SpinResult) => {
      setSpinning(true);
      setWinDisplay(0);
      setMultTotal(1);
      setMatchedIds(new Set());
      setDestroyingIds(new Set());
      setDropping({});
      setGrid(result.initialGrid);

      const controller = createPlaybackController({
        speedFactor,
        onPhase: (p, meta) => {
          setPhase(p);
          if (p === 'SYMBOLS_DROP' && meta?.grid) {
            setGrid(meta.grid as GridMatrix);
            void playKaskadSfx('symbol_drop');
          }
          if (p === 'MATCH_CHECK' && meta?.matched) {
            const ids = new Set(
              (meta.matched as { cellIds: string[] }[]).flatMap((m) => m.cellIds),
            );
            setMatchedIds(ids);
            void playKaskadSfx('symbol_match');
            void GameHaptics.match();
          }
          if (p === 'DESTROY' && meta?.removedIds) {
            setDestroyingIds(new Set(meta.removedIds as string[]));
            void playKaskadSfx('symbol_destroy');
          }
          if (p === 'MULTIPLIER' && meta?.multipliers) {
            const vals = meta.multipliers as number[];
            setMultTotal((prev) => {
              const next = vals.reduce((a, b) => a + b, prev === 1 && vals.length ? 0 : prev);
              return Math.max(1, next);
            });
            void playKaskadSfx('multiplier_collect');
            void GameHaptics.multiplier();
          }
          if (p === 'CASCADE' && meta?.gridAfter) {
            setMatchedIds(new Set());
            setDestroyingIds(new Set());
            const news = (meta.newSymbols as { instanceId: string }[] | undefined) ?? [];
            const dropMap: Record<string, number> = {};
            for (const n of news) dropMap[n.instanceId] = 3;
            setDropping(dropMap);
            setGrid(meta.gridAfter as GridMatrix);
            void playKaskadSfx('cascade');
          }
          if (p === 'BONUS_INTRO' && meta?.bonus) {
            setBonusIntro(meta.bonus as BonusAward);
            setShowBonusIntro(true);
            void playKaskadSfx('bonus_trigger');
            void GameHaptics.bonus();
          }
          if (p === 'BONUS_MODE') {
            setBonusMode(true);
            setBonusSpins(result.remainingBonusSpins);
            void startKaskadMusic(true);
          }
          if (p === 'BIG_WIN') {
            setBigWin({
              tier: meta?.tier as WinTier,
              amount: Number(meta?.totalWin ?? result.totalWin),
            });
            void playKaskadSfx(
              result.winTier === 'SUPERNOVA' || result.winTier === 'GALACTIC'
                ? 'epic_win'
                : 'big_win',
            );
            void GameHaptics.bigWin();
          }
          if (p === 'FINALIZE') {
            setWinDisplay(result.totalWin);
            patchWallet({ coins: result.balanceAfter });
            void refreshWallet();
            void markKaskadRoundPlayed(result.roundId);
          }
          if (p === 'IDLE') {
            setSpinning(false);
            setMatchedIds(new Set());
            setDestroyingIds(new Set());
            setDropping({});
          }
        },
      });
      playbackRef.current = controller;
      await controller.play(result);
      setSpinning(false);
    },
    [patchWallet, refreshWallet, speedFactor],
  );

  const doSpin = useCallback(async () => {
    if (spinning || phase === 'REQUESTING_RESULT') return;
    if (!isAdmin && bonusSpins <= 0 && balance < bet) {
      Alert.alert('Bakiye', 'Yetersiz coin.');
      setAutoplayLeft(0);
      return;
    }

    setPhase('REQUESTING_RESULT');
    setSpinning(true);
    void playKaskadSfx('spin_start');
    void GameHaptics.spin();

    const res = await requestKaskadSpin({
      betAmount: bet,
      idempotencyKey: newKaskadIdempotencyKey(),
      roomId: roomId ?? null,
    });

    if (!res.ok) {
      setSpinning(false);
      setPhase('IDLE');
      Alert.alert('Spin', res.hata);
      if (autoplayLeft > 0) setAutoplayLeft(0);
      return;
    }

    if (bonusSpins > 0) setBonusSpins((s) => Math.max(0, s - 1));
    await playResult(res.data);

    if (res.data.bonusTriggered && res.data.bonus) {
      setBonusSpins(res.data.remainingBonusSpins);
      if (autoplayLeft > 0) {
        autoplayStop.current = true;
        setAutoplayLeft(0);
      }
    }

    if (
      res.data.winTier === 'GALACTIC' ||
      res.data.winTier === 'SUPERNOVA'
    ) {
      setAutoplayLeft(0);
    }
  }, [
    autoplayLeft,
    balance,
    bet,
    bonusSpins,
    isAdmin,
    phase,
    playResult,
    roomId,
    spinning,
  ]);

  useEffect(() => {
    if (autoplayLeft <= 0 || spinning || !ready) return;
    if (autoplayStop.current) {
      autoplayStop.current = false;
      return;
    }
    const t = setTimeout(() => {
      setAutoplayLeft((n) => Math.max(0, n - 1));
      void doSpin();
    }, 500);
    return () => clearTimeout(t);
  }, [autoplayLeft, doSpin, ready, spinning]);

  const canSpin = useMemo(
    () =>
      ready &&
      !spinning &&
      (isAdmin || bonusSpins > 0 || balance >= bet),
    [balance, bet, bonusSpins, isAdmin, ready, spinning],
  );

  const betPresets = config.betPresets;

  if (!ready) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.loading}>Kozmik Kaskad yükleniyor… {loadPct}%</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={
          bonusMode
            ? ['#2A1040', '#120818', '#08040F']
            : [...RenkTokenlari.gradientNight]
        }
        style={StyleSheet.absoluteFill}
      />

      <GameHeader
        balance={balance}
        avatarUrl={profile?.avatar_url}
        musicOn={musicOn}
        sfxOn={sfxOn}
        multiplierTotal={multTotal}
        bonusLabel={
          bonusMode || bonusSpins > 0
            ? `BONUS ${bonusSpins}`
            : null
        }
        onClose={onClose}
        onInfo={() => setPaytableOpen(true)}
        onToggleMusic={() => {
          const next = !musicOn;
          setMusicOn(next);
          void saveKaskadAudioSettings({ music: next });
          if (next) void startKaskadMusic(bonusMode);
          else stopKaskadMusic();
        }}
        onToggleSfx={() => {
          const next = !sfxOn;
          setSfxOn(next);
          void saveKaskadAudioSettings({ sfx: next });
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <GameBoard
          grid={grid}
          matchedIds={matchedIds}
          destroyingIds={destroyingIds}
          dropping={dropping}
          performance={performance}
          bonusMode={bonusMode}
          speedFactor={speedFactor}
        />
      </ScrollView>

      <GameFooter
        bet={bet}
        winDisplay={winDisplay}
        spinning={spinning}
        canSpin={canSpin}
        fastMode={fastMode}
        autoplayLeft={autoplayLeft}
        onBetDown={() => {
          const idx = betPresets.indexOf(bet);
          const next = betPresets[Math.max(0, (idx < 0 ? 0 : idx) - 1)] ?? config.minBet;
          setBet(clampBet(config, next));
          void playKaskadSfx('bet_change');
        }}
        onBetUp={() => {
          const idx = betPresets.indexOf(bet);
          const next =
            betPresets[Math.min(betPresets.length - 1, (idx < 0 ? 0 : idx) + 1)] ??
            config.maxBet;
          setBet(clampBet(config, next));
          void playKaskadSfx('bet_change');
        }}
        onSpin={() => void doSpin()}
        onToggleFast={() => setFastMode((v) => !v)}
        onAutoplay={(n) => {
          autoplayStop.current = false;
          setAutoplayLeft(n);
        }}
        onStopAutoplay={() => setAutoplayLeft(0)}
        onPaytable={() => setPaytableOpen(true)}
      />

      <BonusIntroAnimation
        visible={showBonusIntro}
        bonus={bonusIntro}
        onDone={() => setShowBonusIntro(false)}
      />
      <BigWinAnimation
        visible={bigWin != null}
        tier={bigWin?.tier ?? 'NONE'}
        amount={bigWin?.amount ?? 0}
        onDone={() => setBigWin(null)}
      />

      <Modal visible={paytableOpen} transparent animationType="slide">
        <View style={styles.payBackdrop}>
          <View style={styles.paySheet}>
            <Text style={styles.payTitle}>Ödeme Tablosu</Text>
            <Text style={styles.payHint}>
              Aynı sembolden 8 / 10 / 12+ → ödeme (anywhere-pay)
            </Text>
            {Object.entries(config.paytable).map(([sym, band]) =>
              band ? (
                <Text key={sym} style={styles.payRow}>
                  {SYMBOL_LABELS[sym as keyof typeof SYMBOL_LABELS] ?? sym}: 8→
                  {band[8]}x · 10→{band[10]}x · 12→{band[12]}x
                </Text>
              ) : null,
            )}
            <Pressable style={styles.payClose} onPress={() => setPaytableOpen(false)}>
              <Text style={styles.payCloseText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: RenkTokenlari.bg },
  loading: {
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: 80,
    fontSize: TipografiTokenlari.body.fontSize,
  },
  scroll: {
    paddingVertical: BoslukTokenlari.md,
    alignItems: 'center',
  },
  payBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  paySheet: {
    backgroundColor: RenkTokenlari.bgElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    maxHeight: '70%',
  },
  payTitle: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h1.fontSize,
    fontWeight: '800',
  },
  payHint: {
    color: RenkTokenlari.textMuted,
    marginVertical: 8,
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  payRow: {
    color: RenkTokenlari.text,
    marginBottom: 6,
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  payClose: {
    marginTop: 16,
    alignSelf: 'center',
    padding: 12,
  },
  payCloseText: { color: RenkTokenlari.primarySoft, fontWeight: '700' },
});
