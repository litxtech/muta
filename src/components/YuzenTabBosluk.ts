/**
 * Tab bar ölçüleri — YuzenTabBar / Tabs layout / ekran padding senkron.
 *
 * Tab bar ARTIK absolute değil (in-flow). Ekran scroll padding’i küçük tutulur;
 * mini-bar / çekmece gibi tam ekran overlay’ler toplam yükseklik kullanır.
 */

import { BoslukTokenlari } from '../tasarim-sistemi/BoslukVeYaricapTokenlari';

/** Cam kabuk yüksekliği (safe-area hariç) */
export const YUZEN_TAB_SHELL_H = 64;

/**
 * Tab ekranı scroll alt boşluğu.
 * Tab bar navigator akışında yer kapladığı için büyük overlay payı gerekmez.
 */
export const YUZEN_TAB_ICERIK_BOSLUGU = 20;

/** Gerçek tab bar toplam yüksekliği (kabuk + alt boşluk) — overlay konumları */
export function yuzenTabBarToplamYukseklik(safeBottom: number): number {
  const bottomGap =
    Math.max(safeBottom, BoslukTokenlari.sm) + BoslukTokenlari.xs;
  return YUZEN_TAB_SHELL_H + bottomGap + 6;
}
