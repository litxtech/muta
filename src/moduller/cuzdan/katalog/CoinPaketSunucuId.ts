import type { CoinPackage } from '../../../types/models';
import { CoinPaketleriniGetir } from '../okuma/CoinPaketleriniGetir';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sunucu RPC/Edge `packageId` alanı `uuid` bekler.
 * Offline fallback paketlerinin id'si "1".."8" olduğu için SKU ile DB kaydını çöz.
 */
export async function SunucuPaketId(pkg: CoinPackage): Promise<string> {
  if (UUID_RE.test(pkg.id)) return pkg.id;
  try {
    const liste = await CoinPaketleriniGetir();
    return liste.find((p) => p.sku === pkg.sku)?.id ?? pkg.id;
  } catch {
    return pkg.id;
  }
}
