/**
 * Oda oyun katmani — yalnızca Fruit Wheel.
 * Kart oda layout'una girmez; koltuk ve dock yerinde kalır, üstünden açılır.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FruitWheelEkrani } from '../fruit-wheel/ekranlar/FruitWheelEkrani';
import { fruitWheelIsit } from '../fruit-wheel/servisler/FruitWheelApi';
import { OyunBaslatModal } from '../ortak/bilesenler/OyunBaslatModal';
import { useGorunurOyunKodlari } from '../ortak/hooks/useGorunurOyunKodlari';
import type { GameCode, RoomGameMeta } from '../ortak/tipler/OyunTipleri';
import { OyunOdaAltKart } from './OyunOdaAltKart';

export type OyunOdaKatmaniProps = {
  roomMeta: RoomGameMeta;
  isHost: boolean;
  hostDisplayName: string;
  selfUserId?: string;
  startModalVisible: boolean;
  onStartModalClose: () => void;
  /** Oyun oturumu başlayınca (modal kapansa bile dock gizli kalsın) */
  onGameStarted?: () => void;
  onOverlayClosed?: () => void;
  /** Disaridan verilirse yeniden fetch edilmez (oda zaten yuklemis olabilir). */
  visibleGameCodes?: readonly GameCode[];
  /** Balondan gelince dogrudan bu oyunu ac. */
  initialGameCode?: GameCode | null;
  /** Eski API — oda layout'unu değiştirmez; kart butonların ÜSTÜNDEN açılır. */
  bottomGap?: number;
};

type Phase = 'idle' | 'fruit_wheel';

export function OyunOdaKatmani({
  roomMeta,
  startModalVisible,
  onStartModalClose,
  onGameStarted,
  onOverlayClosed,
  visibleGameCodes: visibleGameCodesProp,
  initialGameCode,
}: OyunOdaKatmaniProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (startModalVisible || phase !== 'idle') fruitWheelIsit();
  }, [phase, startModalVisible]);

  useEffect(() => {
    if (phase !== 'idle' || !initialGameCode) return;
    if (initialGameCode === 'fruit_wheel') setPhase('fruit_wheel');
  }, [initialGameCode, phase]);

  useEffect(() => {
    if (phase === 'idle') return;
    onGameStarted?.();
  }, [phase, onGameStarted]);

  const gorunurHook = useGorunurOyunKodlari({
    enabled: visibleGameCodesProp == null,
  });
  const visibleGameCodes = visibleGameCodesProp ?? gorunurHook.codes;
  const visibilityReady = visibleGameCodesProp != null || !gorunurHook.loading;

  const closeOverlay = useCallback(() => {
    setPhase('idle');
    onOverlayClosed?.();
    void import('../../livekit/MedyaBaglantisi').then((m) => {
      m.MedyaSesOturumunuYenile(true);
    });
  }, [onOverlayClosed]);

  /** Admin oyunu canlı kapatınca açık ekran da kapanır. */
  useEffect(() => {
    if (phase === 'idle' || !visibilityReady) return;
    if (!visibleGameCodes.includes(phase)) closeOverlay();
  }, [phase, visibilityReady, visibleGameCodes, closeOverlay]);

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
  const tamEkran = phase === 'fruit_wheel';
  const topGap = useMemo(() => {
    if (tamEkran) return Math.max(insets.top, 8);
    const minGap = 56 + Math.max(insets.top * 0.1, 0);
    return Math.max(minGap, Math.round(height * 0.1));
  }, [height, insets.top, tamEkran]);
  const bottomGap = tamEkran
    ? Math.max(insets.bottom, 0)
    : Math.max(insets.bottom, 8) + 58;

  const meyveBaslat = useCallback(() => {
    onGameStarted?.();
    onStartModalClose();
    setPhase('fruit_wheel');
  }, [onGameStarted, onStartModalClose]);

  if (!aktif) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <OyunOdaAltKart
        topGap={topGap}
        bottomGap={bottomGap}
        dibine={tamEkran}
        kare={false}
        oyunModu={oyunModu}
        onGapPress={phase === 'idle' ? onStartModalClose : closeOverlay}
      >
        <OyunBaslatModal
          visible={startModalVisible && phase === 'idle'}
          onClose={onStartModalClose}
          onBaslatFruitWheel={
            visibleGameCodes.includes('fruit_wheel') ? meyveBaslat : undefined
          }
          visibleGameCodes={visibleGameCodes}
        />

        {phase === 'fruit_wheel' ? (
          <FruitWheelEkrani
            onClose={closeOverlay}
            onHistory={() => router.push('/oyun/fruit-wheel-gecmis' as never)}
            onRules={() => router.push('/oyun/fruit-wheel-kurallar' as never)}
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
    zIndex: 40,
    elevation: 24,
  },
});
