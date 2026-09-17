import { Linking, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import type { BannerAction } from '../core/BannerTypes';
import { handleInternalLink } from './BannerInternalLinkHandler';
import { handleWebAction } from './BannerWebHandler';
import { handleWhatsApp } from './BannerWhatsAppHandler';
import { handleInstagram } from './BannerInstagramHandler';
import { handleExternalApp } from './BannerExternalAppHandler';
import type { ActionContext } from './BannerActionContext';

export type { ActionContext } from './BannerActionContext';
export { openInAppWebView } from './BannerActionContext';

/** Route isimleri DB'ye gömülü değil — mapping burada */
const INTERNAL_SCREEN_MAP: Record<string, string> = {
  home: '/(tabs)',
  feed: '/(tabs)',
  discover: '/kesfet',
  kesfet: '/kesfet',
  messages: '/(tabs)/messages',
  profile: '/(tabs)/profile',
  rooms: '/(tabs)/rooms',
  settings: '/ayarlar',
  market: '/platform',
  live: '/canli',
  platform: '/platform',
  notifications: '/bildirimler',
  rankings: '/siralamalar',
  agency: '/ajans',
};

export async function routeBannerAction(
  action: BannerAction,
  ctx: ActionContext,
): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (action.action_type) {
      case 'NONE':
        return { ok: true };

      case 'INTERNAL_SCREEN': {
        const raw = (action.target ?? '').trim();
        if (!raw) return { ok: false, error: 'Hedef ekran yok' };
        // `/oyun/zeus` gibi absolute path'ler doğrudan
        if (raw.startsWith('/')) {
          router.push(raw as never);
          return { ok: true };
        }
        const key = raw.toLowerCase();
        const path = INTERNAL_SCREEN_MAP[key];
        if (!path) return { ok: false, error: 'Hedef ekran yok' };
        router.push(path as never);
        return { ok: true };
      }

      case 'INTERNAL_PROFILE':
      case 'INTERNAL_ROOM':
      case 'INTERNAL_GAME':
      case 'INTERNAL_POST':
      case 'INTERNAL_LIVE':
        return handleInternalLink(action.action_type, action.target);

      case 'WEB_URL':
      case 'IN_APP_WEBVIEW':
        return handleWebAction(action, ctx);

      case 'WHATSAPP':
        return handleWhatsApp(action);

      case 'INSTAGRAM':
        return handleInstagram(action, ctx);

      case 'EXTERNAL_APP':
        return handleExternalApp(action);

      case 'CUSTOM_DEEP_LINK': {
        const url = action.url ?? action.target;
        if (!url) return { ok: false, error: 'Deep link yok' };
        if (url.startsWith('tamuso://') || url.startsWith('muta://')) {
          return handleInternalLink('CUSTOM_DEEP_LINK', url);
        }
        const can = await Linking.canOpenURL(url);
        if (!can) {
          Alert.alert('Açılamadı', 'Bu bağlantı desteklenmiyor.');
          return { ok: false, error: 'cannot_open' };
        }
        await Linking.openURL(url);
        return { ok: true };
      }

      default:
        return { ok: false, error: 'Bilinmeyen action' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Action hatası';
    if (Platform.OS !== 'web') {
      Alert.alert('Hata', msg);
    }
    return { ok: false, error: msg };
  }
}
