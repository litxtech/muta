import React from 'react';
import { CanliSohbetPaneli } from '../../canli-sohbet/bilesenler/CanliSohbetPaneli';
import { useCeviri } from '../../../i18n/useCeviri';

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
  const { t } = useCeviri();
  return (
    <CanliSohbetPaneli
      kanal={{ tur: 'oda', id: roomId }}
      canSend={canSend}
      currentUserId={currentUserId}
      onNeedUpgrade={onNeedUpgrade}
      onClose={onClose}
      varyant="live"
      baslik={t('canliYayin.yorumlar')}
    />
  );
}
