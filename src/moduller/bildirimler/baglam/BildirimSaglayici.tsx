import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  BildirimOkunmamisSayim,
  BildirimOkunduIsaretle,
  BildirimleriHepsiniOkundu,
} from '../okuma/BildirimKuyrugumuGetir';
import { CihazBildirimRozetiniAyarla } from '../islemler/CihazBildirimRozetiniAyarla';

type BildirimContextValue = {
  okunmamis: number;
  yenile: () => Promise<void>;
  /** Bildirim sayfasina girince: sayac + ikon rozeti sifir */
  sayfayiAcincaOkundu: () => Promise<void>;
  tekOkundu: (id: string) => Promise<void>;
};

const BildirimContext = createContext<BildirimContextValue | null>(null);

export function BildirimSaglayici({ children }: { children: React.ReactNode }) {
  const { session, user } = useAuth();
  const [okunmamis, setOkunmamis] = useState(0);
  const userId = user?.id ?? null;
  const odakli = useRef(true);

  const uygulaSayi = useCallback((n: number) => {
    const v = Math.max(0, Math.floor(n));
    setOkunmamis(v);
    void CihazBildirimRozetiniAyarla(v);
  }, []);

  const yenile = useCallback(async () => {
    if (!session) {
      uygulaSayi(0);
      return;
    }
    try {
      const n = await BildirimOkunmamisSayim();
      uygulaSayi(n);
    } catch {
      // sessiz
    }
  }, [session, uygulaSayi]);

  const sayfayiAcincaOkundu = useCallback(async () => {
    uygulaSayi(0);
    try {
      await BildirimleriHepsiniOkundu();
      await yenile();
    } catch {
      await yenile();
    }
  }, [uygulaSayi, yenile]);

  const tekOkundu = useCallback(
    async (id: string) => {
      try {
        const r = await BildirimOkunduIsaretle(id);
        uygulaSayi(r.unread);
      } catch {
        await yenile();
      }
    },
    [uygulaSayi, yenile],
  );

  useEffect(() => {
    if (!session || !userId) {
      uygulaSayi(0);
      return;
    }
    void yenile();

    const topic = `user-notifications-${userId}`;
    for (const ch of supabase.getChannels()) {
      if (ch.topic === `realtime:${topic}` || ch.topic === topic) {
        void supabase.removeChannel(ch);
      }
    }

    const kanal = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (odakli.current) void yenile();
        },
      )
      .subscribe();

    const onApp = (s: AppStateStatus) => {
      odakli.current = s === 'active';
      if (s === 'active') void yenile();
    };
    const sub = AppState.addEventListener('change', onApp);

    return () => {
      sub.remove();
      void supabase.removeChannel(kanal);
    };
  }, [session, userId, yenile, uygulaSayi]);

  const value = useMemo(
    () => ({
      okunmamis,
      yenile,
      sayfayiAcincaOkundu,
      tekOkundu,
    }),
    [okunmamis, yenile, sayfayiAcincaOkundu, tekOkundu],
  );

  return (
    <BildirimContext.Provider value={value}>{children}</BildirimContext.Provider>
  );
}

export function useBildirimler(): BildirimContextValue {
  const ctx = useContext(BildirimContext);
  if (!ctx) {
    return {
      okunmamis: 0,
      yenile: async () => undefined,
      sayfayiAcincaOkundu: async () => undefined,
      tekOkundu: async () => undefined,
    };
  }
  return ctx;
}
