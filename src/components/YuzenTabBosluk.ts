/**
 * Tab bar ölçüleri — root absolute chrome (Tabs navigator dışında).
 * Oda fullScreenModal Tabs’ı dondursa bile tab bar bozulmaz.
 */

import { Platform } from 'react-native';

/** İkon satırı yüksekliği (safe-area hariç) */
export const YUZEN_TAB_SHELL_H = 50;

/**
 * Android sistem navigasyonu (gesture / 3-tuş) ile tab ikonları çakışmasın.
 * insets.bottom 0 gelirse (edge-to-edge / ölçüm gecikmesi) minimum pay.
 */
export const ANDROID_NAV_MIN_INSET = 24;

/**
 * Tab ekranı scroll alt boşluğu — absolute chrome için kabuk + tipik nav payı.
 * Android’de 3-tuş çubuğu (~48) + ekstra nefes; iOS home indicator payı.
 */
export const YUZEN_TAB_ICERIK_BOSLUGU =
  YUZEN_TAB_SHELL_H + (Platform.OS === 'android' ? 56 : 40);

/** Son bilinen güvenli alt inset */
let sonGuvenliAlt = Platform.OS === 'ios' ? 34 : ANDROID_NAV_MIN_INSET;

export function guvenliTabAltInset(safeBottom: number): number {
  if (safeBottom > 0) {
    sonGuvenliAlt = safeBottom;
    return safeBottom;
  }
  if (Platform.OS === 'ios') {
    return sonGuvenliAlt > 0 ? sonGuvenliAlt : 34;
  }
  // Android: sistem nav ile tab menü üst üste binmesin
  return Math.max(sonGuvenliAlt, ANDROID_NAV_MIN_INSET);
}

/** Toplam tab bar yüksekliği — overlay / mini-bar */
export function yuzenTabBarToplamYukseklik(safeBottom: number): number {
  return YUZEN_TAB_SHELL_H + guvenliTabAltInset(safeBottom);
}
