/**
 * Merkezi marka / urun kimligi.
 * Uygulama adi degisince sadece burasi guncellenir.
 */
export const UygulamaKimligi = {
  APP_NAME: 'Tamuso',
  APP_SHORT_NAME: 'Tamuso',
  SUPPORT_EMAIL: 'support@litxtech.com',
  LEGAL_TERMS_URL: 'https://litxtech.com/terms',
  LEGAL_PRIVACY_URL: 'https://litxtech.com/privacy',
  LEGAL_CHILD_SAFETY_URL: 'https://litxtech.com/child-safety',
} as const;

export type UygulamaKimligiAnahtari = keyof typeof UygulamaKimligi;
