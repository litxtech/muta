/**
 * Lobby ayri moduldur; ses odasi icine gomulmez.
 */
export type OdaLobisiPublicSozlesmesi = {
  lobiyeGit: (odaId: string) => void;
  odayaKatil: (odaId: string, sifre?: string) => Promise<{ ok: boolean; hata?: string }>;
};

export const ODA_LOBISI_MODUL_ADI = 'oda-lobisi' as const;
