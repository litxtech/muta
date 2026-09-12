/**
 * Merkezi marka / urun kimligi.
 * Uygulama adi degisince sadece burasi guncellenir.
 */
export const UygulamaKimligi = {
  APP_NAME: 'Muta',
  APP_SHORT_NAME: 'Muta',
  SUPPORT_EMAIL: 'support@example.com',
  LEGAL_TERMS_URL: 'https://example.com/terms',
  LEGAL_PRIVACY_URL: 'https://example.com/privacy',
  LEGAL_CHILD_SAFETY_URL: 'https://example.com/child-safety',
} as const;

export type UygulamaKimligiAnahtari = keyof typeof UygulamaKimligi;
