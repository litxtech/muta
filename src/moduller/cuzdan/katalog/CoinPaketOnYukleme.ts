import { CoinPaketleriniGetir } from '../okuma/CoinPaketleriniGetir';
import { COIN_PAKET_FALLBACK } from './CoinPaketFallback';
import { IapBaglantisiniIsit } from '../../iap/oturum/IapOturum';
import { MagazaFiyatlariniYukle } from './MagazaFiyatlariniYukle';

/** Aynı oturumda art arda odaklanmalarda mağazayı yorma. */
const ARALIK_MS = 60_000;
let sonOnYukleme = 0;

/**
 * Cüzdan açılınca sessizce hazırla: katalog + mağaza fiyatı.
 * Coin yükleme ekranı ayrıca beklerken kartların hazır olmasını sağlar.
 */
export function CoinPaketMagazasiniOnYukle(): void {
  const simdi = Date.now();
  if (simdi - sonOnYukleme < ARALIK_MS) return;
  sonOnYukleme = simdi;

  IapBaglantisiniIsit();
  void (async () => {
    try {
      const paketler = await CoinPaketleriniGetir();
      const hedef = paketler.length > 0 ? paketler : COIN_PAKET_FALLBACK;
      await MagazaFiyatlariniYukle(hedef);
    } catch {
      /* sessiz — ekran kendi akışında tekrar dener */
    }
  })();
}
