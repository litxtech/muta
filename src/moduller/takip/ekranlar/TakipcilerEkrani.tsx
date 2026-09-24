import React from 'react';
import { TakipListeEkrani } from './TakipListeEkrani';
import { useCeviri } from '../../../i18n/useCeviri';

export function TakipcilerEkrani({ userId }: { userId: string }) {
  const { t } = useCeviri();
  return (
    <TakipListeEkrani
      userId={userId}
      tur="followers"
      title={t('takip.takipciler')}
    />
  );
}
