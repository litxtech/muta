export type VarlikYonetimiPublicSozlesmesi = {
  katalogGetir: () => unknown[];
  urlCoz: (code: string) => string | null;
};

export const VARLIK_YONETIMI_MODUL_ADI = 'varlik-yonetimi' as const;
