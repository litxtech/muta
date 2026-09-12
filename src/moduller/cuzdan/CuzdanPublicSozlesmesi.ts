export type CuzdanPublicSozlesmesi = {
  coinBakiyesiniGetir: () => Promise<number>;
  diamondBakiyesiniGetir: () => Promise<number>;
  bakiyeyiYenile: () => Promise<void>;
};

export const CUZDAN_MODUL_ADI = 'cuzdan' as const;
