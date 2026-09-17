import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TakipEdilenlerEkrani } from '../../src/moduller/takip/ekranlar/TakipEdilenlerEkrani';

export default function TakipEdilenlerRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <TakipEdilenlerEkrani userId={String(userId ?? '')} />;
}
