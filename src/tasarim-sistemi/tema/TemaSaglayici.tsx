import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  kullaniciTemaKodunuAl,
  paletiAl,
  temaKoduMu,
  temayiKur,
  type RenkPaleti,
  type TemaKodu,
} from './TemaDurumu';
import { useTemayaAboneOl } from './useTemayaAboneOl';

export const GORUNUM_DEPO_ANAHTAR = 'ayarlar.gorunum';
export const GORUNUM_SECILDI_ANAHTAR = 'ayarlar.gorunum_secildi';

type TemaBaglam = {
  kod: TemaKodu;
  palet: RenkPaleti;
  hazir: boolean;
  secimGerekli: boolean;
  temayiSec: (kod: TemaKodu) => Promise<void>;
};

const Ctx = createContext<TemaBaglam | null>(null);

export function TemaSaglayici({ children }: { children: React.ReactNode }) {
  useTemayaAboneOl();
  const kod = kullaniciTemaKodunuAl();
  const palet = paletiAl();
  const [hazir, setHazir] = useState(false);
  const [secimGerekli, setSecimGerekli] = useState(false);

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        const kayit = await AsyncStorage.getItem(GORUNUM_DEPO_ANAHTAR);
        if (iptal) return;
        if (temaKoduMu(kayit)) {
          temayiKur(kayit);
        } else {
          // İlk açılış: zorunlu seçim yok — varsayılan koyu
          temayiKur('koyu');
          await Promise.all([
            AsyncStorage.setItem(GORUNUM_DEPO_ANAHTAR, 'koyu'),
            AsyncStorage.setItem(GORUNUM_SECILDI_ANAHTAR, '1'),
          ]);
        }
        setSecimGerekli(false);
      } catch {
        temayiKur('koyu');
        setSecimGerekli(false);
      } finally {
        if (!iptal) setHazir(true);
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palet.bg).catch(() => undefined);
  }, [palet.bg]);

  const temayiSec = useCallback(async (yeni: TemaKodu) => {
    temayiKur(yeni);
    setSecimGerekli(false);
    await Promise.all([
      AsyncStorage.setItem(GORUNUM_DEPO_ANAHTAR, yeni),
      AsyncStorage.setItem(GORUNUM_SECILDI_ANAHTAR, '1'),
    ]);
  }, []);

  const value = useMemo<TemaBaglam>(
    () => ({
      kod,
      palet,
      hazir,
      secimGerekli,
      temayiSec,
    }),
    [kod, palet, hazir, secimGerekli, temayiSec],
  );

  return (
    <Ctx.Provider value={value}>
      <StatusBar style={palet.statusBar} />
      {children}
    </Ctx.Provider>
  );
}

export function useTema(): TemaBaglam {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTema TemaSaglayici icinde kullanilmali');
  return ctx;
}
