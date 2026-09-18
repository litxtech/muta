/**
 * Coin takas paylaşımı — cüzdan stoku katalog değeri.
 * 1 coin = 0,10 ₺ → satıcı %40 · platform %60
 * (Elmas çekimi / host kazancı ayrıdır.)
 */

import { COIN_TRY_ORANI, CoinTryKarsiligi, TryYazi } from './CoinTryOrani';

export const PLATFORM_PAY_ORANI = 0.6;
export const SATICI_PAY_ORANI = 0.4;

/** IAP sonrası takasa girmeden önce soğutma (gün) — store iade penceresi */
export const IAP_TAKAS_SOGUTMA_GUN = 14;

export type CoinDegerOzeti = {
  coins: number;
  katalogTl: number;
  platformTl: number;
  saticiNetTl: number;
};

function TlYuvarla(n: number): number {
  return Math.round(n * 100) / 100;
}

export function CoinKatalogDegeri(coins: number): number {
  return CoinTryKarsiligi(coins);
}

export function CoinSaticiNet(coins: number): number {
  return TlYuvarla(CoinKatalogDegeri(coins) * SATICI_PAY_ORANI);
}

export function CoinPlatformPayi(coins: number): number {
  return TlYuvarla(CoinKatalogDegeri(coins) * PLATFORM_PAY_ORANI);
}

export function CoinDegerOzeti(coins: number): CoinDegerOzeti {
  const n = Number(coins);
  const guvenli = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  const katalogTl = CoinKatalogDegeri(guvenli);
  const saticiNetTl = TlYuvarla(katalogTl * SATICI_PAY_ORANI);
  const platformTl = TlYuvarla(katalogTl * PLATFORM_PAY_ORANI);
  return { coins: guvenli, katalogTl, platformTl, saticiNetTl };
}

export { COIN_TRY_ORANI, TryYazi };
