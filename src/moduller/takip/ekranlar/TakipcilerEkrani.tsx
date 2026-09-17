import React from 'react';
import { TakipListeEkrani } from './TakipListeEkrani';

export function TakipcilerEkrani({ userId }: { userId: string }) {
  return <TakipListeEkrani userId={userId} tur="followers" title="Takipçiler" />;
}
