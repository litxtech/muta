/**
 * Oda oyun katmanı — overlay orchestrator.
 * ASLA MedyaOdasiKes / router leave çağırmaz.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { registerMatch3 } from '../eslestirme/Match3Kayit';
import { registerKozmikKaskad } from '../kaskad/KaskadKayit';
import { GAME_DISPLAY_NAME } from '../eslestirme/sabitler/KristalSabitleri';
import { KristalSavasiEkrani } from '../eslestirme/ekranlar/KristalSavasiEkrani';
import { KozmikKaskadEkrani } from '../kaskad/ekranlar/KozmikKaskadEkrani';
import { OyunBaslatModal } from '../ortak/bilesenler/OyunBaslatModal';
import { OyunDavetiModal } from '../ortak/bilesenler/OyunDavetiModal';
import { OyunLobisi } from '../ortak/bilesenler/OyunLobisi';
import { GeriSayim } from '../ortak/bilesenler/GeriSayim';
import { OyunSonucuModal } from '../ortak/bilesenler/OyunSonucuModal';
import { useOyunOturumu } from '../ortak/hooks/useOyunOturumu';
import {
  aktifOyunOturumuGetir,
  createGameSession,
  finishGameSession,
  joinGameSession,
  startGameSession,
  submitGameScore,
} from '../ortak/servisler/OyunOturumServisi';
import { OyunSessionOyunculariniGetir } from '../ortak/servisler/OyunIstatistikServisi';
import { LOBBY_COUNTDOWN_SECONDS, MIN_PLAYERS } from '../ortak/sabitler/OyunSabitleri';
import type {
  GameSession,
  GameSessionPlayer,
  LeaderboardEntry,
  RoomGameMeta,
} from '../ortak/tipler/OyunTipleri';
import { GameLogger } from '../cekirdek/OyunLogger';
import { playMatch3Sfx } from '../eslestirme/ses/Match3Sesleri';

export type OyunOdaKatmaniProps = {
  roomMeta: RoomGameMeta;
  isHost: boolean;
  hostDisplayName: string;
  selfUserId?: string;
  startModalVisible: boolean;
  onStartModalClose: () => void;
  inviteSession?: GameSession | null;
  onInviteDismiss?: () => void;
  onOverlayClosed?: () => void;
};

type Phase = 'idle' | 'lobby' | 'countdown' | 'playing' | 'result' | 'kaskad';

function mapPlayers(rows: Awaited<ReturnType<typeof OyunSessionOyunculariniGetir>>): GameSessionPlayer[] {
  return rows.map((row) => ({
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    display_name: row.profiles?.display_name ?? null,
    avatar_url: row.profiles?.avatar_url ?? null,
    status: (row.status as GameSessionPlayer['status']) ?? 'joined',
    score: row.game_scores?.score ?? 0,
    combo_max: row.game_scores?.highest_combo ?? 0,
    move_count: row.game_scores?.move_count ?? 0,
    final_rank: row.final_rank,
    joined_at: row.joined_at,
    finished_at: row.finished_at,
    disconnected_at: row.disconnected_at,
  }));
}

export function OyunOdaKatmani({
  roomMeta,
  isHost,
  hostDisplayName,
  selfUserId,
  startModalVisible,
  onStartModalClose,
  inviteSession,
  onInviteDismiss,
  onOverlayClosed,
}: OyunOdaKatmaniProps) {
  useEffect(() => {
    registerMatch3();
    registerKozmikKaskad();
  }, []);

  const [phase, setPhase] = useState<Phase>('idle');
  const [session, setSessionLocal] = useState<GameSession | null>(null);
  const [lobbySeconds, setLobbySeconds] = useState<number | null>(null);
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const startDenendi = useRef(false);

  const oturum = useOyunOturumu(session?.id);

  const yenileOyuncular = useCallback(
    async (sessionId: string) => {
      try {
        const rows = await OyunSessionOyunculariniGetir(sessionId);
        oturum.setPlayers(mapPlayers(rows));
      } catch (e) {
        GameLogger.warn('oyuncu listesi', {
          hata: e instanceof Error ? e.message : 'unknown',
        });
      }
    },
    [oturum],
  );

  useEffect(() => {
    if (inviteSession && !session) {
      setShowInvite(true);
      void playMatch3Sfx('leader_change');
    }
  }, [inviteSession, session]);

  useEffect(() => {
    if (oturum.session) setSessionLocal(oturum.session);
  }, [oturum.session]);

  useEffect(() => {
    if (oturum.status === 'playing' && phase === 'lobby') {
      setPhase('countdown');
    }
    if (oturum.status === 'finished' && (phase === 'playing' || phase === 'countdown')) {
      if (oturum.rankings.length) setRankings(oturum.rankings);
      setPhase('result');
    }
  }, [oturum.status, oturum.rankings, phase]);

  useEffect(() => {
    if (phase !== 'lobby' || lobbySeconds == null) return;
    if (lobbySeconds <= 0) {
      if (!isHost || !session || startDenendi.current) return;
      const hazirSayisi = (oturum.players.length ? oturum.players : []).filter(
        (p) => p.status !== 'left' && p.status !== 'dnf',
      ).length;
      // Liste henüz yüklenmediyse (0) sunucu doğrulasın; yüklüyse min kontrol et
      if (oturum.players.length > 0 && hazirSayisi < MIN_PLAYERS) {
        setLobbySeconds(LOBBY_COUNTDOWN_SECONDS);
        return;
      }
      startDenendi.current = true;
      void (async () => {
        const res = await startGameSession(session.id);
        if (res.ok) {
          setSessionLocal(res.data);
          oturum.setSession(res.data);
          setPhase('countdown');
        } else {
          startDenendi.current = false;
          setLobbySeconds(LOBBY_COUNTDOWN_SECONDS);
          Alert.alert('Oyun', res.hata);
          GameLogger.error('start_game_session', { hata: res.hata });
        }
      })();
      return;
    }
    const t = setTimeout(() => setLobbySeconds((s) => (s == null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [phase, lobbySeconds, isHost, session, oturum.players, oturum.setSession]);

  const handleCreate = useCallback(
    async (opts: { durationSeconds: number; maxPlayers: number }) => {
      const res = await createGameSession({
        roomId: roomMeta.roomId,
        gameCode: 'match3',
        durationSeconds: opts.durationSeconds,
        maxPlayers: opts.maxPlayers,
      });
      onStartModalClose();

      let oturumKaydi = res.ok ? res.data : null;
      const createHata = res.ok ? undefined : res.hata;
      if (!oturumKaydi && /active game already exists/i.test(createHata ?? '')) {
        oturumKaydi = await aktifOyunOturumuGetir(roomMeta.roomId);
        if (oturumKaydi) {
          GameLogger.info('create_game_session: mevcut oturuma bağlanıldı', {
            sessionId: oturumKaydi.id,
            status: oturumKaydi.status,
          });
        }
      }
      if (!oturumKaydi) {
        Alert.alert('Oyun', createHata ?? 'Oyun başlatılamadı');
        if (!res.ok) GameLogger.error('create_game_session', { hata: createHata });
        return;
      }

      startDenendi.current = false;
      setSessionLocal(oturumKaydi);
      oturum.setSession(oturumKaydi);
      await yenileOyuncular(oturumKaydi.id);

      if (oturumKaydi.status === 'playing') {
        setLobbySeconds(null);
        setPhase('playing');
      } else if (oturumKaydi.status === 'countdown') {
        setLobbySeconds(null);
        setPhase('countdown');
      } else {
        setLobbySeconds(LOBBY_COUNTDOWN_SECONDS);
        setPhase('lobby');
      }
      void playMatch3Sfx('game_start');
    },
    [onStartModalClose, oturum, roomMeta.roomId, yenileOyuncular],
  );

  const handleJoin = useCallback(async () => {
    const target = inviteSession ?? session;
    if (!target) return;
    const res = await joinGameSession({ sessionId: target.id });
    setShowInvite(false);
    onInviteDismiss?.();
    if (!res.ok) {
      Alert.alert('Oyun', res.hata);
      GameLogger.error('join_game_session', { hata: res.hata });
      return;
    }
    setSessionLocal(target);
    oturum.setSession(target);
    await yenileOyuncular(target.id);
    setLobbySeconds(LOBBY_COUNTDOWN_SECONDS);
    setPhase('lobby');
  }, [inviteSession, onInviteDismiss, oturum, session, yenileOyuncular]);

  const handleStartNow = useCallback(async () => {
    if (!session || startDenendi.current) return;
    const hazirSayisi = (oturum.players.length ? oturum.players : []).filter(
      (p) => p.status !== 'left' && p.status !== 'dnf',
    ).length;
    if (oturum.players.length > 0 && hazirSayisi < MIN_PLAYERS) {
      Alert.alert('Oyun', `En az ${MIN_PLAYERS} oyuncu gerekli.`);
      return;
    }
    startDenendi.current = true;
    const res = await startGameSession(session.id);
    if (!res.ok) {
      startDenendi.current = false;
      Alert.alert('Oyun', res.hata);
      GameLogger.error('start_game_session', { hata: res.hata });
      return;
    }
    setSessionLocal(res.data);
    oturum.setSession(res.data);
    setPhase('countdown');
  }, [oturum.players, oturum.setSession, session]);

  const handleCountdownDone = useCallback(() => {
    setPhase('playing');
  }, []);

  const handleFinished = useCallback(
    async (payload: {
      score: number;
      moveCount: number;
      highestCombo: number;
      boardHash: string;
    }) => {
      if (!session) return;
      await submitGameScore({
        sessionId: session.id,
        score: payload.score,
        moveCount: payload.moveCount,
        highestCombo: payload.highestCombo,
        boardHash: payload.boardHash,
      });
      const res = await finishGameSession(session.id);
      if (res.ok) {
        setRankings(res.data.rankings);
      } else {
        GameLogger.error('finish_game_session', { hata: res.hata });
      }
      setPhase('result');
    },
    [session],
  );

  const closeOverlay = useCallback(() => {
    startDenendi.current = false;
    setPhase('idle');
    setSessionLocal(null);
    setLobbySeconds(null);
    setRankings([]);
    onOverlayClosed?.();
  }, [onOverlayClosed]);

  const endsAt = session?.ends_at ?? new Date(Date.now() + 90_000).toISOString();
  const seed = session?.seed ?? 1;

  const players = useMemo(
    () => (oturum.players.length ? oturum.players : []),
    [oturum.players],
  );

  const aktif =
    startModalVisible ||
    showInvite ||
    phase !== 'idle';

  if (!aktif) return null;

  return (
    <View
      style={[styles.root, phase !== 'idle' && styles.rootBloklayici]}
      pointerEvents={phase === 'idle' ? 'box-none' : 'auto'}
    >
      <OyunBaslatModal
        visible={startModalVisible && phase === 'idle'}
        onClose={onStartModalClose}
        onBaslat={handleCreate}
        onBaslatKaskad={() => {
          onStartModalClose();
          setPhase('kaskad');
        }}
        canStart={isHost}
      />

      {phase === 'kaskad' ? (
        <View style={styles.fill}>
          <KozmikKaskadEkrani
            roomId={roomMeta.roomId}
            voiceActive={roomMeta.micEnabled || true}
            onClose={closeOverlay}
          />
        </View>
      ) : null}

      <OyunDavetiModal
        visible={showInvite}
        davet={
          inviteSession
            ? {
                hostName: hostDisplayName,
                gameName: GAME_DISPLAY_NAME,
                durationSeconds: inviteSession.duration_seconds,
                joinedCount: players.length || 1,
                maxPlayers: inviteSession.max_players,
              }
            : null
        }
        onKatil={() => {
          void handleJoin();
        }}
        onReddet={() => {
          setShowInvite(false);
          onInviteDismiss?.();
        }}
      />

      {phase === 'lobby' && session ? (
        <View style={styles.fill}>
          <OyunLobisi
            title={GAME_DISPLAY_NAME}
            players={players}
            maxPlayers={session.max_players}
            countdownSeconds={lobbySeconds}
            isHost={isHost}
            minPlayers={MIN_PLAYERS}
            onStartNow={() => {
              void handleStartNow();
            }}
            onIptal={closeOverlay}
          />
        </View>
      ) : null}

      {(phase === 'countdown' || phase === 'playing') && session ? (
        <View style={styles.fill}>
          <KristalSavasiEkrani
            sessionId={session.id}
            seed={seed}
            endsAt={endsAt}
            roomMeta={roomMeta}
            players={players}
            durationSeconds={session.duration_seconds}
            inputLocked={phase === 'countdown'}
            timerArmed={phase === 'playing'}
            onExit={closeOverlay}
            onFinished={(payload) => {
              void handleFinished(payload);
            }}
          />
          <GeriSayim running={phase === 'countdown'} onDone={handleCountdownDone} />
        </View>
      ) : null}

      <OyunSonucuModal
        visible={phase === 'result'}
        rankings={rankings}
        selfUserId={selfUserId}
        onClose={closeOverlay}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
  },
  rootBloklayici: {
    backgroundColor: 'transparent',
  },
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: RenkTokenlari.bg,
  },
});
