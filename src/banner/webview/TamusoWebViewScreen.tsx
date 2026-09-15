import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { TamusoWebViewHeader } from './TamusoWebViewHeader';
import { isSafeHttpsUrl, shouldAllowWebViewNavigation } from './WebViewSecurity';
import { loadNativeWebView } from './loadNativeWebView';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import { Screen } from '../../components/Screen';

type NavState = {
  canGoBack: boolean;
  canGoForward: boolean;
  title?: string;
};

export function TamusoWebViewScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string; title?: string }>();
  const initialCheck = useMemo(
    () => isSafeHttpsUrl(String(params.url ?? '')),
    [params.url],
  );

  const WebView = useMemo(() => loadNativeWebView(), []);
  const webRef = useRef<{ goBack: () => void; goForward: () => void; reload: () => void } | null>(
    null,
  );
  const [title, setTitle] = useState(String(params.title ?? 'Tamuso'));
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [error, setError] = useState<string | null>(
    initialCheck.ok ? null : initialCheck.reason ?? 'Geçersiz URL',
  );
  const [browserFallback, setBrowserFallback] = useState(false);

  const onNav = useCallback((nav: NavState) => {
    setCanGoBack(nav.canGoBack);
    setCanGoForward(nav.canGoForward);
    if (nav.title) setTitle(nav.title);
  }, []);

  useEffect(() => {
    if (!WebView && initialCheck.ok && initialCheck.url) {
      setBrowserFallback(true);
      void (async () => {
        try {
          await WebBrowser.openBrowserAsync(initialCheck.url!);
        } catch {
          setError('Tarayıcı açılamadı');
          setBrowserFallback(false);
          return;
        }
        if (router.canGoBack()) router.back();
      })();
    }
  }, [WebView, initialCheck.ok, initialCheck.url]);

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

  if (!WebView) {
    return (
      <Screen>
        <View style={[styles.errorWrap, { paddingTop: insets.top + 24 }]}>
          {browserFallback && !error ? (
            <>
              <ActivityIndicator color={RenkTokenlari.primary} />
              <Text style={styles.errorBody}>Tarayıcıda açılıyor…</Text>
            </>
          ) : (
            <>
              <Text style={styles.errorTitle}>WebView yok</Text>
              <Text style={styles.errorBody}>
                {error ??
                  'Bu development build’de WebView yok. Yeni native build alın veya tarayıcıyı kullanın.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.errorBtn}
                onPress={() => {
                  void WebBrowser.openBrowserAsync(initialCheck.url!).finally(() => {
                    if (router.canGoBack()) router.back();
                  });
                }}
              >
                <Text style={styles.errorBtnText}>Tarayıcıda aç</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.errorBtnSecondary}
                onPress={() => router.back()}
              >
                <Text style={styles.errorBtnSecondaryText}>Kapat</Text>
              </Pressable>
            </>
          )}
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
          onLoadProgress={({ nativeEvent }: { nativeEvent: { progress: number } }) =>
            setProgress(nativeEvent.progress)
          }
          onNavigationStateChange={onNav}
          onShouldStartLoadWithRequest={(req: { url: string }) => {
            if (!shouldAllowWebViewNavigation(req.url)) {
              return false;
            }
            return true;
          }}
          onError={(e: { nativeEvent: { description?: string } }) => {
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
  errorBtnSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  errorBtnSecondaryText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
});

export default TamusoWebViewScreen;
