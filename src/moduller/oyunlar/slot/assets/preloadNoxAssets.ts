/**
 * NOX REELS — asset ön yükleme.
 */

import { Image } from 'react-native';
import { Asset } from 'expo-asset';
import {
  ALL_SYMBOL_SOURCES,
  BackgroundImages,
  UiImages,
} from './VisualAssets';

export async function preloadNoxAssets(): Promise<void> {
  const sources = [
    ...ALL_SYMBOL_SOURCES,
    BackgroundImages.nightSky,
    UiImages.spinButton,
    UiImages.cover,
  ];
  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | void> =>
    Promise.race([
      p,
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
    ]);

  try {
    await withTimeout(Asset.loadAsync(sources as number[]), 900);
  } catch {
    /* native preload opsiyonel */
  }
  try {
    await withTimeout(
      Promise.all(
        sources.map(
          (s) =>
            new Promise<void>((resolve) => {
              const uri = Image.resolveAssetSource(s as number)?.uri;
              if (!uri) {
                resolve();
                return;
              }
              Image.prefetch(uri).finally(() => resolve());
            }),
        ),
      ),
      900,
    );
  } catch {
    /* prefetch opsiyonel */
  }
}

/** Modal açılınca ısıt — ana ekran mount’ta bekleme azalır */
let warmStarted = false;
export function warmNoxAssetsEarly(): void {
  if (warmStarted) return;
  warmStarted = true;
  void preloadNoxAssets();
  void import('../ses/SlotSesYoneticisi').then((m) => {
    void m.preloadSlotAudio();
  });
}
