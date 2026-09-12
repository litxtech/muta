export type SesOdalariPublicSozlesmesi = {
  odayaGit: (odaId: string) => void;
  odaOlusturEkraninaGit: () => void;
};

export const SES_ODALARI_MODUL_ADI = 'ses-odalari' as const;

/** Bu modul ICERMEZ: lobby, hediye, PK, chat, moderasyon, leaderboard business */
export const SES_ODALARI_YASAK_BAGIMLILIKLAR = [
  'oda-lobisi/business',
  'hediyeler/business',
  'pk/business',
  'oda-sohbeti/business',
  'moderasyon/business',
  'liderlik-siralamalari/business',
] as const;
