/**
 * Tab bar güvenlik kilidi — mount/ölçü bozulmalarını engeller.
 *
 * - Genişlik: 0 gelirse son geçerli değer
 * - AppState active: dinleyicilere “yeniden senkron” sinyali
 * - Tabs bir kez mount olduysa auth flicker’da unmount edilmesin
 */

import { AppState, Dimensions, type NativeEventSubscription } from 'react-native';

type SyncDinleyici = () => void;

let sonGenislik = Math.max(Dimensions.get('window').width, 0) || 390;
let tabsBirKezMount = false;
const syncDinleyiciler = new Set<SyncDinleyici>();
let appStateSub: NativeEventSubscription | null = null;
let dimSub: { remove: () => void } | null = null;
let kurulu = false;

function genisligiGuncelle(w: number) {
  if (w > 0) sonGenislik = w;
}

function syncYayinla() {
  syncDinleyiciler.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/** Uygulama ömrü boyunca bir kez dinle */
export function TabBarGuvenlikKur(): void {
  if (kurulu) return;
  kurulu = true;

  genisligiGuncelle(Dimensions.get('window').width);

  appStateSub = AppState.addEventListener('change', (s) => {
    if (s === 'active') {
      genisligiGuncelle(Dimensions.get('window').width);
      syncYayinla();
    }
  });

  dimSub = Dimensions.addEventListener('change', ({ window }) => {
    genisligiGuncelle(window.width);
    syncYayinla();
  });
}

export function TabBarGuvenlikKaldir(): void {
  appStateSub?.remove();
  appStateSub = null;
  dimSub?.remove();
  dimSub = null;
  kurulu = false;
  syncDinleyiciler.clear();
}

/** Resume / boyut değişince tab bar yeniden senkron etsin */
export function TabBarSyncDinle(fn: SyncDinleyici): () => void {
  TabBarGuvenlikKur();
  syncDinleyiciler.add(fn);
  return () => {
    syncDinleyiciler.delete(fn);
  };
}

export function TabBarGuvenliGenislik(anlik?: number): number {
  if (typeof anlik === 'number' && anlik > 0) {
    sonGenislik = anlik;
  }
  return sonGenislik > 0 ? sonGenislik : 390;
}

/** Tabs bir kez oturumla açıldıysa auth null flicker’da sökülmesin */
export function TabsMountIsaretle(): void {
  tabsBirKezMount = true;
}

export function TabsBirKezMountMu(): boolean {
  return tabsBirKezMount;
}

/** Manuel çıkışta sıfırla — bir sonraki login temiz başlar */
export function TabsMountSifirla(): void {
  tabsBirKezMount = false;
}

export const TAB_BAR_Z_INDEX = 200;
export const TAB_BAR_ELEVATION = 200;
