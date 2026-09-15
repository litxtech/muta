import type { ComponentType, RefAttributes } from 'react';

type WebViewProps = Record<string, unknown>;
type NativeWebView = ComponentType<WebViewProps & RefAttributes<unknown>>;

let cached: NativeWebView | null | undefined;

/**
 * react-native-webview native binary'de yoksa getEnforcing patlar.
 * Üst düzey import yerine lazy require — uygulama boot'unu korur.
 */
export function loadNativeWebView(): NativeWebView | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-webview') as {
      default?: NativeWebView;
      WebView?: NativeWebView;
    };
    cached = mod.default ?? mod.WebView ?? null;
  } catch {
    cached = null;
  }
  return cached;
}
