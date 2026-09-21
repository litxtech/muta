import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useAuth } from '../../../contexts/AuthContext';
import { useMisafirIslemKapisi } from '../../misafir-hesabi/islemler/useMisafirIslemKapisi';
import { CoinPaketiSatinAl } from '../../iap/islemler/CoinPaketiSatinAl';
import { KillSwitchAktifMiSunucu } from '../../ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { CoinPaketleriniGetir } from '../okuma/CoinPaketleriniGetir';
import { COIN_PAKET_FALLBACK } from '../katalog/CoinPaketFallback';
import { PaketFiyatYazi } from '../katalog/CoinPaketFiyat';
import {
  MagazaFiyatlariniYukle,
  PaketlereMagazaFiyatiUygula,
} from '../katalog/MagazaFiyatlariniYukle';
import { supabase } from '../../../lib/supabase';
import type { CoinPackage } from '../../../types/models';

/**
 * Oyun / hediye yetersiz bakiyesinde açılan coin yükleme paneli.
 * Wallet sekmesindeki satın alma akışını paylaşır.
 */
export function useCoinYuklePaneli() {
  const { adjustWallet, refreshWallet, isGuest } = useAuth();
  const { upgradeAcik, upgradeKapat, upgradeAc, islemiDene } =
    useMisafirIslemKapisi(isGuest);
  const [acik, setAcik] = useState(false);
  const [packages, setPackages] = useState<CoinPackage[]>(COIN_PAKET_FALLBACK);
  const [purchaseLocked, setPurchaseLocked] = useState(false);
  const magazaYukleniyor = useRef(false);

  /** DB paketleri — mağaza fiyatı yok (IAP yalnız panel açıkken) */
  const paketleriYenile = useCallback(async (magazaFiyat = false) => {
    void KillSwitchAktifMiSunucu('kill_coin_purchase').then(setPurchaseLocked);
    try {
      const data = await CoinPaketleriniGetir();
      if (!data.length) return;
      if (!magazaFiyat) {
        setPackages(data);
        return;
      }
      if (magazaYukleniyor.current) {
        setPackages(data);
        return;
      }
      magazaYukleniyor.current = true;
      try {
        const fiyatlar = await MagazaFiyatlariniYukle(data);
        setPackages(PaketlereMagazaFiyatiUygula(data, fiyatlar));
      } catch {
        setPackages(data);
      } finally {
        magazaYukleniyor.current = false;
      }
    } catch {
      /* fallback kalır */
    }
  }, []);

  // Mount: yalnız katalog — canlı/oda ekranında IAP init etme (çökme riski)
  useEffect(() => {
    void paketleriYenile(false);
  }, [paketleriYenile]);

  // Panel açılınca mağaza fiyatı (native build)
  useEffect(() => {
    if (!acik) return;
    void paketleriYenile(true);
  }, [acik, paketleriYenile]);

  // Admin değişiklikleri — realtime
  useEffect(() => {
    const ch = supabase
      .channel('coin-packages-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coin_packages' },
        () => {
          void paketleriYenile();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [paketleriYenile]);

  const ac = useCallback(() => {
    setAcik(true);
  }, []);

  const kapat = useCallback(() => {
    setAcik(false);
  }, []);

  const satinAl = useCallback(
    (pkg: CoinPackage) => {
      islemiDene('coin_satinal', () => {
        if (purchaseLocked) {
          Alert.alert('Kapalı', 'Coin satın alma geçici olarak durduruldu.');
          return;
        }
        const toplam = pkg.coins + pkg.bonus_coins;
        const fiyatYazi = PaketFiyatYazi(pkg);
        const kanal =
          Platform.OS === 'ios'
            ? 'App Store'
            : Platform.OS === 'android'
              ? 'Google Play'
              : 'Stripe';
        const bonusSatir =
          pkg.bonus_coins > 0
            ? `\n${pkg.coins.toLocaleString('tr-TR')} + ${pkg.bonus_coins.toLocaleString('tr-TR')} bonus`
            : '';
        Alert.alert(
          'Coin yükle',
          `${pkg.title}${bonusSatir}\nToplam ${toplam.toLocaleString('tr-TR')} coin\n${fiyatYazi}\nÖdeme: ${kanal}`,
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Satın al',
              onPress: async () => {
                try {
                  const sonuc = await CoinPaketiSatinAl(pkg);
                  if (!sonuc.ok) {
                    Alert.alert('Satın alma', sonuc.hata);
                    return;
                  }
                  if (sonuc.method === 'stripe' && sonuc.url) {
                    await Linking.openURL(sonuc.url);
                    return;
                  }
                  if (sonuc.coinsAdded != null && sonuc.coinsAdded > 0) {
                    adjustWallet({ coins: sonuc.coinsAdded });
                  }
                  await new Promise((r) => setTimeout(r, 350));
                  try {
                    await refreshWallet();
                  } catch {
                    /* bakiye alert’te yine gösterilir */
                  }
                  Alert.alert(
                    'Başarılı',
                    sonuc.coinsAdded != null
                      ? `+${sonuc.coinsAdded} coin`
                      : 'Ödeme tamam',
                  );
                  setAcik(false);
                } catch (e) {
                  Alert.alert(
                    'Satın alma',
                    e instanceof Error ? e.message : 'Beklenmeyen hata',
                  );
                }
              },
            },
          ],
        );
      });
    },
    [adjustWallet, islemiDene, purchaseLocked, refreshWallet],
  );

  return {
    acik,
    ac,
    kapat,
    packages,
    purchaseLocked,
    satinAl,
    paketleriYenile,
    upgradeAcik,
    upgradeKapat,
    upgradeAc,
    isGuest,
  };
}
