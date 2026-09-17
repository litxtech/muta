/**
 * Public User ID — immutable, 8 hane, yeniden verilmez.
 * Uretim: DB `yeni_public_kullanici_id()` / signup trigger.
 */
export type KaliciPublicKullaniciId = string;

export const KIMLIK_DOGRULAMA_MODUL_ADI = 'kimlik-dogrulama' as const;

export type KimlikDogrulamaPublicSozlesmesi = {
  emailIleGiris: (email: string, password: string) => Promise<{ error?: string }>;
  emailIleKayit: (input: {
    email?: string;
    phone?: string;
    password: string;
    username: string;
    displayName: string;
    gender?: string;
    birthDate?: string;
    customFields?: Record<string, string>;
  }) => Promise<{ error?: string; needsConfirm?: boolean }>;
  cihazOturumuKaydet: () => Promise<{ error?: string }>;
};
