/**
 * Ses odası oyun katmanı — aktif olunca mount.
 * React.lazy / Metro async chunk burada "unknown module" veriyordu;
 * statik import + aktif kapısı ile güvenilir yükleme.
 *
 * Wrapper oda flex akışına asla girmez (position absolute).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { GameCode, GameSession, RoomGameMeta } from '../ortak/tipler/OyunTipleri';
import { OyunOdaKatmani } from './OyunOdaKatmani';

export type OyunOdaLazyKatmaniProps = {
  aktif: boolean;
  roomMeta: RoomGameMeta;
  isHost: boolean;
  hostDisplayName: string;
  selfUserId?: string;
  startModalVisible: boolean;
  onStartModalClose: () => void;
  inviteSession?: GameSession | null;
  onInviteDismiss?: () => void;
  onOverlayClosed?: () => void;
  visibleGameCodes?: readonly GameCode[];
  initialGameCode?: GameCode | null;
  bottomGap?: number;
};

export function OyunOdaLazyKatmani({
  aktif,
  ...props
}: OyunOdaLazyKatmaniProps) {
  if (!aktif) return null;
  return (
    <View
      pointerEvents="box-none"
      collapsable={false}
      style={styles.overlay}
    >
      <OyunOdaKatmani {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 400,
    elevation: 400,
  },
});
