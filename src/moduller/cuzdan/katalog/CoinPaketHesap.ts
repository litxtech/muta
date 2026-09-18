/**
 * Coin ekonomi modeli — tek kaynak.
 *
 * Liste fiyatı: 1 coin = 0,10 ₺  (10 coin = 1 ₺)
 * Büyük pakette bonus → efektif ₺/coin düşer (TikTok tarzı merdiven).
 * App Store tahsilatı Connect price point’ten gelir; bu oran UI + coin hesabı içindir.
 */

export const COIN_TRY_ORANI = 0.1;

/** Mağaza IAP uçları — Apple TRY price point (X.99) */
export const APPLE_TRY_MIN = 99.99;
export const APPLE_TRY_MAX = 4_999.99;

export type CoinPaketKademe = {
  sku: string;
  title: string;
  priceTry: number;
  priceUsd: number;
  /** Liste üzeri bonus % (0 = birebir oran) */
  bonusYuzde: number;
  badge: string | null;
  sortOrder: number;
};

/**
 * 4 kademe: Apple uyumlu 99,99 → 4.999,99
 * Bonus merdiveni: 0% / 5% / 12% / 20%
 */
export const COIN_PAKET_KADEMELERI: readonly CoinPaketKademe[] = [
  {
    sku: 'coins_try_99_99',
    title: 'Başlangıç',
    priceTry: APPLE_TRY_MIN,
    priceUsd: 2.99,
    bonusYuzde: 0,
    badge: null,
    sortOrder: 1,
  },
  {
    sku: 'coins_try_499_99',
    title: 'Popüler',
    priceTry: 499.99,
    priceUsd: 14.99,
    bonusYuzde: 5,
    badge: 'POPÜLER',
    sortOrder: 2,
  },
  {
    sku: 'coins_try_999_99',
    title: 'Prestij',
    priceTry: 999.99,
    priceUsd: 29.99,
    bonusYuzde: 12,
    badge: 'VIP',
    sortOrder: 3,
  },
  {
    sku: 'coins_try_4999_99',
    title: 'Max',
    priceTry: APPLE_TRY_MAX,
    priceUsd: 149.99,
    bonusYuzde: 20,
    badge: 'MAX',
    sortOrder: 4,
  },
] as const;

export type CoinPaketHesap = {
  sku: string;
  title: string;
  priceTry: number;
  priceUsd: number;
  coins: number;
  bonusCoins: number;
  toplamCoin: number;
  bonusYuzde: number;
  /** Liste: her zaman ~0.10 */
  listeTlPerCoin: number;
  /** Ödenen ₺ / toplam coin (bonuslu) */
  efektifTlPerCoin: number;
  badge: string | null;
  sortOrder: number;
};

/** Taban coin = fiyat ÷ 0.10 (yuvarlak) */
export function TabanCoinHesapla(priceTry: number): number {
  const p = Number(priceTry);
  if (!Number.isFinite(p) || p <= 0) return 0;
  return Math.max(1, Math.round(p / COIN_TRY_ORANI));
}

export function PaketHesapla(k: CoinPaketKademe): CoinPaketHesap {
  const coins = TabanCoinHesapla(k.priceTry);
  const bonusCoins =
    k.bonusYuzde > 0 ? Math.round((coins * k.bonusYuzde) / 100) : 0;
  const toplamCoin = coins + bonusCoins;
  return {
    sku: k.sku,
    title: k.title,
    priceTry: k.priceTry,
    priceUsd: k.priceUsd,
    coins,
    bonusCoins,
    toplamCoin,
    bonusYuzde: k.bonusYuzde,
    listeTlPerCoin: COIN_TRY_ORANI,
    efektifTlPerCoin:
      toplamCoin > 0
        ? Math.round((k.priceTry / toplamCoin) * 10000) / 10000
        : COIN_TRY_ORANI,
    badge: k.badge,
    sortOrder: k.sortOrder,
  };
}

export function TumPaketHesaplari(): CoinPaketHesap[] {
  return COIN_PAKET_KADEMELERI.map(PaketHesapla);
}

/** Kaç adet 1-coin hediye (gül) alınır */
export function GulKarsiligi(toplamCoin: number): number {
  return Math.max(0, Math.floor(toplamCoin));
}
