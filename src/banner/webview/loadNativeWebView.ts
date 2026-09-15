import type { ComponentType, RefAttributes } from 'react';
import { NativeModules, TurboModuleRegistry } from 'react-native';

type WebViewProps = Record<string, unknown>;
type NativeWebView = ComponentType<WebViewProps & RefAttributes<unknown>>;

let cached: NativeWebView | null | undefined;

function isWebViewNativePresent(): boolean {
  try {
    if (NativeModules.RNCWebViewModule) return true;
    // get (not getEnforcing) — yoksa null, patlamaz
    return TurboModuleRegistry.get('RNCWebViewModule') != null;
  } catch {
    return false;
  }
}

/**
 * react-native-webview native binary'de yoksa getEnforcing patlar.
 * Önce native var mı bak; yoksa require etme — boot ve HMR güvenli.
 */
export function loadNativeWebView(): NativeWebView | null {
  if (cached !== undefined) return cached;
  if (!isWebViewNativePresent()) {
    cached = null;
    return null;
  }
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
