/**
 * Oda lobisi ayri moduldur; ses odasi icine gomulmez.
 * Politikalar + katilim `app/lobi/[id].tsx`.
 * Ambient video: `giris-lobisi` (auth giriş ekranı).
 */
export type OdaLobisiPublicSozlesmesi = {
  lobiyeGit: (odaId: string) => void;
  odayaKatil: (odaId: string, sifre?: string) => Promise<{ ok: boolean; hata?: string }>;
};

export const ODA_LOBISI_MODUL_ADI = 'oda-lobisi' as const;

export { LobiPolitikaLinkleri } from './bilesenler/LobiPolitikaLinkleri';
