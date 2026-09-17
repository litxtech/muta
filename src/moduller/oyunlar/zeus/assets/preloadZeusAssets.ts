/**
 * Zeus — semboller önce; karakter / UI / gökyüzü arka planda.
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

export function zeusVisualsCached(): boolean {
  return visualsReady;
}

/** Oyun seçim modalı açılınca çağır — cold start’ı kısaltır. */
export function warmZeusAssetsEarly(): void {
  void preloadZeusAssets();
}

export async function preloadZeusAssets(
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
        CharacterImages.zeusIdle,
        UiImages.spinButton,
      ]);

      await oyunGorselleriniYukle(symbolIds, (done, total) => {
        onProgress?.(0.75 * (done / Math.max(1, total)));
      });
      visualsReady = true;
      onProgress?.(0.82);

      await oyunGorselleriniYukle(restIds, (done, total) => {
        onProgress?.(0.82 + 0.12 * (done / Math.max(1, total)));
      });
      onProgress?.(1);

      if (!bgCache) {
        bgCache = oyunGorselleriniYukle(
          oyunGorselModulIdleri([
            BackgroundImages.olympusSky,
            UiImages.cover,
          ]),
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
