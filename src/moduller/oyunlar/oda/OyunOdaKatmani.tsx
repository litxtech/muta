/**
 * Oda oyun katmani — overlay orchestrator.
 * ASLA MedyaOdasiKes / router leave cagirmaz.
 * Kart oda layout'una girmez; koltuk ve dock yerinde kalır, üstünden açılır.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerKozmikKaskad } from '../kaskad/KaskadKayit';
import { KozmikKaskadEkrani } from '../kaskad/ekranlar/KozmikKaskadEkrani';
import { registerZeus } from '../zeus/ZeusKayit';
import { ZeusEkrani } from '../zeus/ekranlar/ZeusEkrani';
import { registerNoxReels } from '../slot/SlotKayit';
import { SlotOyunEkrani } from '../slot/ekranlar/SlotOyunEkrani';
import { OyunBaslatModal } from '../ortak/bilesenler/OyunBaslatModal';
import { useGorunurOyunKodlari } from '../ortak/hooks/useGorunurOyunKodlari';
import type { GameCode, GameSession, RoomGameMeta } from '../ortak/tipler/OyunTipleri';
import { OyunOdaAltKart } from './OyunOdaAltKart';

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
  /** Disaridan verilirse yeniden fetch edilmez (oda zaten yuklemis olabilir). */
  visibleGameCodes?: readonly GameCode[];
  /** Balondan gelince dogrudan bu oyunu ac. */
  initialGameCode?: GameCode | null;
  /** Eski API — oda layout'unu değiştirmez; kart butonların ÜSTÜNDEN açılır. */
  bottomGap?: number;
};

type Phase = 'idle' | 'kaskad' | 'zeus' | 'nox';

export function OyunOdaKatmani({
  roomMeta,
  startModalVisible,
  onStartModalClose,
  inviteSession,
  onInviteDismiss,
  onOverlayClosed,
  visibleGameCodes: visibleGameCodesProp,
  initialGameCode,
}: OyunOdaKatmaniProps) {
  useEffect(() => {
    registerKozmikKaskad();
    registerZeus();
    registerNoxReels();
  }, []);

  const [phase, setPhase] = useState<Phase>('idle');
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!initialGameCode || phase !== 'idle') return;
    if (initialGameCode === 'kozmik_kaskad') {
      setPhase('kaskad');
    } else if (initialGameCode === 'zeus') {
      setPhase('zeus');
    } else if (initialGameCode === 'nox_reels') {
      setPhase('nox');
    }
  }, [initialGameCode, phase]);
  const gorunurHook = useGorunurOyunKodlari({
    enabled: visibleGameCodesProp == null,
  });
  const visibleGameCodes = visibleGameCodesProp ?? gorunurHook.codes;
  const visibilityReady = visibleGameCodesProp != null || !gorunurHook.loading;
  const yenileGorunur = gorunurHook.yenile;

  useEffect(() => {
    if (startModalVisible && visibleGameCodesProp == null) {
      void yenileGorunur();
    }
  }, [startModalVisible, visibleGameCodesProp, yenileGorunur]);

  // Oyun seçim kartı açılır açılmaz görselleri ısıt — tahta açılınca simgeler hazır olsun
  useEffect(() => {
    if (!startModalVisible) return;
    void import('../kaskad/assets/preloadKaskadAssets').then((m) => {
      m.warmKaskadAssetsEarly();
    });
    void import('../zeus/assets/preloadZeusAssets').then((m) => {
      m.warmZeusAssetsEarly();
    });
    void import('../slot/assets/preloadNoxAssets').then((m) => {
      m.warmNoxAssetsEarly();
    });
  }, [startModalVisible]);

  // Eski Match-3 davetleri (veya kapali oyunlar) sessizce kapatilir.
  useEffect(() => {
    if (!inviteSession) return;
    if (!visibilityReady) return;
    onInviteDismiss?.();
  }, [inviteSession, visibilityReady, onInviteDismiss]);

  const closeOverlay = useCallback(() => {
    // Ekran unmount öncesi / async race — müzik arka planda kalmasın
    void import('../kaskad/ses/GameAudioManager').then((m) => {
      m.stopAllKaskadAudio();
    });
    void import('../slot/ses/SlotSesYoneticisi').then((m) => {
      m.stopAllSlotAudio();
    });
    setPhase('idle');
    onOverlayClosed?.();
    // Oyun SFX LiveKit AVAudioSession'i bozmus olabilir — ses odasini toparla
    void import('../../livekit/MedyaBaglantisi').then((m) => {
      m.MedyaSesOturumunuYenile(true);
    });
  }, [onOverlayClosed]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase !== 'idle') {
        closeOverlay();
        return true;
      }
      if (startModalVisible) {
        onStartModalClose();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [closeOverlay, onStartModalClose, phase, startModalVisible]);

  const aktif = startModalVisible || phase !== 'idle';
  const oyunModu = phase !== 'idle';
  const topGap = useMemo(() => {
    const oran = oyunModu ? 0.18 : 0.22;
    const minGap = (oyunModu ? 88 : 108) + Math.max(insets.top * 0.12, 0);
    return Math.max(minGap, Math.round(height * oran));
  }, [height, insets.top, oyunModu]);
  // Dock / alt bar yerinde kalır; kart onun ÜSTÜNDEN açılır.
  const bottomGap = Math.max(insets.bottom, 8) + 58;

  if (!aktif) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <OyunOdaAltKart
        topGap={topGap}
        bottomGap={bottomGap}
        oyunModu={oyunModu}
        onGapPress={
          phase === 'idle' ? onStartModalClose : closeOverlay
        }
      >
        <OyunBaslatModal
          visible={startModalVisible && phase === 'idle'}
          onClose={onStartModalClose}
          onBaslatKaskad={
            visibleGameCodes.includes('kozmik_kaskad')
              ? () => {
                  onStartModalClose();
                  setPhase('kaskad');
                }
              : undefined
          }
          onBaslatZeus={
            visibleGameCodes.includes('zeus')
              ? () => {
                  onStartModalClose();
                  setPhase('zeus');
                }
              : undefined
          }
          onBaslatNox={
            visibleGameCodes.includes('nox_reels')
              ? () => {
                  onStartModalClose();
                  setPhase('nox');
                }
              : undefined
          }
          visibleGameCodes={visibleGameCodes}
        />

        {phase === 'kaskad' ? (
          <KozmikKaskadEkrani
            roomId={roomMeta.roomId}
            voiceActive={roomMeta.micEnabled || true}
            onClose={closeOverlay}
            embedded
          />
        ) : null}

        {phase === 'zeus' ? (
          <ZeusEkrani
            roomId={roomMeta.roomId}
            voiceActive={roomMeta.micEnabled || true}
            onClose={closeOverlay}
            embedded
          />
        ) : null}

        {phase === 'nox' ? (
          <SlotOyunEkrani
            roomId={roomMeta.roomId}
            voiceActive={roomMeta.micEnabled || true}
            onClose={closeOverlay}
            embedded
          />
        ) : null}
      </OyunOdaAltKart>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 400,
    elevation: 400,
  },
});
