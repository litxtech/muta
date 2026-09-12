export type HostlarPublicSozlesmesi = {
  basvuruOlustur: (input: {
    path: 'independent' | 'join_agency';
    inviteCode?: string;
  }) => Promise<{ ok: boolean; hata?: string }>;
  profilimiGetir: () => Promise<unknown | null>;
};

export const HOSTLAR_MODUL_ADI = 'hostlar' as const;
