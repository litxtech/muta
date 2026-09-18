/**
 * Takas teklif metni — push, note ve sohbet için ortak şablon.
 * Fiyat: satıcı net TL (katalog × %40) + yaklaşık USD.
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

/** Örn: Merhaba, benim 100.000 coinim var; bunu sana 4.000 ₺ veya yaklaşık 114 $'a satmak istiyorum… */
export function TeklifMesajiOlustur(coins: number): string {
  const ozet = CoinDegerOzeti(coins);
  const usd = CoinUsdYaklasik(ozet.saticiNetTl);
  return (
    `Merhaba, benim ${CoinYazi(ozet.coins)} coinim var; ` +
    `bunu sana ${TryYazi(ozet.saticiNetTl)} veya yaklaşık ${UsdYazi(usd)}'a satmak istiyorum. ` +
    `Kabul edersen işlemleri başlatalım.`
  );
}

/** Push gövdesi — biraz daha kısa */
export function TeklifPushOzeti(coins: number, saticiNetTl?: number): string {
  const ozet = CoinDegerOzeti(coins);
  const net = saticiNetTl != null && Number.isFinite(Number(saticiNetTl))
    ? Number(saticiNetTl)
    : ozet.saticiNetTl;
  const usd = CoinUsdYaklasik(net);
  return (
    `${CoinYazi(ozet.coins)} coin · ${TryYazi(net)} / ~${UsdYazi(usd)}. ` +
    `Kabul edersen işlemleri başlatalım.`
  );
}
