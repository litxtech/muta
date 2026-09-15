export type AyarlarPublicSozlesmesi = {
  ayarlariGetir: () => Promise<{ pushEnabled: boolean; dil: string }>;
  pushKaydet: (enabled: boolean) => Promise<void>;
};

export const AYARLAR_MODUL_ADI = 'ayarlar' as const;
