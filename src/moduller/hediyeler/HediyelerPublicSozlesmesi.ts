import type { HediyeGonderSonuc } from './islemler/HediyeGonder';

/**
 * Hediye business logic ses odasina yazilmaz.
 * Ses odasi sadece bu sozlesmeyi kullanir.
 */
export type HediyelerPublicSozlesmesi = {
  hediyeGonder: (params: {
    hediyeId: string;
    aliciId: string;
    odaId?: string;
    adet?: number;
    idempotencyKey?: string;
  }) => Promise<HediyeGonderSonuc>;
};

export const HEDIYELER_MODUL_ADI = 'hediyeler' as const;
