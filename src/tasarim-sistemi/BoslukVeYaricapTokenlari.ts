import { temaKodunuAl } from './tema/TemaDurumu';

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

const GolgeKoyu = {
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

const GolgeAcik = {
  soft: {
    shadowColor: '#1C1228',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  card: {
    shadowColor: '#1C1228',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;

type GolgeSet = typeof GolgeKoyu;

/** Aktif gorunume gore kart golgesi — acik temada kartlar zeminden ayrilir. */
export const GolgeTokenlari: GolgeSet = new Proxy(GolgeKoyu, {
  get(_hedef, prop: string | symbol) {
    const set = temaKodunuAl() === 'acik' ? GolgeAcik : GolgeKoyu;
    return set[prop as keyof GolgeSet];
  },
}) as GolgeSet;

export const AnimasyonTokenlari = {
  hizli: 160,
  normal: 240,
  yavas: 360,
  giftComboTimeoutMsVarsayilan: 3000,
} as const;
