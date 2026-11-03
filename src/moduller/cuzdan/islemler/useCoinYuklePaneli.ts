import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth, useWallet } from '../../../contexts/AuthContext';
import { useCeviri } from '../../../i18n/useCeviri';
import { DIL_LOCALE_MAP } from '../../../i18n/diller';
import { useMisafirIslemKapisi } from '../../misafir-hesabi/islemler/useMisafirIslemKapisi';
import { CoinPaketiSatinAl } from '../../iap/islemler/CoinPaketiSatinAl';
import { IapBaglantisiniIsit } from '../../iap/oturum/IapOturum';
import { KillSwitchAktifMiSunucu } from '../../ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { CoinPaketleriniGetir } from '../okuma/CoinPaketleriniGetir';
import { CoinPaketleriAnlikGorunum } from '../katalog/CoinPaketOnbellegi';
import { PaketFiyatiGosterilebilir, PaketFiyatYazi } from '../katalog/CoinPaketFiyat';
import {
  MagazaFiyatAnlikHaritasi,
  MagazaFiyatDeposunuHazirla,
  MagazaFiyatlariniYukle,
  PaketlereMagazaFiyatiUygula,
} from '../katalog/MagazaFiyatlariniYukle';
import { supabase } from '../../../lib/supabase';
import type { CoinPackage } from '../../../types/models';

const COIN_PAKET_KANAL_IMZA = 'coin-packages-live';

function ayniCoinPaketKanaliniTemizle() {
  for (const ch of supabase.getChannels()) {
    const topic = ch.topic ?? '';
    if (
      topic === COIN_PAKET_KANAL_IMZA ||
      topic === `realtime:${COIN_PAKET_KANAL_IMZA}` ||
      topic.includes(COIN_PAKET_KANAL_IMZA)
    ) {
      void supabase.removeChannel(ch);
    }
  }
}

/**
 * Oyun / hediye yetersiz bakiyesinde açılan coin yükleme paneli.
 * Wallet sekmesindeki satın alma akışını paylaşır.
 */
export function useCoinYuklePaneli() {
  const { t, dil } = useCeviri();
  const loc = DIL_LOCALE_MAP[dil];
  const { isGuest } = useAuth();
  const { adjustWallet, refreshWallet } = useWallet();
  const { upgradeAcik, upgradeKapat, upgradeAc, islemiDene } =
    useMisafirIslemKapisi(isGuest);
  const [acik, setAcik] = useState(false);
  const [packages, setPackages] = useState<CoinPackage[]>(
    CoinPaketleriAnlikGorunum,
  );
  const [purchaseLocked, setPurchaseLocked] = useState(false);
  const [yenileniyor, setYenileniyor] = useState(false);
  const magazaYukleniyor = useRef(false);
  const istekRef = useRef(0);

  /** DB paketleri — mağaza fiyatı yok (IAP yalnız panel açıkken) */
  const paketleriYenile = useCallback(async (magazaFiyat = true) => {
    const istek = ++istekRef.current;
    const gecerli = () => istek === istekRef.current;

    void KillSwitchAktifMiSunucu('kill_coin_purchase').then((v) => {
      if (gecerli()) setPurchaseLocked(v);
    });

    try {
      if (!magazaFiyat) {
        const data = await CoinPaketleriniGetir();
        if (data.length && gecerli()) setPackages(data);
        return;
      }

      // Disk: katalog + son bilinen mağaza fiyatı → panel anında dolu görünür.
      await Promise.all([
        MagazaFiyatDeposunuHazirla(),
        CoinPaketleriniGetir().catch(() => null),
      ]);
      if (!gecerli()) return;
      const diskFiyat = MagazaFiyatAnlikHaritasi();
      if (diskFiyat) {
        setPackages((onceki) => PaketlereMagazaFiyatiUygula(onceki, diskFiyat));
      }

      if (magazaYukleniyor.current) return;
      magazaYukleniyor.current = true;
      setYenileniyor(true);
      try {
        const data = await CoinPaketleriniGetir();
        if (!gecerli()) return;
        const taban =
          data.length > 0 ? data : CoinPaketleriAnlikGorunum();
        if (data.length > 0) setPackages(taban);
        const fiyatlar = await MagazaFiyatlariniYukle(taban);
        if (!gecerli()) return;
        if (Object.keys(fiyatlar).length) {
          setPackages((onceki) => PaketlereMagazaFiyatiUygula(onceki, fiyatlar));
        }
      } finally {
        magazaYukleniyor.current = false;
        if (gecerli()) setYenileniyor(false);
      }
    } catch {
      /* fallback / disk verisi kalır */
    }
  }, []);

  // Mount: yalnız katalog — canlı/oda ekranında IAP init etme (çökme riski)
  useEffect(() => {
    void paketleriYenile(false);
  }, [paketleriYenile]);

  // Panel açılınca mağaza fiyatı + IAP ısıt (native build)
  useEffect(() => {
    if (!acik) return;
    IapBaglantisiniIsit();
    void paketleriYenile(true);
  }, [acik, paketleriYenile]);

  // Admin değişiklikleri — realtime
  // Sabit topic + Strict Mode / çoklu mount → "after subscribe()" hatası;
  // önce temizle, benzersiz topic kullan.
  useEffect(() => {
    ayniCoinPaketKanaliniTemizle();
    const topic = `${COIN_PAKET_KANAL_IMZA}-${Date.now().toString(36)}`;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(topic)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'coin_packages' },
          () => {
            // Yalnız katalog — canlı/oda ekranında mağaza bağlantısı açılmasın.
            void paketleriYenile(false);
          },
        )
        .subscribe();
    } catch {
      ch = null;
    }
    return () => {
      if (ch) void supabase.removeChannel(ch);
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
          Alert.alert(
            t('cuzdanX.kapali'),
            t('cuzdanX.satinAlmaDurduruldu'),
          );
          return;
        }
        if (!PaketFiyatiGosterilebilir(pkg)) {
          Alert.alert(t('cuzdanX.satinAlma'), t('cuzdanX.fiyatBekle'));
          return;
        }
        const toplam = pkg.coins + pkg.bonus_coins;
        const fiyatYazi = PaketFiyatYazi(pkg);
        const kanal =
          Platform.OS === 'ios'
            ? 'App Store'
            : Platform.OS === 'android'
              ? 'Google Play'
              : t('cuzdanX.kanalMagaza');
        const bonus =
          pkg.bonus_coins > 0
            ? t('cuzdanX.bonusSatir', {
                taban: pkg.coins.toLocaleString(loc),
                bonus: pkg.bonus_coins.toLocaleString(loc),
              })
            : '';
        Alert.alert(
          t('cuzdanX.coinYukle'),
          t('cuzdanX.satinAlOnay', {
            baslik: pkg.title,
            bonus,
            toplam: toplam.toLocaleString(loc),
            fiyat: fiyatYazi,
            kanal,
          }),
          [
            { text: t('ortak.iptal'), style: 'cancel' },
            {
              text: t('cuzdan.satinAl'),
              onPress: async () => {
                try {
                  const sonuc = await CoinPaketiSatinAl(pkg);
                  if (!sonuc.ok) {
                    Alert.alert(t('cuzdanX.satinAlma'), sonuc.hata);
                    return;
                  }
                  // Doğrulama bitti → bakiyeyi beklemeden yansıt, mutabakat arkada.
                  const eklenecek = sonuc.coinsAdded ?? 0;
                  if (eklenecek > 0) adjustWallet({ coins: eklenecek });
                  void refreshWallet();
                  Alert.alert(
                    t('ortak.basarili'),
                    sonuc.coinsAdded != null
                      ? t('cuzdanX.coinEklendi', { adet: sonuc.coinsAdded })
                      : t('cuzdanX.odemeTamam'),
                  );
                  setAcik(false);
                } catch (e) {
                  Alert.alert(
                    t('cuzdanX.satinAlma'),
                    e instanceof Error
                      ? e.message
                      : t('cuzdanX.beklenmeyenHata'),
                  );
                }
              },
            },
          ],
        );
      });
    },
    [adjustWallet, islemiDene, loc, purchaseLocked, refreshWallet, t],
  );

  return {
    acik,
    ac,
    kapat,
    packages,
    yenileniyor,
    purchaseLocked,
    satinAl,
    paketleriYenile,
    upgradeAcik,
    upgradeKapat,
    upgradeAc,
    isGuest,
  };
}
