import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth, useWallet } from '../../src/contexts/AuthContext';
import type { CoinPackage } from '../../src/types/models';
import { CoinPaketleriniGetir } from '../../src/moduller/cuzdan/okuma/CoinPaketleriniGetir';
import {
  CoinPaketKatalogunuHazirla,
  CoinPaketleriAnlikGorunum,
} from '../../src/moduller/cuzdan/katalog/CoinPaketOnbellegi';
import { CoinPaketMagaza } from '../../src/moduller/cuzdan/bilesenler/CoinPaketMagaza';
import {
  PaketFiyatiGosterilebilir,
  PaketFiyatYazi,
} from '../../src/moduller/cuzdan/katalog/CoinPaketFiyat';
import {
  MagazaFiyatAnlikHaritasi,
  MagazaFiyatCacheTazeMi,
  MagazaFiyatDeposunuHazirla,
  MagazaFiyatlariniYukle,
  PaketlereMagazaFiyatiUygula,
} from '../../src/moduller/cuzdan/katalog/MagazaFiyatlariniYukle';
import { KillSwitchAktifMiSunucu } from '../../src/moduller/ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { CoinPaketiSatinAl } from '../../src/moduller/iap/islemler/CoinPaketiSatinAl';
import { IapBaglantisiniIsit } from '../../src/moduller/iap/oturum/IapOturum';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { DIL_LOCALE_MAP } from '../../src/i18n/diller';
import { useCeviri } from '../../src/i18n/useCeviri';

export default function CoinYukleEkrani() {
  const { t, dil } = useCeviri();
  const sayiLocale = DIL_LOCALE_MAP[dil];
  const { isGuest, refreshProfile } = useAuth();
  const { wallet, refreshWallet, adjustWallet } = useWallet();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);

  const [packages, setPackages] = useState<CoinPackage[]>(
    CoinPaketleriAnlikGorunum,
  );
  const [purchaseLocked, setPurchaseLocked] = useState(false);
  const [paketlerYenileniyor, setPaketlerYenileniyor] = useState(false);
  /** Art arda yenilemelerde yalnızca son isteğin sonucu yazılsın. */
  const istekRef = useRef(0);

  const yenile = useCallback(async (elle = false) => {
    const istek = ++istekRef.current;
    const gecerli = () => istek === istekRef.current;
    if (elle) setPaketlerYenileniyor(true);

    void KillSwitchAktifMiSunucu('kill_coin_purchase').then((v) => {
      if (gecerli()) setPurchaseLocked(v);
    });
    IapBaglantisiniIsit();

    try {
      // 1) Disk: katalog + son bilinen mağaza fiyatları → kartlar hemen tıklanabilir.
      await Promise.all([
        CoinPaketKatalogunuHazirla().catch(() => null),
        MagazaFiyatDeposunuHazirla(),
      ]);
      if (!gecerli()) return;
      const diskFiyat = MagazaFiyatAnlikHaritasi();
      if (diskFiyat) {
        setPackages((onceki) => PaketlereMagazaFiyatiUygula(onceki, diskFiyat));
      }

      // 2) Katalog ve mağaza fiyatı PARALEL — eskiden sırayla bekliyordu.
      const katalogIstek = CoinPaketleriniGetir().catch(() => null);
      const fiyatIstek = MagazaFiyatlariniYukle(
        CoinPaketleriAnlikGorunum(),
      ).catch(() => null);
      const [katalog, fiyatlar] = await Promise.all([katalogIstek, fiyatIstek]);
      if (!gecerli()) return;

      const taban = katalog && katalog.length > 0 ? katalog : null;
      const harita = fiyatlar ?? MagazaFiyatAnlikHaritasi() ?? {};
      setPackages((onceki) =>
        PaketlereMagazaFiyatiUygula(taban ?? onceki, harita),
      );

      // 3) Katalog SKU'ları fiyatsız kaldıysa tek tur daha dene.
      if (taban && !MagazaFiyatCacheTazeMi(taban)) {
        const eksikVar = taban.some((p) => !PaketFiyatiGosterilebilir(p));
        if (eksikVar) {
          const eksikFiyatlar = await MagazaFiyatlariniYukle(taban).catch(
            () => null,
          );
          if (!gecerli()) return;
          if (eksikFiyatlar && Object.keys(eksikFiyatlar).length) {
            setPackages((onceki) =>
              PaketlereMagazaFiyatiUygula(onceki, eksikFiyatlar),
            );
          }
        }
      }
    } catch {
      /* katalog okunamadı — fallback/disk yeterli */
    } finally {
      if (elle && gecerli()) setPaketlerYenileniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void yenile();
    }, [yenile]),
  );

  const onBuy = (pkg: CoinPackage) => {
    islemiDene('coin_satinal', () => {
      if (purchaseLocked) {
        Alert.alert(t('cuzdanX.kapali'), t('cuzdanX.satinAlmaDurduruldu'));
        return;
      }
      // Mağaza fiyatı okunmadan onay gösterme — katalog fiyatı tahsilat gibi sunulmaz.
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
      const bonusSatir =
        pkg.bonus_coins > 0
          ? `\n${pkg.coins.toLocaleString(sayiLocale)} + ${pkg.bonus_coins.toLocaleString(sayiLocale)} ${t('cuzdanX.bonus')}`
          : '';
      Alert.alert(
        t('cuzdanX.coinYukle'),
        `${pkg.title}${bonusSatir}\n${t('cuzdanX.toplamCoin', { toplam: toplam.toLocaleString(sayiLocale) })}\n${fiyatYazi}\n${t('cuzdanX.odemeKanali', { kanal })}`,
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
                // Doğrulama tamamlandı → bakiyeyi ekstra ağ turu beklemeden yansıt.
                const eklenecek = sonuc.coinsAdded ?? 0;
                if (eklenecek > 0) adjustWallet({ coins: eklenecek });
                // Sunucu mutabakatı arka planda (eski bir okuma bakiyeyi ezmesin).
                void refreshWallet();
                Alert.alert(
                  t('ortak.basarili'),
                  sonuc.coinsAdded != null
                    ? t('cuzdanX.coinEklendi', { adet: sonuc.coinsAdded })
                    : t('cuzdanX.odemeTamam'),
                );
              } catch (e) {
                Alert.alert(
                  t('cuzdanX.satinAlma'),
                  e instanceof Error ? e.message : t('cuzdanX.beklenmeyenHata'),
                );
              }
            },
          },
        ],
      );
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="cuzdan-coin-yukle">
        <EkranBasligi
          title={t('cuzdanX.coinYukle')}
          subtitle={t('cuzdanY.heroNot')}
          fallbackHref="/(tabs)/wallet"
          right={
            <Pressable
              onPress={() => router.push('/(tabs)/wallet' as any)}
              style={styles.ustAksiyon}
              hitSlop={8}
              accessibilityLabel={t('cuzdanY.cuzdanim')}
            >
              <Ionicons name="wallet-outline" size={20} color={RenkTokenlari.text} />
            </Pressable>
          }
        />

        <ScrollView
          contentContainerStyle={styles.icerik}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.bakiyeKart}>
            <View style={styles.bakiyeSol}>
              <Text style={styles.bakiyeEtiket}>{t('cuzdanBilgi.satinBakiye')}</Text>
              <Text style={styles.bakiyeDeger} numberOfLines={1} adjustsFontSizeToFit>
                {(wallet?.coins ?? 0).toLocaleString(sayiLocale)}{' '}
                <Text style={styles.bakiyeBirim}>{t('cuzdanY.coin')}</Text>
              </Text>
            </View>
            <View style={styles.bakiyeIkon}>
              <Ionicons name="wallet" size={18} color={RenkTokenlari.textOnPrimary} />
            </View>
          </View>

          {purchaseLocked ? (
            <View style={styles.kilitSatir}>
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={RenkTokenlari.warning}
              />
              <Text style={styles.kilitYazi}>{t('cuzdanX.satinAlmaKapali')}</Text>
            </View>
          ) : null}

          <CoinPaketMagaza
            packages={packages}
            locked={purchaseLocked}
            onBuy={onBuy}
            yenileniyor={paketlerYenileniyor}
            onPaketleriYenile={() => {
              void yenile(true);
            }}
          />

          <Text style={styles.dipnot}>{t('cuzdanX.coinBilgi')}</Text>
        </ScrollView>

        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={() => {
            void refreshProfile();
            void refreshWallet();
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  icerik: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.xxl,
    gap: BoslukTokenlari.md,
  },
  ustAksiyon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bakiyeKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  bakiyeSol: { flex: 1, minWidth: 0, gap: 4 },
  bakiyeEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bakiyeDeger: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontWeight: '900',
    fontSize: 22,
  },
  bakiyeBirim: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  bakiyeIkon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.primary,
  },
  kilitSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  kilitYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.warning,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  dipnot: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10.5,
    lineHeight: 15,
    paddingHorizontal: 2,
  },
});
