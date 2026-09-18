/**
 * Yetkili ajans üzerinden yükleme paketleri.
 * Liste fiyatı 99 ₺ → 300.000 ₺; ajans kanalında %20 indirim.
 */
import { COIN_TRY_ORANI, TabanCoinHesapla } from './CoinPaketHesap';

export const AJANS_COIN_INDIRIM_YUZDE = 20;

/** Liste fiyatları (₺) — ajans seçilince gösterilir */
export const AJANS_COIN_LISTE_FIYATLARI: readonly number[] = [
  99, 249, 499, 999, 2_499, 4_999, 9_999, 24_999, 49_999, 99_999, 199_999,
  300_000,
] as const;

export type AjansCoinPaket = {
  id: string;
  title: string;
  /** Katalog / liste fiyatı */
  listeFiyatTry: number;
  /** Kullanıcının ödeyeceği tutar (%20 indirimli) */
  odenecekTry: number;
  coins: number;
  indirimYuzde: number;
};

function paketBaslik(fiyat: number): string {
  if (fiyat <= 99) return 'Başlangıç';
  if (fiyat <= 499) return 'Standart';
  if (fiyat <= 2_499) return 'Popüler';
  if (fiyat <= 9_999) return 'Prestij';
  if (fiyat <= 49_999) return 'VIP';
  if (fiyat <= 99_999) return 'Elite';
  return 'Max';
}

export function AjansIndirimliFiyat(listeFiyatTry: number): number {
  const p = Number(listeFiyatTry);
  if (!Number.isFinite(p) || p <= 0) return 0;
  return Math.round(p * (1 - AJANS_COIN_INDIRIM_YUZDE / 100) * 100) / 100;
}

/** Ajans seçilince yenilenen paket listesi */
export function AjansCoinPaketleriniUret(): AjansCoinPaket[] {
  return AJANS_COIN_LISTE_FIYATLARI.map((listeFiyatTry, i) => {
    const coins = TabanCoinHesapla(listeFiyatTry);
    return {
      id: `ajans_try_${listeFiyatTry}`,
      title: paketBaslik(listeFiyatTry),
      listeFiyatTry,
      odenecekTry: AjansIndirimliFiyat(listeFiyatTry),
      coins,
      indirimYuzde: AJANS_COIN_INDIRIM_YUZDE,
    };
  });
}

export function AjansPaketMesajMetni(paket: AjansCoinPaket): string {
  const coinYazi = paket.coins.toLocaleString('tr-TR');
  const liste = paket.listeFiyatTry.toLocaleString('tr-TR');
  const ode = paket.odenecekTry.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return (
    `Merhaba, ${paket.title} paketini almak istiyorum.\n` +
    `${coinYazi} coin · liste ${liste} ₺ · %${paket.indirimYuzde} ajans indirimi ile ${ode} ₺.\n` +
    `Oran: 1 coin = ${COIN_TRY_ORANI.toFixed(2).replace('.', ',')} ₺`
  );
}
