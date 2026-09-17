/**
 * Oyun oturumu hook — game:{sessionId} realtime + lokal durum.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { gameChannelName } from '../sabitler/OyunSabitleri';
import { GameLogger } from '../../cekirdek/OyunLogger';
import type {
  GameRealtimeEvent,
  GameSession,
  GameSessionPlayer,
  GameSessionStatus,
  LeaderboardEntry,
} from '../tipler/OyunTipleri';

export type OyunOturumDurumu = {
  session: GameSession | null;
  players: GameSessionPlayer[];
  status: GameSessionStatus | null;
  rankings: LeaderboardEntry[];
  lastEvent: GameRealtimeEvent | null;
  bagli: boolean;
};

const bosDurum: OyunOturumDurumu = {
  session: null,
  players: [],
  status: null,
  rankings: [],
  lastEvent: null,
  bagli: false,
};

function upsertPlayer(
  list: GameSessionPlayer[],
  player: GameSessionPlayer,
): GameSessionPlayer[] {
  const i = list.findIndex((p) => p.user_id === player.user_id);
  if (i < 0) return [...list, player];
  const next = list.slice();
  next[i] = { ...next[i]!, ...player };
  return next;
}

export function useOyunOturumu(sessionId: string | undefined) {
  const [durum, setDurum] = useState<OyunOturumDurumu>(bosDurum);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const uygulaEvent = useCallback((event: GameRealtimeEvent) => {
    setDurum((prev) => {
      switch (event.type) {
        case 'player_joined':
          return {
            ...prev,
            players: upsertPlayer(prev.players, event.player),
            lastEvent: event,
          };
        case 'player_left':
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.user_id === event.userId ? { ...p, status: 'left' } : p,
            ),
            lastEvent: event,
          };
        case 'countdown_started':
          return {
            ...prev,
            status: 'countdown',
            session: prev.session
              ? { ...prev.session, status: 'countdown' }
              : prev.session,
            lastEvent: event,
          };
        case 'game_started':
          return {
            ...prev,
            status: 'playing',
            session: prev.session
              ? {
                  ...prev.session,
                  status: 'playing',
                  started_at: event.startedAt,
                  ends_at: event.endsAt,
                  seed: event.seed,
                }
              : prev.session,
            lastEvent: event,
          };
        case 'score_update':
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.user_id === event.userId
                ? {
                    ...p,
                    score: event.score,
                    combo_max: Math.max(p.combo_max, event.comboMax),
                    move_count: event.moveCount,
                  }
                : p,
            ),
            lastEvent: event,
          };
        case 'player_finished':
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.user_id === event.userId
                ? { ...p, status: 'finished', score: event.score }
                : p,
            ),
            lastEvent: event,
          };
        case 'game_finished':
          return {
            ...prev,
            status: 'finished',
            rankings: event.rankings,
            session: prev.session
              ? { ...prev.session, status: 'finished' }
              : prev.session,
            lastEvent: event,
          };
        default:
          return { ...prev, lastEvent: event };
      }
    });
  }, []);

  const setSession = useCallback((session: GameSession | null) => {
    setDurum((prev) => ({
      ...prev,
      session,
      status: session?.status ?? null,
    }));
  }, []);

  const setPlayers = useCallback((players: GameSessionPlayer[]) => {
    setDurum((prev) => ({ ...prev, players }));
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setDurum(bosDurum);
      return;
    }

    const topic = gameChannelName(sessionId);
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let kanal: any = null;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bind = (k: any) =>
      k
        .on('broadcast', { event: 'game_event' }, ({ payload }: { payload: GameRealtimeEvent }) => {
          const event = payload as GameRealtimeEvent;
          if (event && typeof event === 'object' && 'type' in event) {
            uygulaEvent(event);
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'game_sessions',
            filter: `id=eq.${sessionId}`,
          },
          (payload: { new: GameSession }) => {
            if (payload.new?.id) {
              setDurum((prev) => ({
                ...prev,
                session: payload.new,
                status: payload.new.status,
              }));
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'game_session_players',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload: { new: GameSessionPlayer }) => {
            if (payload.new?.user_id) {
              setDurum((prev) => ({
                ...prev,
                players: upsertPlayer(prev.players, payload.new),
              }));
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'game_scores',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload: {
            new: {
              user_id: string;
              score: number;
              highest_combo: number;
              move_count: number;
            };
          }) => {
            const row = payload.new;
            if (!row?.user_id) return;
            setDurum((prev) => ({
              ...prev,
              players: prev.players.map((p) =>
                p.user_id === row.user_id
                  ? {
                      ...p,
                      score: Number(row.score ?? p.score),
                      combo_max: Number(row.highest_combo ?? p.combo_max),
                      move_count: Number(row.move_count ?? p.move_count),
                    }
                  : p,
              ),
              lastEvent: {
                type: 'score_update',
                userId: row.user_id,
                score: Number(row.score ?? 0),
                comboMax: Number(row.highest_combo ?? 0),
                moveCount: Number(row.move_count ?? 0),
              },
            }));
          },
        );

    const baglan = () => {
      if (cancelled) return;
      for (const ch of supabase.getChannels()) {
        if (ch.topic === `realtime:${topic}` || ch.topic === topic) {
          void supabase.removeChannel(ch);
        }
      }
      // Tablolar henüz Database tipine ekli olmayabilir — mevcut proje deseni
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kanal = bind(supabase.channel(topic));
      kanal.subscribe((status: string) => {
        if (cancelled) return;
        const bagli = status === 'SUBSCRIBED';
        setDurum((prev) => ({ ...prev, bagli }));
        if (status === 'SUBSCRIBED') {
          attempt = 0;
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          GameLogger.warn('oyun kanal yeniden denenecek', { sessionId, topic, status });
          if (kanal) void supabase.removeChannel(kanal);
          kanal = null;
          const delay = Math.min(10_000, 500 * 2 ** Math.min(attempt, 5));
          attempt += 1;
          retryTimer = setTimeout(baglan, delay);
        }
      });
    };

    baglan();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (kanal) void supabase.removeChannel(kanal);
    };
  }, [sessionId, uygulaEvent]);


  return {
    ...durum,
    setSession,
    setPlayers,
    uygulaEvent,
  };
}
