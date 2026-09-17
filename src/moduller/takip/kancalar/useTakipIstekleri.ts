import { useCallback, useEffect, useState } from 'react';
import { TakipAnalitik } from '../analytics/TakipAnalytics';
import { TakipServisi } from '../islemler/TakipServisi';
import type { TakipKullaniciKarti } from '../TakipTipleri';

export function useTakipIstekleri() {
  const [items, setItems] = useState<TakipKullaniciKarti[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const yenile = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const page = await TakipServisi.istekler();
      setItems(page.items);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
      setItems([]);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    void yenile();
  }, [yenile]);

  const kabul = useCallback(async (requestId: string, userId: string) => {
    const r = await TakipServisi.istekKabul(requestId);
    if (r.ok) {
      TakipAnalitik('follow_request_accepted');
      setItems((prev) => prev.filter((x) => x.user_id !== userId));
    }
    return r;
  }, []);

  const reddet = useCallback(async (requestId: string, userId: string) => {
    const r = await TakipServisi.istekReddet(requestId);
    if (r.ok) {
      TakipAnalitik('follow_request_rejected');
      setItems((prev) => prev.filter((x) => x.user_id !== userId));
    }
    return r;
  }, []);

  return { items, yukleniyor, hata, yenile, kabul, reddet };
}
