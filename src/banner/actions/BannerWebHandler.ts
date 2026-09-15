import { Linking, Alert } from 'react-native';
import type { BannerAction } from '../core/BannerTypes';
import {
  openInAppWebView,
  type ActionContext,
} from './BannerActionContext';
import { isSafeHttpsUrl } from '../webview/WebViewSecurity';

export async function handleWebAction(
  action: BannerAction,
  ctx: ActionContext,
): Promise<{ ok: boolean; error?: string }> {
  const url = (action.url ?? action.target ?? '').trim();
  if (!url) return { ok: false, error: 'URL yok' };

  const check = isSafeHttpsUrl(url);
  if (!check.ok) {
    Alert.alert('Güvenlik', check.reason ?? 'Geçersiz URL');
    return { ok: false, error: check.reason };
  }

  // WEB_URL ve IN_APP_WEBVIEW → harici tarayıcı AÇILMAZ
  await openInAppWebView(
    check.url!,
    action.button_text ?? action.payload_json?.title as string | undefined,
    ctx,
  );
  return { ok: true };
}

/** Fallback — sadece güvenlik dışı acil durumlarda (kullanılmıyor varsayılan) */
export async function openExternalBrowser(url: string): Promise<void> {
  const check = isSafeHttpsUrl(url);
  if (!check.ok || !check.url) return;
  await Linking.openURL(check.url);
}
