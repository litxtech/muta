import type {
  UnvanAnimation,
  UnvanBgType,
  UnvanDesign,
  UnvanFontWeight,
  UnvanGlow,
  UnvanGradientDir,
  UnvanIconPosition,
  UnvanIconType,
  UnvanShape,
  UnvanSize,
} from '../tipler';
import {
  UNVAN_ANIMATIONS,
  UNVAN_BG_TYPES,
  UNVAN_FONT_WEIGHTS,
  UNVAN_GLOW,
  UNVAN_GRADIENT_DIRS,
  UNVAN_ICON_POSITIONS,
  UNVAN_ICON_TYPES,
  UNVAN_SHAPES,
  UNVAN_SIZES,
} from '../tipler';

/**
 * Unvan tasarımı doğrulaması.
 *
 * Önceden `zod` şemasıydı; zod v4 web giriş paketine ~760 KB ekliyordu ve bu
 * doğrulama her profil rozetinde çalışıyor. Aynı sözleşme (enum üyelikleri,
 * aralıklar, hex/rgba biçimi, varsayılanlar) burada elle uygulanır.
 */
const HEX_VEYA_RGBA =
  /^(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\))$/;

/** Geçersiz değeri `null` ile bildirir; `undefined` varsayılana düşer. */
type Gecersiz = null;

function secim<T extends readonly string[]>(
  liste: T,
  deger: unknown,
  varsayilan: T[number],
): T[number] | Gecersiz {
  if (deger === undefined) return varsayilan;
  if (typeof deger !== 'string') return null;
  return (liste as readonly string[]).includes(deger)
    ? (deger as T[number])
    : null;
}

function sayi(
  deger: unknown,
  min: number,
  max: number,
  varsayilan: number,
): number | Gecersiz {
  if (deger === undefined) return varsayilan;
  if (typeof deger !== 'number' || !Number.isFinite(deger)) return null;
  if (deger < min || deger > max) return null;
  return deger;
}

function mantik(deger: unknown, varsayilan: boolean): boolean | Gecersiz {
  if (deger === undefined) return varsayilan;
  return typeof deger === 'boolean' ? deger : null;
}

function metin(deger: unknown, varsayilan: string): string | Gecersiz {
  if (deger === undefined) return varsayilan;
  return typeof deger === 'string' ? deger : null;
}

function renkVeyaBos(deger: unknown): string | null | undefined {
  if (deger === undefined || deger === null) return deger;
  if (typeof deger !== 'string' || !HEX_VEYA_RGBA.test(deger)) return undefined;
  return deger;
}

function tasarimCoz(raw: unknown): UnvanDesign | null {
  const kaynak = (raw ?? {}) as Record<string, unknown>;

  const shape = secim<typeof UNVAN_SHAPES>(UNVAN_SHAPES, kaynak.shape, 'SOFT_PILL');
  const backgroundType = secim<typeof UNVAN_BG_TYPES>(
    UNVAN_BG_TYPES,
    kaynak.backgroundType,
    'SOLID',
  );
  const gradientDirection = secim<typeof UNVAN_GRADIENT_DIRS>(
    UNVAN_GRADIENT_DIRS,
    kaynak.gradientDirection,
    'LEFT_RIGHT',
  );
  const glowIntensity = secim<typeof UNVAN_GLOW>(
    UNVAN_GLOW,
    kaynak.glowIntensity,
    'off',
  );
  const animationType = secim<typeof UNVAN_ANIMATIONS>(
    UNVAN_ANIMATIONS,
    kaynak.animationType,
    'NONE',
  );
  const fontWeight = secim<typeof UNVAN_FONT_WEIGHTS>(
    UNVAN_FONT_WEIGHTS,
    kaynak.fontWeight,
    'semibold',
  );
  const iconType = secim<typeof UNVAN_ICON_TYPES>(
    UNVAN_ICON_TYPES,
    kaynak.iconType,
    'library',
  );
  const iconPosition = secim<typeof UNVAN_ICON_POSITIONS>(
    UNVAN_ICON_POSITIONS,
    kaynak.iconPosition,
    'LEFT',
  );
  const size = secim<typeof UNVAN_SIZES>(UNVAN_SIZES, kaynak.size, 'NORMAL');

  const backgroundColor = metin(kaynak.backgroundColor, '#7C3AED');
  const textColor = metin(kaynak.textColor, '#FFFFFF');
  const borderColor = metin(kaynak.borderColor, '#FFFFFF');
  const glowColor = metin(kaynak.glowColor, '#A78BFA');

  const borderEnabled = mantik(kaynak.borderEnabled, false);
  const glowEnabled = mantik(kaynak.glowEnabled, false);

  const borderWidth = sayi(kaynak.borderWidth, 0, 3, 1);
  const borderOpacity = sayi(kaynak.borderOpacity, 0, 1, 1);
  const paddingH = sayi(kaynak.paddingH, 4, 16, 8);
  const paddingV = sayi(kaynak.paddingV, 1, 8, 3);

  const iconValue =
    kaynak.iconValue === undefined
      ? ''
      : typeof kaynak.iconValue === 'string' && kaynak.iconValue.length <= 256
        ? kaynak.iconValue
        : null;

  let cornerRadius: number | null | undefined;
  if (kaynak.cornerRadius === undefined || kaynak.cornerRadius === null) {
    cornerRadius = kaynak.cornerRadius;
  } else if (
    typeof kaynak.cornerRadius === 'number' &&
    Number.isFinite(kaynak.cornerRadius) &&
    kaynak.cornerRadius >= 0 &&
    kaynak.cornerRadius <= 24
  ) {
    cornerRadius = kaynak.cornerRadius;
  } else {
    cornerRadius = undefined;
    // Geçersiz aralık: şema hatası
    return null;
  }

  const backgroundColor2 = renkVeyaBos(kaynak.backgroundColor2);
  const backgroundColor3 = renkVeyaBos(kaynak.backgroundColor3);
  if (backgroundColor2 === undefined) return null;
  if (backgroundColor3 === undefined) return null;

  const alanlar = [
    shape,
    backgroundType,
    gradientDirection,
    glowIntensity,
    animationType,
    fontWeight,
    iconType,
    iconPosition,
    size,
    backgroundColor,
    textColor,
    borderColor,
    glowColor,
    borderEnabled,
    glowEnabled,
    borderWidth,
    borderOpacity,
    paddingH,
    paddingV,
    iconValue,
  ];
  if (alanlar.some((deger) => deger === null)) return null;

  return {
    shape: shape as UnvanShape,
    backgroundType: backgroundType as UnvanBgType,
    backgroundColor: backgroundColor as string,
    backgroundColor2: backgroundColor2 ?? null,
    backgroundColor3: backgroundColor3 ?? null,
    gradientDirection: gradientDirection as UnvanGradientDir,
    textColor: textColor as string,
    borderEnabled: borderEnabled as boolean,
    borderColor: borderColor as string,
    borderWidth: borderWidth as number,
    borderOpacity: borderOpacity as number,
    cornerRadius: cornerRadius ?? null,
    glowEnabled: glowEnabled as boolean,
    glowColor: glowColor as string,
    glowIntensity: glowIntensity as UnvanGlow,
    animationType: animationType as UnvanAnimation,
    fontWeight: fontWeight as UnvanFontWeight,
    iconType: iconType as UnvanIconType,
    iconValue: iconValue as string,
    iconPosition: iconPosition as UnvanIconPosition,
    size: size as UnvanSize,
    paddingH: paddingH as number,
    paddingV: paddingV as number,
  };
}

/** Eski zod API'siyle uyumlu ince sarmalayıcı (dışarıdan kullanım için). */
export const UnvanTasarimZod = {
  safeParse(raw: unknown) {
    const data = tasarimCoz(raw);
    return data
      ? ({ success: true as const, data })
      : ({ success: false as const });
  },
};

export const UNVAN_TASARIM_VARSAYILAN: UnvanDesign = {
  shape: 'SOFT_PILL',
  backgroundType: 'SOLID',
  backgroundColor: '#7C3AED',
  backgroundColor2: null,
  backgroundColor3: null,
  gradientDirection: 'LEFT_RIGHT',
  textColor: '#FFFFFF',
  borderEnabled: false,
  borderColor: '#FFFFFF',
  borderWidth: 1,
  borderOpacity: 1,
  cornerRadius: null,
  glowEnabled: false,
  glowColor: '#A78BFA',
  glowIntensity: 'off',
  animationType: 'NONE',
  fontWeight: 'semibold',
  iconType: 'library',
  iconValue: 'star',
  iconPosition: 'LEFT',
  size: 'NORMAL',
  paddingH: 8,
  paddingV: 3,
};

/** Bozuk server config UI'ı çökertmesin */
export function UnvanTasariminiDogrula(raw: unknown): UnvanDesign {
  const tasarim = tasarimCoz(raw);
  if (!tasarim) return { ...UNVAN_TASARIM_VARSAYILAN };
  return {
    ...tasarim,
    backgroundColor: tasarim.backgroundColor || UNVAN_TASARIM_VARSAYILAN.backgroundColor,
    textColor: tasarim.textColor || '#FFFFFF',
    glowEnabled: tasarim.glowEnabled && tasarim.glowIntensity !== 'off',
  };
}
