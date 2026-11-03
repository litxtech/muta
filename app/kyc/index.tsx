import React from 'react';
import { Stack } from 'expo-router';
import { TamusoVerifyAkisi } from '../../src/moduller/tamuso-verify/TamusoVerifyAkisi';

/**
 * Tamuso Verify giriş noktası.
 * Eski basit KYC formunun yerini alır; tüm durum geçişleri sunucudadır.
 */
export default function KycEkrani() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TamusoVerifyAkisi geriDonHref="/cuzdan/yayinci-kazanclari" />
    </>
  );
}
