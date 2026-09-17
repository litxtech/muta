/**
 * Coin mağaza oranı — tek ekonomik sabit.
 * 1 coin = 0,10 ₺  →  10 coin = 1 ₺
 * (Eski referans: 1120 coin / 112 ₺)
 * Paket coin hesabı: `CoinPaketHesap.ts`
 */
export const COIN_TRY_ORANI = 0.1;

export function CoinTryKarsiligi(coins: number): number {
  const n = Number(coins);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * COIN_TRY_ORANI * 100) / 100;
}

export function ElmasTryKarsiligi(diamonds: number): number {
  // Elmas ≈ coin ekonomik değeri (katalogda diamond_value ≈ coin_cost * 0.8)
  // Kazanç ekranında harcanan coin üzerinden göstermek daha doğru;
  // elmas için yaklaşık 0.1 ₺ kullan.
  return CoinTryKarsiligi(diamonds);
}

export function TryYazi(tutar: number): string {
  return `${tutar.toLocaleString('tr-TR', {
    minimumFractionDigits: tutar % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} ₺`;
}
