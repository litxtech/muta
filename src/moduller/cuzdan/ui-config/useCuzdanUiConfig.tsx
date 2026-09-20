import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DEFAULT_CUZDAN_UI_CONFIG } from './CuzdanUiVarsayilan';
import {
  CuzdanUiCanliDinle,
  CuzdanUiCanliGetir,
  CuzdanUiCacheOku,
} from './CuzdanUiServis';
import type { CuzdanUiCanliYanit, CuzdanUiPayload } from './CuzdanUiTipleri';

type Ctx = {
  config: CuzdanUiPayload;
  meta: Omit<CuzdanUiCanliYanit, 'payload' | 'ok'>;
  loading: boolean;
  yenile: () => Promise<void>;
};

const CuzdanUiContext = createContext<Ctx>({
  config: DEFAULT_CUZDAN_UI_CONFIG,
  meta: { source: 'default', version_no: 0 },
  loading: false,
  yenile: async () => undefined,
});

export function CuzdanUiProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<CuzdanUiPayload>(DEFAULT_CUZDAN_UI_CONFIG);
  const [meta, setMeta] = useState<Ctx['meta']>({
    source: 'default',
    version_no: 0,
  });
  const [loading, setLoading] = useState(true);

  const uygula = useCallback((r: CuzdanUiCanliYanit) => {
    setConfig(r.payload);
    setMeta({
      source: r.source,
      version_no: r.version_no,
      version_id: r.version_id,
      published_at: r.published_at,
      label: r.label,
    });
  }, []);

  const yenile = useCallback(async () => {
    const r = await CuzdanUiCanliGetir();
    uygula(r);
  }, [uygula]);

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        const cached = await CuzdanUiCacheOku();
        if (!iptal && cached) uygula(cached);
      } catch {
        /* cache bozuksa default ile devam */
      }
      if (!iptal) setLoading(true);
      try {
        const r = await CuzdanUiCanliGetir();
        if (!iptal) uygula(r);
      } catch {
        /* RPC yoksa varsayılan config */
      } finally {
        if (!iptal) setLoading(false);
      }
    })();
    let unsub: () => void = () => undefined;
    try {
      unsub = CuzdanUiCanliDinle(() => {
        void yenile().catch(() => undefined);
      });
    } catch {
      /* realtime opsiyonel */
    }
    return () => {
      iptal = true;
      unsub();
    };
  }, [uygula, yenile]);

  const value = useMemo(
    () => ({ config, meta, loading, yenile }),
    [config, meta, loading, yenile],
  );

  return (
    <CuzdanUiContext.Provider value={value}>{children}</CuzdanUiContext.Provider>
  );
}

export function useCuzdanUiConfig(): Ctx {
  return useContext(CuzdanUiContext);
}
