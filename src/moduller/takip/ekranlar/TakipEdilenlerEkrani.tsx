import React from 'react';
import { TakipListeEkrani } from './TakipListeEkrani';

export function TakipEdilenlerEkrani({ userId }: { userId: string }) {
  return <TakipListeEkrani userId={userId} tur="following" title="Takip Edilenler" />;
}
