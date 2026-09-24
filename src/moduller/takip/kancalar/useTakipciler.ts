import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '../../../i18n';
import { TakipAnalitik } from '../analytics/TakipAnalytics';
import { TakipServisi } from '../islemler/TakipServisi';
import type {
  TakipKullaniciKarti,
  TakipListeImleci,
  TakipListeTuru,
} from '../TakipTipleri';

export function useTakipListesi(input: {
  userId: string | null | undefined;
  tur: TakipListeTuru;
}) {
  const [items, setItems] = useState<TakipKullaniciKarti[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [dahaYukleniyor, setDahaYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const cursorRef = useRef<TakipListeImleci | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qRef = useRef('');

  const cek = useCallback(
    async (reset: boolean, q: string) => {
      if (!input.userId) {
        setItems([]);
        setYukleniyor(false);
        return;
      }
      if (reset) {
        cursorRef.current = null;
        setYukleniyor(true);
      } else {
        if (!cursorRef.current) return;
        setDahaYukleniyor(true);
      }
      setHata(null);
      try {
        const page =
          input.tur === 'followers'
            ? await TakipServisi.takipciler({
                userId: input.userId,
                cursor: reset ? null : cursorRef.current,
                query: q,
              })
            : await TakipServisi.takipEdilenler({
                userId: input.userId,
                cursor: reset ? null : cursorRef.current,
                query: q,
              });
        cursorRef.current = page.next_cursor;
        setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
      } catch (e) {
        setHata(e instanceof Error ? e.message : i18n.t('takip.listeYuklenemedi'));
        if (reset) setItems([]);
      } finally {
        setYukleniyor(false);
        setDahaYukleniyor(false);
      }
    },
    [input.tur, input.userId],
  );

  useEffect(() => {
    if (input.tur === 'followers') TakipAnalitik('followers_screen_opened');
    else TakipAnalitik('following_screen_opened');
    void cek(true, '');
  }, [cek, input.tur]);

  const ara = useCallback(
    (text: string) => {
      setQuery(text);
      qRef.current = text;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void cek(true, text.trim());
      }, 300);
    },
    [cek],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const dahaYukle = useCallback(() => {
    if (dahaYukleniyor || yukleniyor || !cursorRef.current) return;
    void cek(false, qRef.current.trim());
  }, [cek, dahaYukleniyor, yukleniyor]);

  const kartGuncelle = useCallback((userId: string, patch: Partial<TakipKullaniciKarti>) => {
    setItems((prev) =>
      prev.map((x) => (x.user_id === userId ? { ...x, ...patch } : x)),
    );
  }, []);

  const kartCikar = useCallback((userId: string) => {
    setItems((prev) => prev.filter((x) => x.user_id !== userId));
  }, []);

  return {
    items,
    yukleniyor,
    dahaYukleniyor,
    hata,
    query,
    ara,
    dahaYukle,
    yenile: () => cek(true, qRef.current.trim()),
    kartGuncelle,
    kartCikar,
    hasMore: !!cursorRef.current,
  };
}

export function useTakipciler(userId: string | null | undefined) {
  return useTakipListesi({ userId, tur: 'followers' });
}

export function useTakipEdilenler(userId: string | null | undefined) {
  return useTakipListesi({ userId, tur: 'following' });
}
