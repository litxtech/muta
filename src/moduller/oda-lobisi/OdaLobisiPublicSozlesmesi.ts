/**
 * Lobby ayri moduldur; ses odasi icine gomulmez.
 * Ambient video + politikalar + katilim `app/lobi/[id].tsx`.
 */
export type OdaLobisiPublicSozlesmesi = {
  lobiyeGit: (odaId: string) => void;
  odayaKatil: (odaId: string, sifre?: string) => Promise<{ ok: boolean; hata?: string }>;
};

export const ODA_LOBISI_MODUL_ADI = 'oda-lobisi' as const;

export { LobiArkaPlanVideo } from './bilesenler/LobiArkaPlanVideo';
export { LobiCanliVideoSahne } from './bilesenler/LobiCanliVideoSahne';
export { LobiPolitikaLinkleri } from './bilesenler/LobiPolitikaLinkleri';
export { LOBI_AMBIENT_VIDEOLARI } from './sabitler/LobiAmbientVideolari';
