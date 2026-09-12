export type MisafirHesabiPublicSozlesmesi = {
  misafirOlarakDevamEt: () => Promise<{ ok: boolean; hata?: string }>;
  hesabiTamamlaKartiniGoster: () => void;
};

export const MISAFIR_HESABI_MODUL_ADI = 'misafir-hesabi' as const;
