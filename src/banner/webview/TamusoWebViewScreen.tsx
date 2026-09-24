import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TamusoWebViewHeader } from './TamusoWebViewHeader';
import { isSafeHttpsUrl, shouldAllowWebViewNavigation } from './WebViewSecurity';
import { loadNativeWebView } from './loadNativeWebView';
import { openUrlSafely } from './openUrlSafely';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import { Screen } from '../../components/Screen';
import { useCeviri } from '../../i18n/useCeviri';

type NavState = {
  canGoBack: boolean;
  canGoForward: boolean;
  title?: string;
};

export function TamusoWebViewScreen() {
  const { t } = useCeviri();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string; title?: string }>();
  const initialCheck = useMemo(
    () => isSafeHttpsUrl(String(params.url ?? '')),
    [params.url],
  );

  const WebView = useMemo(() => loadNativeWebView(), []);
  const webRef = useRef<{
    goBack: () => void;
    goForward: () => void;
    reload: () => void;
  } | null>(null);
  const [title, setTitle] = useState(String(params.title ?? 'Tamuso'));
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [error, setError] = useState<string | null>(
    initialCheck.ok ? null : initialCheck.reason ?? t('webview.gecersizUrl'),
  );
  const [openingExternal, setOpeningExternal] = useState(false);

  const onNav = useCallback((nav: NavState) => {
    setCanGoBack(nav.canGoBack);
    setCanGoForward(nav.canGoForward);
    if (nav.title) setTitle(nav.title);
  }, []);

  const openExternal = useCallback(
    async (url: string) => {
      setOpeningExternal(true);
      setError(null);
      const sonuc = await openUrlSafely(url);
      setOpeningExternal(false);
      if (sonuc === 'failed') {
        setError(t('webview.baglantiAcilamadi'));
        return;
      }
      if (router.canGoBack()) router.back();
    },
    [t],
  );

  useEffect(() => {
    if (!WebView && initialCheck.ok && initialCheck.url) {
      void openExternal(initialCheck.url);
    }
  }, [WebView, initialCheck.ok, initialCheck.url, openExternal]);

  if (!initialCheck.ok || !initialCheck.url) {
    return (
      <Screen>
        <View style={[styles.errorWrap, { paddingTop: insets.top + 24 }]}>
          <Text style={styles.errorTitle}>{t('webview.sayfaAcilamadi')}</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.errorBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.errorBtnText}>{t('ortak.kapat')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!WebView) {
    return (
      <Screen>
        <View style={[styles.errorWrap, { paddingTop: insets.top + 24 }]}>
          {openingExternal && !error ? (
            <>
              <ActivityIndicator color={RenkTokenlari.primary} />
              <Text style={styles.errorBody}>{t('webview.baglantiAciliyor')}</Text>
            </>
          ) : (
            <>
              <Text style={styles.errorTitle}>{t('webview.webviewYok')}</Text>
              <Text style={styles.errorBody}>
                {error ?? t('webview.webviewYokBody')}
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.errorBtn}
                onPress={() => void openExternal(initialCheck.url!)}
              >
                <Text style={styles.errorBtnText}>{t('webview.disaridaAc')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.errorBtnSecondary}
                onPress={() => {
                  void Linking.openURL(initialCheck.url!).finally(() => {
                    if (router.canGoBack()) router.back();
                  });
                }}
              >
                <Text style={styles.errorBtnSecondaryText}>
                  {t('webview.sistemTarayici')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.errorBtnSecondary}
                onPress={() => router.back()}
              >
                <Text style={styles.errorBtnSecondaryText}>{t('ortak.kapat')}</Text>
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
          <Text style={styles.errorTitle}>{t('webview.yuklemeHatasi')}</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.errorBtn}
            onPress={() => {
              setError(null);
              webRef.current?.reload();
            }}
          >
            <Text style={styles.errorBtnText}>{t('ortak.tekrarDene')}</Text>
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
            setError(e.nativeEvent.description || t('ortak.baglantiHatasi'));
          }}
          onHttpError={() => {
            setLoading(false);
            setError(t('webview.sayfaYuklenemediHttp'));
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
