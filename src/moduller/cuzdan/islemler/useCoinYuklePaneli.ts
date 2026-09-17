import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useAuth } from '../../../contexts/AuthContext';
import { useMisafirIslemKapisi } from '../../misafir-hesabi/islemler/useMisafirIslemKapisi';
import { CoinPaketiSatinAl } from '../../iap/islemler/CoinPaketiSatinAl';
import { KillSwitchAktifMiSunucu } from '../../ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { CoinPaketleriniGetir } from '../okuma/CoinPaketleriniGetir';
import { COIN_PAKET_FALLBACK } from '../katalog/CoinPaketFallback';
import { PaketFiyatTry } from '../katalog/CoinPaketFiyat';
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

  const paketleriYenile = useCallback(() => {
    void KillSwitchAktifMiSunucu('kill_coin_purchase').then(setPurchaseLocked);
    CoinPaketleriniGetir()
      .then((data) => {
        if (data.length) setPackages(data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!acik) return;
    paketleriYenile();
  }, [acik, paketleriYenile]);

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
        const fiyatTry = PaketFiyatTry(pkg);
        const kanal =
          Platform.OS === 'ios' || Platform.OS === 'android'
            ? 'App Store / Play'
            : 'Stripe';
        Alert.alert(
          'Coin yükle',
          `${pkg.title}\n${toplam.toLocaleString('tr-TR')} coin\n${fiyatTry.toLocaleString('tr-TR')} ₺\nÖdeme: ${kanal}`,
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Satın al',
              onPress: async () => {
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
                await refreshWallet();
                Alert.alert(
                  'Başarılı',
                  sonuc.coinsAdded != null
                    ? `+${sonuc.coinsAdded} coin`
                    : 'Ödeme tamam',
                );
                setAcik(false);
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
    upgradeAcik,
    upgradeKapat,
    upgradeAc,
    isGuest,
  };
}
