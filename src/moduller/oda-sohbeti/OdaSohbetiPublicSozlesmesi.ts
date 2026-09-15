export type OdaSohbetiPublicSozlesmesi = {
  mesajlariGetir: (roomId: string) => Promise<unknown[]>;
  mesajGonder: (input: {
    roomId: string;
    body: string;
  }) => Promise<{ ok: boolean; hata?: string }>;
};

export const ODA_SOHBETI_MODUL_ADI = 'oda-sohbeti' as const;
