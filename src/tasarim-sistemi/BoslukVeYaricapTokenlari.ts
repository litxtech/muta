export const BoslukTokenlari = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const YaricapTokenlari = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const GolgeTokenlari = {
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

export const AnimasyonTokenlari = {
  hizli: 160,
  normal: 240,
  yavas: 360,
  giftComboTimeoutMsVarsayilan: 3000,
} as const;
