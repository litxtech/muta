/**
 * Ses odası oyun katmanı — aktif olunca mount.
 * React.lazy / Metro async chunk burada "unknown module" veriyordu;
 * statik import + aktif kapısı ile güvenilir yükleme.
 */

import React from 'react';
import type { GameSession, RoomGameMeta } from '../ortak/tipler/OyunTipleri';
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
};

export function OyunOdaLazyKatmani({
  aktif,
  ...props
}: OyunOdaLazyKatmaniProps) {
  if (!aktif) return null;
  return <OyunOdaKatmani {...props} />;
}
