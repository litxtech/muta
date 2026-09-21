/**
 * NOX REELS — ana oyun ekranı (gerçek grafik + ses + koyu atmosfer).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ModulHataSiniri } from '../../../../ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../../../contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../admin/yetki/AdminYetkisiVarMi';
import { GAME_DISPLAY_NAME, GAME_SUBTITLE } from '../sabitler/SlotAyarlari';
import { registerNoxReels } from '../SlotKayit';
import { useSlotGame } from '../hooks/useSlotGame';
import { useSlotAudio } from '../hooks/useSlotAudio';
import { useSlotRealtimeTicker } from '../hooks/useSlotRealtime';
import { MakaraAlani } from '../bilesenler/MakaraAlani';
import { SpinButonu } from '../bilesenler/SpinButonu';
import { BahisKontrolu } from '../bilesenler/BahisKontrolu';
import {
  BakiyeGostergesi,
  KazancGostergesi,
} from '../bilesenler/BakiyeGostergesi';
import { BuyukKazancKatmani } from '../bilesenler/BuyukKazancKatmani';
import {
  KazancCizgisi,
  OtomatikOyunPaneli,
  OyunBilgiPaneli,
  OyunYukleniyor,
  SesKontrolu,
  SonKazananlarSeridi,
} from '../bilesenler/SlotKabini';
import { SlotDebugPanel } from '../bilesenler/SlotDebugPanel';
import { NoxArkaPlan } from '../arkaplan/NoxArkaPlan';
import { preloadNoxAssets } from '../assets/preloadNoxAssets';
import {
  beginSlotAudioSession,
  playSlotSfx,
  preloadSlotAudio,
  setSlotVoiceDuck,
  stopAllSlotAudio,
} from '../ses/SlotSesYoneticisi';
import type { SlotQualityMode } from '../tipler/SlotTipleri';

export type SlotOyunEkraniProps = {
  roomId?: string | null;
  voiceActive?: boolean;
  onClose?: () => void;
  embedded?: boolean;
  adminTest?: boolean;
};

function SlotOyunEkraniInner({
  roomId,
  voiceActive = false,
  onClose,
  embedded,
  adminTest: adminTestProp,
}: SlotOyunEkraniProps) {
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [quality] = useState<SlotQualityMode>('HIGH');
  const isAdmin = AdminYetkisiVarMi(profile);
  const adminTest = adminTestProp === true || (isAdmin && !roomId);

  const game = useSlotGame({
    userId: user?.id,
    roomId,
    adminTest,
  });
  const audio = useSlotAudio();
  const ticker = useSlotRealtimeTicker(6);

  useEffect(() => {
    registerNoxReels();
    let alive = true;
    const failSafe = setTimeout(() => {
      if (alive) setReady(true);
    }, 3200);
    void (async () => {
      try {
        await Promise.all([preloadNoxAssets(), preloadSlotAudio()]);
      } catch {
        /* preload hatası oyunu kilitlemesin */
      }
      if (!alive) return;
      beginSlotAudioSession();
      setReady(true);
    })();
    return () => {
      alive = false;
      clearTimeout(failSafe);
      stopAllSlotAudio();
    };
  }, []);

  useEffect(() => {
    setSlotVoiceDuck(!!voiceActive);
  }, [voiceActive]);

  // Big win sesi
  useEffect(() => {
    if (game.machine.phase === 'BIG_WIN') {
      playSlotSfx('big_win_intro');
      playSlotSfx('coin_count');
    }
  }, [game.machine.phase]);

  useEffect(() => {
    if (game.machine.phase === 'BONUS_INTRO') {
      playSlotSfx('bonus_trigger');
    }
  }, [game.machine.phase]);

  const cabinMax = Math.min(width - (embedded ? 12 : 8), 440);
  const symbolSize = Math.max(
    52,
    Math.min(78, Math.floor((cabinMax - 56) / 5)),
  );

  const onDebug = useCallback((_kind: string) => {
    if (!__DEV__) return;
  }, []);

  const onSpin = useCallback(() => {
    playSlotSfx('button_press');
    void game.spin();
  }, [game]);

  const padTop = embedded ? 6 : Math.max(insets.top, 10);
  const padBottom = embedded ? 10 : Math.max(insets.bottom, 14);

  const spinning =
    game.machine.phase === 'REQUESTING' ||
    game.machine.phase === 'SPINNING' ||
    game.machine.phase === 'STOPPING' ||
    game.machine.phase === 'RECOVERING';
  const landing =
    game.machine.phase === 'SPINNING' || game.machine.phase === 'STOPPING';
  const bonus =
    game.machine.phase === 'BONUS_INTRO' ||
    (game.machine.result?.remainingBonusSpins ?? 0) > 0;

  const showBigWin =
    game.machine.phase === 'BIG_WIN' &&
    game.machine.result &&
    game.machine.result.winTier !== 'NONE' &&
    game.machine.result.winTier !== 'NORMAL_WIN';

  const betLocked = !game.machine.canSpin;

  if (!ready) {
    return (
      <View style={[styles.rootFill, { minHeight: height * 0.55 }]}>
        <NoxArkaPlan quality={quality} />
        <OyunYukleniyor />
        {onClose ? (
          <Pressable
            style={[styles.loadingClose, { top: padTop }]}
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Kapat"
          >
            <Ionicons name="close" size={24} color="#F7F2E8" />
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.rootFill,
        {
          paddingTop: padTop,
          paddingBottom: padBottom,
          maxWidth: cabinMax + 24,
          alignSelf: 'center',
          width: '100%',
        },
      ]}
    >
      <NoxArkaPlan quality={quality} bonus={bonus} />

      <LinearGradient
        colors={[
          'rgba(18,10,36,0.72)',
          'rgba(8,10,22,0.88)',
          'rgba(12,8,28,0.92)',
        ]}
        style={[styles.cabin, { maxWidth: cabinMax }]}
      >
        {/* Altın çerçeve çizgisi */}
        <View style={styles.goldRim} pointerEvents="none" />

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{GAME_SUBTITLE}</Text>
            <Text style={styles.title}>{GAME_DISPLAY_NAME}</Text>
          </View>
          <View style={styles.headerRight}>
            <SesKontrolu
              effects={audio.settings.effects}
              music={audio.settings.music}
              onToggleEffects={audio.toggleEffects}
              onToggleMusic={audio.toggleMusic}
            />
            <Pressable onPress={() => setInfoOpen(true)} hitSlop={8}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#C8B8E8"
              />
            </Pressable>
            {onClose ? (
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color="#F7F2E8" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <SonKazananlarSeridi items={ticker} />

        <View style={styles.boardWrap}>
          <MakaraAlani
            grid={game.grid}
            spinning={spinning}
            landing={landing}
            spinToken={game.spinToken}
            symbolSize={symbolSize}
            quality={quality}
            activeWins={game.activeWins}
            onAllStopped={game.onAllReelsStopped}
          />
          {game.activeLine >= 0 ? (
            <KazancCizgisi lineIndex={game.activeLine} />
          ) : null}
        </View>

        {game.machine.phase === 'RECOVERING' ||
        game.machine.phase === 'ERROR' ? (
          <Text style={styles.status}>
            {game.machine.error ?? 'Sonuç kontrol ediliyor…'}
          </Text>
        ) : null}

        {game.machine.phase === 'BONUS_INTRO' ? (
          <Pressable
            style={styles.bonusBanner}
            onPress={game.onBonusIntroDone}
          >
            <Text style={styles.bonusTxt}>BONUS TUR · DOKUN</Text>
          </Pressable>
        ) : null}

        <LinearGradient
          colors={['rgba(255,216,107,0.08)', 'rgba(0,0,0,0.25)']}
          style={styles.hud}
        >
          <View style={styles.stats}>
            <BakiyeGostergesi balance={game.balance} />
            <KazancGostergesi win={game.displayWin} />
          </View>

          <View style={styles.controls}>
            <BahisKontrolu
              bet={game.bet}
              presets={game.presets}
              disabled={betLocked}
              onChange={game.setBet}
            />
            <SpinButonu phase={game.machine.phase} onPress={onSpin} />
          </View>
        </LinearGradient>

        <OtomatikOyunPaneli
          left={game.autoLeft}
          onStop={() => game.setAutoLeft(0)}
        />

        <OyunBilgiPaneli
          visible={infoOpen}
          onClose={() => setInfoOpen(false)}
        />
        <SlotDebugPanel onForce={onDebug} />
      </LinearGradient>

      <BuyukKazancKatmani
        visible={!!showBigWin}
        tier={game.machine.result?.winTier ?? 'NONE'}
        amount={game.machine.result?.winAmount ?? 0}
        onDone={game.onBigWinDone}
      />
    </View>
  );
}

export function SlotOyunEkrani(props: SlotOyunEkraniProps) {
  return (
    <ModulHataSiniri modulAdi="nox_reels" varyant="ekran">
      <SlotOyunEkraniInner {...props} />
    </ModulHataSiniri>
  );
}

const styles = StyleSheet.create({
  rootFill: {
    flex: 1,
    backgroundColor: '#060412',
    overflow: 'hidden',
  },
  loadingClose: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cabin: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 22,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(232,197,71,0.45)',
    overflow: 'hidden',
    alignSelf: 'center',
    width: '100%',
  },
  goldRim: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(183,148,246,0.25)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: {
    color: 'rgba(196,168,255,0.9)',
    fontSize: 10,
    letterSpacing: 2.2,
    fontWeight: '700',
  },
  title: {
    color: '#FFE08A',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(255,200,80,0.45)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  boardWrap: { position: 'relative', marginVertical: 6, alignItems: 'center' },
  hud: {
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,216,107,0.2)',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  status: {
    color: '#FFB4A8',
    textAlign: 'center',
    marginTop: 6,
    fontSize: 12,
  },
  bonusBanner: {
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(232,121,249,0.3)',
    borderWidth: 1.5,
    borderColor: 'rgba(245,208,254,0.65)',
  },
  bonusTxt: {
    color: '#F5D0FE',
    fontWeight: '900',
    letterSpacing: 2,
  },
});
