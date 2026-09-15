import React from 'react';
import { CanliSohbetPaneli } from '../../canli-sohbet/bilesenler/CanliSohbetPaneli';

type Props = {
  roomId: string;
  canSend: boolean;
  currentUserId?: string | null;
  onNeedUpgrade?: () => void;
  onClose?: () => void;
};

/** Sesli oda sohbeti — TikTok/Twitch/YT live yorum stili */
export function OdaSohbetPaneli({
  roomId,
  canSend,
  currentUserId,
  onNeedUpgrade,
  onClose,
}: Props) {
  return (
    <CanliSohbetPaneli
      kanal={{ tur: 'oda', id: roomId }}
      canSend={canSend}
      currentUserId={currentUserId}
      onNeedUpgrade={onNeedUpgrade}
      onClose={onClose}
      varyant="live"
      baslik="Yorumlar"
    />
  );
}
