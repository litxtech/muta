import React from 'react';
import { TakipListeEkrani } from './TakipListeEkrani';
import { useCeviri } from '../../../i18n/useCeviri';

export function TakipEdilenlerEkrani({ userId }: { userId: string }) {
  const { t } = useCeviri();
  return (
    <TakipListeEkrani
      userId={userId}
      tur="following"
      title={t('takip.takipEdilenler')}
    />
  );
}
