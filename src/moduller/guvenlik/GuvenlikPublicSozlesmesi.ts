export type GuvenlikPublicSozlesmesi = {
  hafifRiskSinyaliGonder: (olay: string, metadata?: Record<string, unknown>) => void;
};

/** Agir risk analizi backend'dedir; mobilde sadece hafif sinyal. */
export const GUVENLIK_MODUL_ADI = 'guvenlik' as const;
