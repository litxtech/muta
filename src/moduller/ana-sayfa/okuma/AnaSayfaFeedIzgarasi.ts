/**
 * Feed ızgarası — canlı yayın ve ses odası kartları 2'li akışta.
 */

import type { FeedFiltre } from '../bilesenler/AnaSayfaFiltreCipleri';
import type { FeedOggesi } from './AnaSayfaIcerikleriniGetir';

export type FeedIzgaraOgesi = { id: string; tur: 'icerik'; oge: FeedOggesi };

export function feedIzgarasiniKur(
  feed: readonly FeedOggesi[],
  filtre: FeedFiltre,
): FeedIzgaraOgesi[] {
  const out: FeedIzgaraOgesi[] = [];

  for (const oge of feed) {
    if (filtre === 'canli' && oge.tur !== 'canli') continue;
    if (filtre === 'ses' && oge.tur !== 'oda') continue;
    out.push({ id: oge.id, tur: 'icerik', oge });
  }

  return out;
}

/** İlk N kart hafif nabız tutar; gerisi tamamen statik (CPU/GPU) */
export const FEED_AKTIF_ANIMASYON_KART_SAYISI = 2;
