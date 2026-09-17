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
  try {
    await Asset.loadAsync(sources as number[]);
  } catch {
    /* native preload opsiyonel */
  }
  try {
    await Promise.all(
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
    );
  } catch {
    /* prefetch opsiyonel */
  }
}
