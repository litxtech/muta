import { Linking } from 'react-native';

/**
 * Native WebView / ExpoWebBrowser yokken sistem tarayıcısı.
 * expo-web-browser import edilmez — eski binary'de native modül hatası olmasın.
 */
export async function openUrlSafely(url: string): Promise<'linking' | 'failed'> {
  try {
    await Linking.openURL(url);
    return 'linking';
  } catch {
    return 'failed';
  }
}
