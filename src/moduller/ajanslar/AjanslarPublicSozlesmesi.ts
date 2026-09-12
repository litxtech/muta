export type AjanslarPublicSozlesmesi = {
  basvuruOlustur: (input: {
    agencyName: string;
    country?: string;
  }) => Promise<{ ok: boolean; hata?: string }>;
  coinTransfer: (input: {
    toUserId: string;
    amount: number;
  }) => Promise<{ ok: boolean; hata?: string }>;
};

export const AJANSLAR_MODUL_ADI = 'ajanslar' as const;
