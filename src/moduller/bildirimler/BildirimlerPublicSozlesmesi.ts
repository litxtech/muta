export type BildirimlerPublicSozlesmesi = {
  cihazTokeniniKaydet: (token?: string | null) => Promise<{ ok: boolean; hata?: string }>;
};

export const BILDIRIMLER_MODUL_ADI = 'bildirimler' as const;
