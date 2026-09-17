/**
 * Realm of Storms — semboller önce decode; karakter/UI/bg arka planda.
 * Böylece tahta açılırken simgeler “sonradan” gelmez.
 */

import type { ImageSourcePropType } from 'react-native';
import {
  oyunGorselleriniYukle,
  oyunGorselModulIdleri,
} from '../../ortak/assets/OyunGorselOnYukle';
import {
  BackgroundImages,
  CharacterImages,
  SymbolImages,
  UiImages,
} from './VisualAssets';

let visualCache: Promise<void> | null = null;
let visualsReady = false;
let bgCache: Promise<void> | null = null;

export function kaskadVisualsCached(): boolean {
  return visualsReady;
}

/** Oyun seçim modalı açılınca çağır — cold start’ı kısaltır. */
export function warmKaskadAssetsEarly(): void {
  void preloadKaskadAssets();
}

export async function preloadKaskadAssets(
  onProgress?: (progress01: number) => void,
): Promise<void> {
  if (visualsReady) {
    onProgress?.(1);
    return;
  }
  if (!visualCache) {
    visualCache = (async () => {
      const symbolIds = oyunGorselModulIdleri(
        Object.values(SymbolImages) as ImageSourcePropType[],
      );
      const restIds = oyunGorselModulIdleri([
        CharacterImages.stormKeeper,
        UiImages.spinButton,
      ]);

      await oyunGorselleriniYukle(symbolIds, (done, total) => {
        onProgress?.(0.75 * (done / Math.max(1, total)));
      });
      visualsReady = true;
      onProgress?.(0.82);

      await oyunGorselleriniYukle(restIds, (done, total) => {
        onProgress?.(0.82 + 0.15 * (done / Math.max(1, total)));
      });
      onProgress?.(1);

      if (!bgCache) {
        bgCache = oyunGorselleriniYukle(
          oyunGorselModulIdleri([BackgroundImages.stormSky]),
        ).catch(() => undefined);
      }
    })().catch(() => {
      visualCache = null;
      visualsReady = true;
      onProgress?.(1);
    });
  }
  await visualCache;
  onProgress?.(1);
}
