export type TemaKodu =
  | 'koyu'
  | 'acik'
  | 'kadife'
  | 'sampanya'
  | 'kozmik'
  | 'zumrut';

export const TEMA_KODLARI: readonly TemaKodu[] = [
  'koyu',
  'acik',
  'kadife',
  'sampanya',
  'kozmik',
  'zumrut',
] as const;

export function temaKoduMu(deger: string | null | undefined): deger is TemaKodu {
  return (
    deger === 'koyu' ||
    deger === 'acik' ||
    deger === 'kadife' ||
    deger === 'sampanya' ||
    deger === 'kozmik' ||
    deger === 'zumrut'
  );
}

export type RenkPaleti = {
  bg: string;
  bgElevated: string;
  bgCard: string;
  bgGlass: string;
  surface: string;
  border: string;
  borderAccent: string;
  borderHot: string;
  text: string;
  textMuted: string;
  textDim: string;
  textOnPrimary: string;
  /** Kapak / media overlay uzerindeki yazi — koyu scrim ustunde acik kalir. */
  textOnOverlay: string;
  primary: string;
  primarySoft: string;
  magenta: string;
  violet: string;
  deepPlum: string;
  accent: string;
  mint: string;
  danger: string;
  success: string;
  warning: string;
  gradientPrimary: readonly [string, string];
  gradientNight: readonly [string, string, string];
  gradientRoom: readonly [string, string, string];
  gradientGold: readonly [string, string];
  gradientDiamond: readonly [string, string];
  gradientCard: readonly [string, string];
  /** Kapak yokken kart zemini */
  gradientPlaceholder: readonly [string, string, string];
  /** Foto/kapak uzerine yazi okunurlugu — her temada koyu scrim */
  overlayGradient: readonly [string, string, string];
  pressFill: string;
  divider: string;
  chipFill: string;
  scrim: string;
  micOn: string;
  micOff: string;
  live: string;
  seatEmpty: string;
  blurTint: 'dark' | 'light' | 'default';
  statusBar: 'light' | 'dark';
  tabBarOverlay: string;
  tabBarFallback: string;
};
