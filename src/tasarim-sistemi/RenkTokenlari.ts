/**
 * Design System — renk tokenlari.
 * Ekranlarda rastgele HEX yazilmaz; sadece bu tokenlar kullanilir.
 */
export const RenkTokenlari = {
  bg: '#121018',
  bgElevated: '#1A1624',
  bgCard: '#211C2E',
  bgGlass: 'rgba(33, 28, 46, 0.78)',
  surface: '#2A2438',
  border: 'rgba(255, 255, 255, 0.08)',
  borderAccent: 'rgba(232, 64, 145, 0.4)',
  /** @deprecated borderAccent kullan */
  borderHot: 'rgba(232, 64, 145, 0.4)',

  text: '#F7F2F8',
  textMuted: 'rgba(247, 242, 248, 0.64)',
  textDim: 'rgba(247, 242, 248, 0.4)',

  /** Signature: premium pink / magenta / violet / deep plum */
  primary: '#E84091',
  primarySoft: '#F06BA8',
  magenta: '#C43BFF',
  violet: '#8B5CF6',
  deepPlum: '#3B1F4A',
  accent: '#F0B429',
  mint: '#3DCFB0',

  danger: '#E84B6A',
  success: '#3DCFB0',
  warning: '#F0B429',

  gradientPrimary: ['#E84091', '#C43BFF'] as const,
  gradientNight: ['#121018', '#1A1228', '#2A1838'] as const,
  gradientRoom: ['#2A1428', '#16101F', '#121018'] as const,
  gradientGold: ['#F0B429', '#E87A3B'] as const,
  gradientDiamond: ['#8B5CF6', '#3DCFB0'] as const,

  micOn: '#3DCFB0',
  micOff: 'rgba(247, 242, 248, 0.25)',
  live: '#E84091',
  seatEmpty: 'rgba(255, 255, 255, 0.06)',
} as const;

/** Light Premium (ileride tema degisimi) */
export const RenkTokenlariAcik = {
  bg: '#F6F3F8',
  bgElevated: '#FFFFFF',
  bgCard: '#FFFFFF',
  text: '#1A1224',
  textMuted: 'rgba(26, 18, 36, 0.62)',
  primary: '#E84091',
} as const;
