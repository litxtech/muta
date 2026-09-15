import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RNWebView from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { TamusoWebViewHeader } from './TamusoWebViewHeader';
import { isSafeHttpsUrl, shouldAllowWebViewNavigation } from './WebViewSecurity';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import { Screen } from '../../components/Screen';

/** React 19 + RN WebView tip uyumsuzluğu — runtime OK */
const WebView = RNWebView as unknown as React.ComponentType<{
  ref?: React.Ref<WebViewHandle>;
  source: { uri: string };
  style?: object;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onLoadProgress?: (e: { nativeEvent: { progress: number } }) => void;
  onNavigationStateChange?: (nav: WebViewNavigation) => void;
  onShouldStartLoadWithRequest?: (req: { url: string }) => boolean;
  onError?: (e: { nativeEvent: { description?: string } }) => void;
  onHttpError?: () => void;
  setSupportMultipleWindows?: boolean;
  allowsBackForwardNavigationGestures?: boolean;
  startInLoadingState?: boolean;
  renderLoading?: () => React.ReactElement;
}>;

type WebViewHandle = {
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
};

export function TamusoWebViewScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string; title?: string }>();
  const initialCheck = useMemo(
    () => isSafeHttpsUrl(String(params.url ?? '')),
    [params.url],
  );

  const webRef = useRef<WebViewHandle | null>(null);
  const [title, setTitle] = useState(String(params.title ?? 'Tamuso'));
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [error, setError] = useState<string | null>(
    initialCheck.ok ? null : initialCheck.reason ?? 'Geçersiz URL',
  );

  const onNav = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    setCanGoForward(nav.canGoForward);
    if (nav.title) setTitle(nav.title);
  }, []);

  if (!initialCheck.ok || !initialCheck.url) {
    return (
      <Screen>
        <View style={[styles.errorWrap, { paddingTop: insets.top + 24 }]}>
          <Text style={styles.errorTitle}>Sayfa açılamadı</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.errorBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.errorBtnText}>Kapat</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <TamusoWebViewHeader
        title={title}
        loading={loading}
        progress={progress}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={() => webRef.current?.goBack()}
        onForward={() => webRef.current?.goForward()}
        onReload={() => {
          setError(null);
          webRef.current?.reload();
        }}
        onClose={() => router.back()}
      />

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Yükleme hatası</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.errorBtn}
            onPress={() => {
              setError(null);
              webRef.current?.reload();
            }}
          >
            <Text style={styles.errorBtnText}>Yeniden dene</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: initialCheck.url }}
          style={styles.web}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
          onNavigationStateChange={onNav}
          onShouldStartLoadWithRequest={(req) =>
            shouldAllowWebViewNavigation(req.url)
          }
          onError={(e) => {
            setLoading(false);
            setError(e.nativeEvent.description || 'Bağlantı hatası');
          }}
          onHttpError={() => {
            setLoading(false);
            setError('Sayfa yüklenemedi (HTTP hata)');
          }}
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={RenkTokenlari.primary} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: RenkTokenlari.bg,
  },
  web: {
    flex: 1,
    backgroundColor: RenkTokenlari.bg,
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.bg,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
  },
  errorBody: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
  errorBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: RenkTokenlari.primary,
  },
  errorBtnText: {
    ...TipografiTokenlari.caption,
    color: '#fff',
    fontWeight: '700',
  },
});

export default TamusoWebViewScreen;
