export type SehirlerPublicSozlesmesi = {
  sehirDestekle: (input: {
    cityId: string;
    isPrimary?: boolean;
  }) => Promise<{ ok: boolean; hata?: string }>;
};

export const SEHIRLER_MODUL_ADI = 'sehirler' as const;
