/**
 * Finansal islemler icin istemci tarafli idempotency anahtari.
 * Benzersizlik: user+op+time+random — sunucu da unique tutar.
 */
export function FinansIdempotencyAnahtariOlustur(
  islem: 'gift_send' | 'coin_purchase' | 'agency_transfer' | 'withdrawal',
): string {
  const rastgele =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${islem}_${rastgele}`;
}
