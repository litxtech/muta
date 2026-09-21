/**
 * Takas teklif metni — push, note ve sohbet için ortak şablon.
 * Katalog özeti gösterilir; “satış / nakit” dili kullanılmaz.
 */

import { CoinDegerOzeti, TryYazi } from '../katalog/CoinTakasPaylasimi';

/** Mağaza paketlerinde kullanılan yaklaşık kur (1 $ ≈ 35 ₺) */
export const TAKAS_TRY_USD = 35;

export function CoinUsdYaklasik(tl: number): number {
  const n = Number(tl);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.round(n / TAKAS_TRY_USD));
}

export function UsdYazi(usd: number): string {
  return `${usd.toLocaleString('tr-TR')} $`;
}

export function CoinYazi(coins: number): string {
  return Math.floor(Number(coins) || 0).toLocaleString('tr-TR');
}

/** Teklif gövdesi — katalog özeti; “satmak” dili yok */
export function TeklifMesajiOlustur(coins: number): string {
  const ozet = CoinDegerOzeti(coins);
  return (
    `Merhaba, ${CoinYazi(ozet.coins)} coin için takas teklifim var ` +
    `(katalog özeti: ${TryYazi(ozet.saticiNetTl)}). ` +
    `Uygulama içi sanal öğe transferidir. Kabul edersen işlemleri başlatalım.`
  );
}

/** Push gövdesi — kısa */
export function TeklifPushOzeti(coins: number, saticiNetTl?: number): string {
  const ozet = CoinDegerOzeti(coins);
  const net =
    saticiNetTl != null && Number.isFinite(Number(saticiNetTl))
      ? Number(saticiNetTl)
      : ozet.saticiNetTl;
  return (
    `${CoinYazi(ozet.coins)} coin takas teklifi · katalog ${TryYazi(net)}. ` +
    `Kabul edersen işlemleri başlatalım.`
  );
}
