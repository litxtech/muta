/**
 * Merkezi RTL yardımcıları.
 *
 * Kural: I18nManager.forceRTL(true) sonrası RN flexDirection:'row' zaten
 * start→end aynalar. Üzerine row-reverse EKLEME (çift ayna).
 *
 * left/right/marginLeft fiziksel kalır; start/end mantıksal aynalanır.
 * Chat bubble gibi sender-semantics için fiziksel hizayı kullan.
 */

import { I18nManager, type TextStyle, type ViewStyle } from 'react-native';
import type { UygulamaDili } from './diller';
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type IoniconAdi = ComponentProps<typeof Ionicons>['name'];

/** Dil kodundan RTL mi? (I18nManager’dan bağımsız — intent) */
export function isRtlDil(dil: string | null | undefined): boolean {
  if (!dil) return false;
  return dil.trim().toLowerCase().slice(0, 2) === 'ar';
}

/**
 * Native layout şu an RTL mi?
 * forceRTL + reload sonrası I18nManager.isRTL ile senkron olur.
 */
export function isRtlAktif(): boolean {
  return I18nManager.isRTL === true;
}

/** Semantik satır — forceRTL varken 'row' yeter; row-reverse YASAK */
export function semantikSatir(): ViewStyle {
  return { flexDirection: 'row' };
}

/**
 * Gönderen/alan baloncuk — UI diline göre DEĞİL, fiziksel sağ/sol.
 * RTL’de flex-end sola kaydığı için ters map.
 */
export function fizikselHiza(
  taraf: 'start' | 'end',
): Pick<ViewStyle, 'alignSelf'> {
  const rtl = isRtlAktif();
  if (taraf === 'end') {
    return { alignSelf: rtl ? 'flex-start' : 'flex-end' };
  }
  return { alignSelf: rtl ? 'flex-end' : 'flex-start' };
}

/** Yönlü chevron/ok — sadece navigasyon ikonları */
export function yonluIkon(
  yon: 'back' | 'forward' | 'chevron-back' | 'chevron-forward',
): IoniconAdi {
  const rtl = isRtlAktif();
  switch (yon) {
    case 'back':
      return rtl ? 'arrow-forward' : 'arrow-back';
    case 'forward':
      return rtl ? 'arrow-back' : 'arrow-forward';
    case 'chevron-back':
      return rtl ? 'chevron-forward' : 'chevron-back';
    case 'chevron-forward':
      return rtl ? 'chevron-back' : 'chevron-forward';
    default:
      return 'chevron-forward';
  }
}

/**
 * Arapça UI metni.
 * @param rtl dil intent
 * @param ltrKilitliParent drawer gibi direction:'ltr' kilitliyse true —
 *   forceRTL doğal hizayı vermez; textAlign/writingDirection gerekir.
 */
export function rtlMetinStili(
  rtl?: boolean,
  ltrKilitliParent = false,
): TextStyle | undefined {
  if (!(rtl ?? isRtlAktif())) return undefined;
  if (ltrKilitliParent) {
    return {
      letterSpacing: 0,
      textAlign: 'right',
      writingDirection: 'rtl',
    };
  }
  return { letterSpacing: 0 };
}

/** Email / username / URL — her zaman LTR yazım */
export function ltrAlanStili(): TextStyle {
  return {
    writingDirection: 'ltr',
    textAlign: isRtlAktif() ? 'right' : 'left',
  };
}

/**
 * XP / progress bar — dolgu semantic start kenarından.
 * Drawer gibi direction:'ltr' kilitli parent’ta rtl=true ver.
 */
export function ilerlemeDolguStili(
  yuzde: number,
  rtl?: boolean,
): ViewStyle {
  const pct = Math.min(100, Math.max(0, yuzde));
  const fromEnd = rtl ?? isRtlAktif();
  return {
    width: `${pct}%`,
    alignSelf: fromEnd ? 'flex-end' : 'flex-start',
  };
}
