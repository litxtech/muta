/**
 * Sohbet ekranı için debounce'lu taslak autosave + hydrate + flush.
 * Draft asla otomatik gönderilmez; yalnızca input'a restore edilir.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  MesajTaslakBosMu,
  MesajTaslakGetir,
  MesajTaslakKaydet,
  MesajTaslakSenkronGetir,
  MesajTaslakSil,
} from './MesajTaslakDepolama';

export const MESAJ_TASLAK_DEBOUNCE_MS = 350;

type Args = {
  userId: string | undefined;
  conversationId: string | undefined;
  /** Engelli / kapalı composer — hydrate etme, autosave durdur */
  pasifMi?: boolean;
};

export type UseMesajTaslakSonuc = {
  metin: string;
  setMetin: (text: string) => void;
  /** İlk hydrate bitti — flash önlemek için TextInput'u buna bağla */
  taslakHazir: boolean;
  /** Send'e basınca: UI boşalsın, draft korunur */
  gonderimBasladi: (body: string) => void;
  /** Send fail: metni input'a geri koy */
  gonderimBasarisiz: (body: string) => void;
  /** Send success: draft sil */
  gonderimBasarili: () => Promise<void>;
  /** Kritik anlarda (blur / unmount / background) anında yaz */
  taslakFlush: () => void;
};

export function useMesajTaslak({
  userId,
  conversationId,
  pasifMi = false,
}: Args): UseMesajTaslakSonuc {
  const [metin, setMetinState] = useState('');
  const [taslakHazir, setTaslakHazir] = useState(false);

  const metinRef = useRef(metin);
  metinRef.current = metin;

  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const convRef = useRef(conversationId);
  convRef.current = conversationId;
  const pasifRef = useRef(pasifMi);
  pasifRef.current = pasifMi;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Eski debounce write'ın yeni taslağın üstüne yazmasını engelle */
  const yazimNesilRef = useRef(0);
  /** Gönderim sırasında boş metin autosave ile draft silmesin */
  const gonderimKilidiRef = useRef(false);
  const hydrateNesilRef = useRef(0);

  const iptalDebounce = useCallback(() => {
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const diskeYaz = useCallback((uid: string, cid: string, text: string, nesil: number) => {
    if (gonderimKilidiRef.current) return;
    if (nesil !== yazimNesilRef.current) return;
    if (uid !== userIdRef.current || cid !== convRef.current) return;
    void MesajTaslakKaydet(uid, cid, text);
  }, []);

  const scheduleKaydet = useCallback(
    (text: string) => {
      const uid = userIdRef.current;
      const cid = convRef.current;
      if (!uid || !cid || pasifRef.current) return;
      if (gonderimKilidiRef.current) return;

      iptalDebounce();
      const nesil = ++yazimNesilRef.current;
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        diskeYaz(uid, cid, text, nesil);
      }, MESAJ_TASLAK_DEBOUNCE_MS);
    },
    [diskeYaz, iptalDebounce],
  );

  const taslakFlush = useCallback(() => {
    const uid = userIdRef.current;
    const cid = convRef.current;
    if (!uid || !cid || pasifRef.current) {
      iptalDebounce();
      return;
    }
    if (gonderimKilidiRef.current) {
      iptalDebounce();
      return;
    }
    iptalDebounce();
    const nesil = ++yazimNesilRef.current;
    diskeYaz(uid, cid, metinRef.current, nesil);
  }, [diskeYaz, iptalDebounce]);

  const setMetin = useCallback(
    (text: string) => {
      setMetinState(text);
      metinRef.current = text;
      scheduleKaydet(text);
    },
    [scheduleKaydet],
  );

  const gonderimBasladi = useCallback(
    (body: string) => {
      gonderimKilidiRef.current = true;
      iptalDebounce();
      yazimNesilRef.current += 1;
      setMetinState('');
      metinRef.current = '';
      const uid = userIdRef.current;
      const cid = convRef.current;
      if (uid && cid && !MesajTaslakBosMu(body)) {
        void MesajTaslakKaydet(uid, cid, body);
      }
    },
    [iptalDebounce],
  );

  const gonderimBasarisiz = useCallback((body: string) => {
    gonderimKilidiRef.current = false;
    setMetinState(body);
    metinRef.current = body;
  }, []);

  const gonderimBasarili = useCallback(async () => {
    const uid = userIdRef.current;
    const cid = convRef.current;
    gonderimKilidiRef.current = false;
    iptalDebounce();
    yazimNesilRef.current += 1;
    setMetinState('');
    metinRef.current = '';
    if (uid && cid) await MesajTaslakSil(uid, cid);
  }, [iptalDebounce]);

  // Conversation / user değişince hydrate
  useEffect(() => {
    iptalDebounce();
    gonderimKilidiRef.current = false;

    if (!userId || !conversationId || pasifMi) {
      setMetinState('');
      metinRef.current = '';
      setTaslakHazir(true);
      return;
    }

    const nesil = ++hydrateNesilRef.current;
    setTaslakHazir(false);

    const sync = MesajTaslakSenkronGetir(userId, conversationId);
    if (sync !== undefined) {
      if (nesil === hydrateNesilRef.current) {
        setMetinState(sync);
        metinRef.current = sync;
        setTaslakHazir(true);
      }
      return;
    }

    let iptal = false;
    void MesajTaslakGetir(userId, conversationId).then((text) => {
      if (iptal || nesil !== hydrateNesilRef.current) return;
      setMetinState(text);
      metinRef.current = text;
      setTaslakHazir(true);
    });

    return () => {
      iptal = true;
    };
  }, [userId, conversationId, pasifMi, iptalDebounce]);

  // Unmount / conversation değişiminde önceki conversation'ı flush et
  useEffect(() => {
    const uid = userId;
    const cid = conversationId;
    return () => {
      if (!uid || !cid || pasifMi) return;
      if (gonderimKilidiRef.current) return;
      iptalDebounce();
      void MesajTaslakKaydet(uid, cid, metinRef.current);
    };
  }, [userId, conversationId, pasifMi, iptalDebounce]);

  // App background
  useEffect(() => {
    const onApp = (s: AppStateStatus) => {
      if (s === 'background' || s === 'inactive') {
        taslakFlush();
      }
    };
    const sub = AppState.addEventListener('change', onApp);
    return () => sub.remove();
  }, [taslakFlush]);

  return {
    metin,
    setMetin,
    taslakHazir,
    gonderimBasladi,
    gonderimBasarisiz,
    gonderimBasarili,
    taslakFlush,
  };
}
