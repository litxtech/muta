import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  PanResponder,
  View,
  type AppStateStatus,
} from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import {
  KULLANIM_IDLE_MS,
  KULLANIM_SYNC_MS,
  KULLANIM_TICK_MS,
} from '../sabitler';
import {
  KullanimYerelGetir,
  KullanimYerelKaydet,
} from '../depolama/KullanimYerelDepolama';
import {
  KullanimSuresiEkle,
  KullanimSuresiGetir,
} from '../islemler/KullanimSuresiIslemleri';
import { KullanimSuresiniFormatla } from '../format/KullanimSuresiniFormatla';
import type { KullanimSuresiPublicSozlesmesi } from '../KullanimSuresiPublicSozlesmesi';

type Ctx = KullanimSuresiPublicSozlesmesi;

const KullanimContext = createContext<Ctx | null>(null);

export function KullanimSuresiSaglayici({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isGuest } = useAuth();
  const userId = user?.id ?? null;

  const [toplamSaniye, setToplamSaniye] = useState(0);
  const [aktifMi, setAktifMi] = useState(false);

  const sunucuToplamRef = useRef(0);
  const bekleyenRef = useRef(0);
  const lastTickRef = useRef(Date.now());
  const lastInteractionRef = useRef(Date.now());
  const appActiveRef = useRef(AppState.currentState === 'active');
  const syncingRef = useRef(false);
  const loadedForRef = useRef<string | null>(null);

  const gorunenToplam = useCallback(
    () => sunucuToplamRef.current + bekleyenRef.current,
    [],
  );

  const kaydetYerel = useCallback(async () => {
    if (!userId) return;
    await KullanimYerelKaydet(userId, {
      sunucuToplam: sunucuToplamRef.current,
      bekleyen: bekleyenRef.current,
    });
  }, [userId]);

  const senkronizeEt = useCallback(async () => {
    if (!userId || isGuest || syncingRef.current) return;
    const delta = bekleyenRef.current;
    if (delta <= 0) return;
    syncingRef.current = true;
    try {
      const r = await KullanimSuresiEkle(delta);
      if (r.ok) {
        bekleyenRef.current = Math.max(0, bekleyenRef.current - delta);
        sunucuToplamRef.current = Math.max(r.total, sunucuToplamRef.current);
        setToplamSaniye(gorunenToplam());
        await kaydetYerel();
      }
    } finally {
      syncingRef.current = false;
    }
  }, [userId, isGuest, gorunenToplam, kaydetYerel]);

  const yenile = useCallback(async () => {
    if (!userId) {
      setToplamSaniye(0);
      return;
    }
    const yerel = await KullanimYerelGetir(userId);
    sunucuToplamRef.current = yerel.sunucuToplam;
    bekleyenRef.current = yerel.bekleyen;
    setToplamSaniye(gorunenToplam());

    if (!isGuest) {
      try {
        const sunucu = await KullanimSuresiGetir(userId);
        if (sunucu > sunucuToplamRef.current) {
          sunucuToplamRef.current = sunucu;
        }
        setToplamSaniye(gorunenToplam());
        await kaydetYerel();
        await senkronizeEt();
      } catch {
        /* offline */
      }
    }
  }, [userId, isGuest, gorunenToplam, kaydetYerel, senkronizeEt]);

  useEffect(() => {
    if (!userId) {
      loadedForRef.current = null;
      sunucuToplamRef.current = 0;
      bekleyenRef.current = 0;
      setToplamSaniye(0);
      setAktifMi(false);
      return;
    }
    if (loadedForRef.current === userId) return;
    loadedForRef.current = userId;
    lastInteractionRef.current = Date.now();
    lastTickRef.current = Date.now();
    void yenile();
  }, [userId, yenile]);

  const sayimAktifMi = useCallback(() => {
    if (!userId) return false;
    if (!appActiveRef.current) return false;
    return Date.now() - lastInteractionRef.current < KULLANIM_IDLE_MS;
  }, [userId]);

  const etkilesim = useCallback(() => {
    lastInteractionRef.current = Date.now();
    if (!aktifMi && sayimAktifMi()) {
      lastTickRef.current = Date.now();
      setAktifMi(true);
    }
  }, [aktifMi, sayimAktifMi]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => {
          etkilesim();
          return false;
        },
        onMoveShouldSetPanResponderCapture: () => {
          etkilesim();
          return false;
        },
      }),
    [etkilesim],
  );

  useEffect(() => {
    const onApp = (state: AppStateStatus) => {
      const wasForeground = appActiveRef.current;
      const wasCounting =
        wasForeground &&
        Date.now() - lastInteractionRef.current < KULLANIM_IDLE_MS;

      appActiveRef.current = state === 'active';

      if (wasForeground && state !== 'active') {
        if (wasCounting) {
          const now = Date.now();
          const elapsed = Math.floor((now - lastTickRef.current) / 1000);
          if (elapsed > 0) {
            bekleyenRef.current += elapsed;
            setToplamSaniye(gorunenToplam());
            void kaydetYerel();
          }
        }
        lastTickRef.current = Date.now();
        setAktifMi(false);
        void senkronizeEt();
        return;
      }

      if (state === 'active') {
        lastTickRef.current = Date.now();
        if (Date.now() - lastInteractionRef.current < KULLANIM_IDLE_MS) {
          setAktifMi(true);
        }
        void yenile();
      }
    };
    const sub = AppState.addEventListener('change', onApp);
    return () => sub.remove();
  }, [gorunenToplam, kaydetYerel, senkronizeEt, yenile]);

  useEffect(() => {
    if (!userId) return;

    const tick = setInterval(() => {
      const now = Date.now();
      const counting = sayimAktifMi();
      setAktifMi(counting);

      if (counting) {
        const elapsed = Math.floor((now - lastTickRef.current) / 1000);
        if (elapsed > 0) {
          bekleyenRef.current += elapsed;
          lastTickRef.current = now;
          setToplamSaniye(gorunenToplam());
          void kaydetYerel();
        }
      } else {
        lastTickRef.current = now;
      }
    }, KULLANIM_TICK_MS);

    const sync = setInterval(() => {
      void senkronizeEt();
    }, KULLANIM_SYNC_MS);

    return () => {
      clearInterval(tick);
      clearInterval(sync);
    };
  }, [userId, sayimAktifMi, gorunenToplam, kaydetYerel, senkronizeEt]);

  const value = useMemo<Ctx>(
    () => ({
      toplamSaniye,
      formatli: KullanimSuresiniFormatla(toplamSaniye),
      formatliKisa: KullanimSuresiniFormatla(toplamSaniye, { kisa: true }),
      aktifMi,
      yenile,
    }),
    [toplamSaniye, aktifMi, yenile],
  );

  return (
    <KullanimContext.Provider value={value}>
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        {children}
      </View>
    </KullanimContext.Provider>
  );
}

export function useKullanimSuresi(): Ctx {
  const ctx = useContext(KullanimContext);
  if (!ctx) {
    return {
      toplamSaniye: 0,
      formatli: '0 dk',
      formatliKisa: '0 sn',
      aktifMi: false,
      yenile: async () => undefined,
    };
  }
  return ctx;
}
