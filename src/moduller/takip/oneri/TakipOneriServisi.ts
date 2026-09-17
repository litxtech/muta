import { TakipServisi } from '../islemler/TakipServisi';
import type { TakipOnerisi } from '../TakipTipleri';

/** Skor sunucuda hesaplanir; client yalnizca listeler. */
export async function TakipOnerileriniGetir(limit = 12): Promise<TakipOnerisi[]> {
  return TakipServisi.oneriler(limit);
}
