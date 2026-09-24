/**
 * Hamburger / tam ekran overlay açıkken tab bar’ı gizle.
 * Drawer zIndex < tab bar olduğu için overlay altta kalıyordu.
 */

import { DeviceEventEmitter } from 'react-native';

export const TAB_BAR_OVERLAY_EVENT = 'tamuso.tabBarOverlay';

let overlaySayac = 0;

export function tabBarOverlayAc(): void {
  overlaySayac += 1;
  DeviceEventEmitter.emit(TAB_BAR_OVERLAY_EVENT, { acik: overlaySayac > 0 });
}

export function tabBarOverlayKapat(): void {
  overlaySayac = Math.max(0, overlaySayac - 1);
  DeviceEventEmitter.emit(TAB_BAR_OVERLAY_EVENT, { acik: overlaySayac > 0 });
}

export function tabBarOverlaySifirla(): void {
  overlaySayac = 0;
  DeviceEventEmitter.emit(TAB_BAR_OVERLAY_EVENT, { acik: false });
}
