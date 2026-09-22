/**
 * Ana sayfa keşif araması — kullanıcı + ajans (harf harf öneri).
 * Mevcut RPC'ler: kullanici_ara, takas_ajans_ara
 */

import { KullanicilariAra, type ArananKullanici } from '../../mesajlasma/okuma/KullanicilariAra';
import {
  TakasAjansAra,
  type TakasAjansSatir,
} from '../../cuzdan/takas/CuzdanTakasIslemleri';

export type KesfetAramaKullanici = ArananKullanici;
export type KesfetAramaAjans = TakasAjansSatir;

export type AnaSayfaKesfetAramaSonuc = {
  kullanicilar: KesfetAramaKullanici[];
  ajanslar: KesfetAramaAjans[];
};

function metinHazirla(ham: string): string {
  return ham
    .trim()
    .replace(/[%_,]/g, '')
    .slice(0, 40);
}

/** İlk harften itibaren paralel kullanıcı + ajans önerisi */
export async function AnaSayfaKesfetAra(input: {
  sorgu: string;
  haricUserId?: string | null;
  kullaniciLimit?: number;
  ajansLimit?: number;
}): Promise<AnaSayfaKesfetAramaSonuc> {
  const q = metinHazirla(input.sorgu);
  if (q.length < 1) {
    return { kullanicilar: [], ajanslar: [] };
  }

  const [kullanicilar, ajanslarHam] = await Promise.all([
    KullanicilariAra({
      sorgu: q,
      haricUserId: input.haricUserId,
      limit: input.kullaniciLimit ?? 8,
    }).catch(() => [] as KesfetAramaKullanici[]),
    TakasAjansAra(q).catch(() => [] as KesfetAramaAjans[]),
  ]);

  const ajansLimit = input.ajansLimit ?? 6;
  const qLower = q.toLocaleLowerCase('tr');
  // Prefix öncelikli sıralama (harf harf his)
  const ajanslar = [...ajanslarHam]
    .sort((a, b) => {
      const an = (a.name ?? '').toLocaleLowerCase('tr');
      const bn = (b.name ?? '').toLocaleLowerCase('tr');
      const aPref = an.startsWith(qLower) ? 0 : 1;
      const bPref = bn.startsWith(qLower) ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
      return an.localeCompare(bn, 'tr');
    })
    .slice(0, ajansLimit);

  return { kullanicilar, ajanslar };
}
