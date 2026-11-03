/**
 * Coin paket kataloğu — Store Product ID'leri sabittir (App Store / Play).
 * Coin miktarı / bonus / görünürlük admin + Supabase'ten gelir.
 * Gerçek tahsilat fiyatı StoreKit / Play Billing'den okunur (price_try referans).
 *
 * 8 kademe: taban coin (orantılı) + kademe bonusu. Kartta toplam gösterilir.
 */

import i18n from '../../../i18n';
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

type CoinPaketKademeIc = {
  sku: TamusoCoinProductId;
  titleKey:
    | 'coinPaket.pack1'
    | 'coinPaket.pack2'
    | 'coinPaket.pack3'
    | 'coinPaket.pack4'
    | 'coinPaket.pack5'
    | 'coinPaket.pack6'
    | 'coinPaket.pack7'
    | 'coinPaket.pack8';
  /** Referans liste (mağaza fiyatı UI'da override eder) */
  priceTry: number;
  priceUsd: number;
  /** Orantılı taban coin */
  coins: number;
  /** Kademe bonusu — kartta taban + bonus = toplam gösterilir */
  bonusCoins: number;
  badgeKey: 'coinPaket.badgePopuler' | 'coinPaket.badgeEnAvantajli' | null;
  badgeLiteral: string | null;
  sortOrder: number;
  isActiveDefault: boolean;
};

export type CoinPaketKademe = {
  sku: TamusoCoinProductId;
  title: string;
  priceTry: number;
  priceUsd: number;
  coins: number;
  bonusCoins: number;
  badge: string | null;
  sortOrder: number;
  isActiveDefault: boolean;
};

/**
 * 8 kademeli tarife.
 * Oran: 99,99 ₺ = 320 coin → 1 ₺ ≈ 3,20 coin.
 * Büyük paketlerde taban orantılıdır; üstüne kademe bonusu eklenir.
 *
 *  1 Başlangıç  320                 (bonus yok)
 *  2 Popüler    1.600 + 100   = 1.700   (+%6)
 *  3 Prestij    3.200 + 300   = 3.500   (+%9)
 *  4 Max       16.000 + 2.000 = 18.000  (+%12,5)
 *  5 Plus      25.600 + 4.400 = 30.000  (+%17)
 *  6 Elite     38.400 + 7.600 = 46.000  (+%20)
 *  7 Premium   48.000 + 12.000 = 60.000 (+%25)
 *  8 Ultra    160.000 + 60.000 = 220.000 (+%37,5)
 */
const COIN_PAKET_KADEMELERI_IC: readonly CoinPaketKademeIc[] = [
  {
    sku: 'tamuso_coin_pack_1',
    titleKey: 'coinPaket.pack1',
    priceTry: 99.99,
    priceUsd: 2.99,
    coins: 320,
    bonusCoins: 0,
    badgeKey: null,
    badgeLiteral: null,
    sortOrder: 1,
    isActiveDefault: true,
  },
  {
    sku: 'tamuso_coin_pack_2',
    titleKey: 'coinPaket.pack2',
    priceTry: 499.99,
    priceUsd: 14.99,
    coins: 1600,
    bonusCoins: 100,
    badgeKey: 'coinPaket.badgePopuler',
    badgeLiteral: null,
    sortOrder: 2,
    isActiveDefault: true,
  },
  {
    sku: 'tamuso_coin_pack_3',
    titleKey: 'coinPaket.pack3',
    priceTry: 999.99,
    priceUsd: 29.99,
    coins: 3200,
    bonusCoins: 300,
    badgeKey: null,
    badgeLiteral: null,
    sortOrder: 3,
    isActiveDefault: true,
  },
  {
    sku: 'tamuso_coin_pack_4',
    titleKey: 'coinPaket.pack4',
    priceTry: 4999.99,
    priceUsd: 149.99,
    coins: 16000,
    bonusCoins: 2000,
    badgeKey: null,
    badgeLiteral: null,
    sortOrder: 4,
    isActiveDefault: true,
  },
  {
    sku: 'tamuso_coin_pack_5',
    titleKey: 'coinPaket.pack5',
    priceTry: 7999.99,
    priceUsd: 239.99,
    coins: 25600,
    bonusCoins: 4400,
    badgeKey: null,
    badgeLiteral: null,
    sortOrder: 5,
    isActiveDefault: true,
  },
  {
    sku: 'tamuso_coin_pack_6',
    titleKey: 'coinPaket.pack6',
    priceTry: 11999,
    priceUsd: 359.99,
    coins: 38400,
    bonusCoins: 7600,
    badgeKey: null,
    badgeLiteral: null,
    sortOrder: 6,
    isActiveDefault: true,
  },
  {
    sku: 'tamuso_coin_pack_7',
    titleKey: 'coinPaket.pack7',
    priceTry: 14999.99,
    priceUsd: 449.99,
    coins: 48000,
    bonusCoins: 12000,
    badgeKey: null,
    badgeLiteral: null,
    sortOrder: 7,
    isActiveDefault: true,
  },
  {
    sku: 'tamuso_coin_pack_8',
    titleKey: 'coinPaket.pack8',
    priceTry: 49999.99,
    priceUsd: 1499.99,
    coins: 160000,
    bonusCoins: 60000,
    badgeKey: 'coinPaket.badgeEnAvantajli',
    badgeLiteral: null,
    sortOrder: 8,
    isActiveDefault: true,
  },
] as const;

function kademeCevir(k: CoinPaketKademeIc): CoinPaketKademe {
  return {
    sku: k.sku,
    title: i18n.t(k.titleKey),
    priceTry: k.priceTry,
    priceUsd: k.priceUsd,
    coins: k.coins,
    bonusCoins: k.bonusCoins,
    badge: k.badgeKey ? i18n.t(k.badgeKey) : k.badgeLiteral,
    sortOrder: k.sortOrder,
    isActiveDefault: k.isActiveDefault,
  };
}

/** Canlı dilde kademeler */
export function CoinPaketKademeleriniAl(): CoinPaketKademe[] {
  return COIN_PAKET_KADEMELERI_IC.map(kademeCevir);
}

/** Geriye dönük — her okumada canlı dil */
export const COIN_PAKET_KADEMELERI: readonly CoinPaketKademe[] = new Proxy(
  [] as CoinPaketKademe[],
  {
    get(_t, prop, receiver) {
      const live = CoinPaketKademeleriniAl();
      if (prop === 'length') return live.length;
      if (prop === Symbol.iterator) return live[Symbol.iterator].bind(live);
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        return live[Number(prop)];
      }
      const v = Reflect.get(live, prop, receiver);
      return typeof v === 'function' ? v.bind(live) : v;
    },
    ownKeys() {
      return Reflect.ownKeys(CoinPaketKademeleriniAl());
    },
    getOwnPropertyDescriptor(_t, prop) {
      const live = CoinPaketKademeleriniAl();
      const desc = Reflect.getOwnPropertyDescriptor(live, prop);
      if (desc) desc.configurable = true;
      return desc;
    },
  },
);

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
  return CoinPaketKademeleriniAl()
    .filter((k) => k.isActiveDefault)
    .map(PaketHesapla);
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
