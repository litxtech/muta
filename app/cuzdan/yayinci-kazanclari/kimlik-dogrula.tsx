import React from 'react';
import { Stack } from 'expo-router';
import { TamusoVerifyAkisi } from '../../../src/moduller/tamuso-verify/TamusoVerifyAkisi';

/**
 * Cüzdanım → Yayıncı Kazancım → Kimliğimi Doğrula
 * Bildirimlerde ve ödeme kapısı yönlendirmelerinde kullanılan kanonik yol.
 */
export default function KimlikDogrulaEkrani() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TamusoVerifyAkisi geriDonHref="/cuzdan/yayinci-kazanclari" />
    </>
  );
}
