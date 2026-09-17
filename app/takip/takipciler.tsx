import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TakipcilerEkrani } from '../../src/moduller/takip/ekranlar/TakipcilerEkrani';

export default function TakipcilerRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <TakipcilerEkrani userId={String(userId ?? '')} />;
}
