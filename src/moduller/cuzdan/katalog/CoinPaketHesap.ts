/**
 * Coin paket kataloğu — Store Product ID'leri sabittir (App Store / Play).
 * Coin miktarı / bonus / görünürlük admin + Supabase'ten gelir.
 * Gerçek tahsilat fiyatı StoreKit / Play Billing'den okunur (price_try referans).
 */

import { COIN_TRY_ORANI, CoinTryOraniCanli } from './CoinTryOrani';

export { COIN_TRY_ORANI, CoinTryOraniCanli };

/** Mağaza IAP Product ID'leri — DEĞİŞTİRİLMEZ */
export const TAMUSO_COIN_PRODUCT_IDS = [
  'tamuso_coin_pack_1',
  'tamuso_coin_pack_2',
  'tamuso_coin_pack_3',
  'tamuso_coin_pack_4',
  'tamuso_coin_pack_5',
  'tamuso_coin_pack_6',
  'tamuso_coin_pack_7',
  'tamuso_coin_pack_8',
] as const;

export type TamusoCoinProductId = (typeof TAMUSO_COIN_PRODUCT_IDS)[number];

export type CoinPaketKademe = {
  sku: TamusoCoinProductId;
  title: string;
  /** Referans liste (mağaza fiyatı UI'da override eder) */
  priceTry: number;
  priceUsd: number;
  coins: number;
  bonusCoins: number;
  badge: string | null;
  sortOrder: number;
  /** Pack 5–8 varsayılan kapalı; admin açar */
  isActiveDefault: boolean;
};

/**
 * Pack 1–4: talimat coin miktarları.
 * Pack 5–8: coin admin panelinden — burada tahmin yok (0).
 */
export const COIN_PAKET_KADEMELERI: readonly CoinPaketKademe[] = [
  {
    sku: 'tamuso_coin_pack_1',
    title: 'Başlangıç Coin Paketi',
    priceTry: 99.99,
    priceUsd: 2.99,
    coins: 400,
    bonusCoins: 0,
    badge: null,
    sortOrder: 1,
    isActiveDefault: true,
  },
  {
    sku: 'tamuso_coin_pack_2',
    title: 'Popüler Coin Paketi',
    priceTry: 489.99,
    priceUsd: 14.99,
    coins: 1500,
    bonusCoins: 0,
    badge: 'POPÜLER',
    sortOrder: 2,
    isActiveDefault: true,
  },
  {
    sku: 'tamuso_coin_pack_3',
    title: 'Prestij Coin Paketi',
    priceTry: 999.99,
    priceUsd: 29.99,
    coins: 2400,
    bonusCoins: 0,
    badge: null,
    sortOrder: 3,
    isActiveDefault: true,
  },
  {
    sku: 'tamuso_coin_pack_4',
    title: 'Max Coin Paketi',
    priceTry: 4999.99,
    priceUsd: 149.99,
    coins: 5200,
    bonusCoins: 0,
    badge: 'MAX',
    sortOrder: 4,
    isActiveDefault: true,
  },
  {
    sku: 'tamuso_coin_pack_5',
    title: 'Plus Coin Paketi',
    priceTry: 0,
    priceUsd: 0,
    coins: 0,
    bonusCoins: 0,
    badge: null,
    sortOrder: 5,
    isActiveDefault: false,
  },
  {
    sku: 'tamuso_coin_pack_6',
    title: 'Elite Coin Paketi',
    priceTry: 0,
    priceUsd: 0,
    coins: 0,
    bonusCoins: 0,
    badge: null,
    sortOrder: 6,
    isActiveDefault: false,
  },
  {
    sku: 'tamuso_coin_pack_7',
    title: 'Premium Coin Paketi',
    priceTry: 0,
    priceUsd: 0,
    coins: 0,
    bonusCoins: 0,
    badge: null,
    sortOrder: 7,
    isActiveDefault: false,
  },
  {
    sku: 'tamuso_coin_pack_8',
    title: 'Ultra Coin Paketi',
    priceTry: 0,
    priceUsd: 0,
    coins: 0,
    bonusCoins: 0,
    badge: null,
    sortOrder: 8,
    isActiveDefault: false,
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
  badge: string | null;
  sortOrder: number;
};

export function PaketHesapla(k: CoinPaketKademe): CoinPaketHesap {
  const toplamCoin = k.coins + k.bonusCoins;
  return {
    sku: k.sku,
    title: k.title,
    priceTry: k.priceTry,
    priceUsd: k.priceUsd,
    coins: k.coins,
    bonusCoins: k.bonusCoins,
    toplamCoin,
    badge: k.badge,
    sortOrder: k.sortOrder,
  };
}

export function TumPaketHesaplari(): CoinPaketHesap[] {
  return COIN_PAKET_KADEMELERI.filter((k) => k.isActiveDefault).map(PaketHesapla);
}

/** @deprecated Oran tabanlı hesap — yeni sistemde kullanılmaz */
export function TabanCoinHesapla(priceTry: number): number {
  const p = Number(priceTry);
  if (!Number.isFinite(p) || p <= 0) return 0;
  const oran = CoinTryOraniCanli() || COIN_TRY_ORANI;
  return Math.max(1, Math.round(p / oran));
}

export function GulKarsiligi(toplamCoin: number): number {
  return Math.max(0, Math.floor(toplamCoin));
}
