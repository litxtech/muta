/**
 * Gizli WebView köprüsü: base64 görüntüyü canvas'ta çözüp kalite metriklerini
 * döndürür. Web / WebView desteklenmeyen ortamlarda null döner ve akış
 * "unknown" kalite ile devam eder (nihai karar insan incelemesindedir).
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { KALITE_HTML, type KaliteMetrikleri } from './BelgeKalite';

export type GoruntuAnalizHandle = {
  analizEt: (base64: string) => Promise<KaliteMetrikleri | null>;
};

type Bekleyen = {
  resolve: (m: KaliteMetrikleri | null) => void;
  zamanlayici: ReturnType<typeof setTimeout>;
};

const ANALIZ_ZAMAN_ASIMI_MS = 9000;

export const GoruntuAnalizKopru = forwardRef<GoruntuAnalizHandle>(
  function GoruntuAnalizKopru(_props, ref) {
    const webRef = useRef<WebView>(null);
    const bekleyenRef = useRef<Map<string, Bekleyen>>(new Map());
    const [hazir, setHazir] = useState(false);
    const hazirRef = useRef(false);

    useEffect(() => {
      hazirRef.current = hazir;
    }, [hazir]);

    useEffect(() => {
      const mapa = bekleyenRef.current;
      return () => {
        mapa.forEach((b) => clearTimeout(b.zamanlayici));
        mapa.clear();
      };
    }, []);

    const analizEt = useCallback(
      (base64: string): Promise<KaliteMetrikleri | null> => {
        if (Platform.OS === 'web' || !hazirRef.current || !webRef.current) {
          return Promise.resolve(null);
        }
        const id = `a${Date.now()}${Math.floor(Math.random() * 10000)}`;
        const veri = base64.startsWith('data:')
          ? base64
          : `data:image/jpeg;base64,${base64}`;

        return new Promise<KaliteMetrikleri | null>((resolve) => {
          const zamanlayici = setTimeout(() => {
            bekleyenRef.current.delete(id);
            resolve(null);
          }, ANALIZ_ZAMAN_ASIMI_MS);

          bekleyenRef.current.set(id, { resolve, zamanlayici });

          try {
            webRef.current?.postMessage(JSON.stringify({ id, tip: 'analiz', goruntu: veri }));
          } catch {
            clearTimeout(zamanlayici);
            bekleyenRef.current.delete(id);
            resolve(null);
          }
        });
      },
      [],
    );

    useImperativeHandle(ref, () => ({ analizEt }), [analizEt]);

    const mesajGeldi = useCallback((ham: string) => {
      let veri: Record<string, unknown>;
      try {
        veri = JSON.parse(ham) as Record<string, unknown>;
      } catch {
        return;
      }
      if (veri.tip === 'hazir') {
        setHazir(true);
        return;
      }
      const id = typeof veri.id === 'string' ? veri.id : '';
      if (!id) return;
      const bekleyen = bekleyenRef.current.get(id);
      if (!bekleyen) return;
      bekleyenRef.current.delete(id);
      clearTimeout(bekleyen.zamanlayici);
      if (veri.ok && veri.metrikler) {
        bekleyen.resolve(veri.metrikler as KaliteMetrikleri);
      } else {
        bekleyen.resolve(null);
      }
    }, []);

    if (Platform.OS === 'web') return null;

    return (
      <View style={styles.gizli} pointerEvents="none">
        <WebView
          ref={webRef}
          source={{ html: KALITE_HTML }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled={false}
          onMessage={(e) => mesajGeldi(e.nativeEvent.data)}
          onError={() => setHazir(false)}
          style={styles.webview}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  gizli: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -10,
    top: -10,
  },
  webview: { width: 1, height: 1, backgroundColor: 'transparent' },
});
