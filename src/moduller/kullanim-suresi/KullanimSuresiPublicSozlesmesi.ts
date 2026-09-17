export type KullanimSuresiPublicSozlesmesi = {
  toplamSaniye: number;
  formatli: string;
  formatliKisa: string;
  aktifMi: boolean;
  yenile: () => Promise<void>;
};

export const KULLANIM_SURESI_MODUL_ADI = 'kullanim-suresi' as const;
