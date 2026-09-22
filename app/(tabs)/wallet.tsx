import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { KlavyeKapatan } from '../../src/components/KlavyeKapatan';
import {
  KlavyeFocusKaydir,
  KlavyeScrollView,
  type KlavyeScrollHandle,
} from '../../src/bilesenler/klavye/KlavyeScrollView';
import { YUZEN_TAB_ICERIK_BOSLUGU } from '../../src/components/YuzenTabBar';
import { useAuth } from '../../src/contexts/AuthContext';
import { CoinPaketleriniGetir } from '../../src/moduller/cuzdan/okuma/CoinPaketleriniGetir';
import { COIN_PAKET_FALLBACK } from '../../src/moduller/cuzdan/katalog/CoinPaketFallback';
import {
  CoinPaketMagaza,
} from '../../src/moduller/cuzdan/bilesenler/CoinPaketMagaza';
import { PaketFiyatYazi } from '../../src/moduller/cuzdan/katalog/CoinPaketFiyat';
import {
  MagazaFiyatlariniYukle,
  PaketlereMagazaFiyatiUygula,
} from '../../src/moduller/cuzdan/katalog/MagazaFiyatlariniYukle';
import { OzellikBayragiAktifMiSunucu } from '../../src/moduller/ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';
import { CanliHediyeSimgesi } from '../../src/moduller/cuzdan/bilesenler/CanliCoinSimgesi';
import {
  CuzdanLedgeriniGetir,
  LedgerAnlasilirOzet,
  LedgerBirimEtiketi,
  type LedgerSatiri,
} from '../../src/moduller/cuzdan/okuma/CuzdanLedgeriniGetir';
import { CoinPaketiSatinAl } from '../../src/moduller/iap/islemler/CoinPaketiSatinAl';
import { KillSwitchAktifMiSunucu } from '../../src/moduller/ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import {
  CekimTalebiOlustur,
  CekimTaleplerimiGetir,
} from '../../src/moduller/cuzdan/cekim/CekimTalebiOlustur';
import { CEKIM_ODEME_BILGISI } from '../../src/moduller/cuzdan/cekim/CekimOdemeBilgisi';
import { BankaHesabiGetir } from '../../src/moduller/kullanici-profili/islemler/BankaHesabi';
import type { BankaHesabi } from '../../src/moduller/kullanici-profili/islemler/BankaHesabi';
import {
  HediyeGecmisiniGetir,
  type HediyeGecmisiKaydi,
} from '../../src/moduller/hediyeler/okuma/HediyeGecmisiniGetir';
import {
  ProfilIstatistikleriniGetir,
  type KullaniciProfilIstatistikleri,
} from '../../src/moduller/kullanici-profili/istatistik/ProfilIstatistikleriniGetir';
import { CuzdanBankaKarti } from '../../src/moduller/cuzdan/bilesenler/CuzdanBankaKarti';
import { CuzdanHesabiGarantile } from '../../src/moduller/cuzdan/takas/CuzdanHesabi';
import { CUZDAN_MARKA_ADI } from '../../src/moduller/cuzdan/takas/CuzdanTakasTipleri';
import type { WalletAccount } from '../../src/moduller/cuzdan/takas/CuzdanTakasTipleri';
import {
  CuzdanKartiniMesajlaPaylas,
  CuzdanKartiniWhatsAppPaylas,
} from '../../src/moduller/cuzdan/islemler/CuzdanKartPaylasimi';
import { MesajKullaniciAramaPaneli } from '../../src/moduller/mesajlasma/bilesenler/MesajKullaniciAramaPaneli';
import type { ArananKullanici } from '../../src/moduller/mesajlasma/okuma/KullanicilariAra';
import {
  CuzdanHareketDetayKarti,
  type CuzdanHareketDetay,
} from '../../src/moduller/cuzdan/bilesenler/CuzdanHareketDetayKarti';
import {
  BelgePaylasDugmesi,
  BelgePaylasimPaneli,
} from '../../src/moduller/belge-paylasim/bilesenler/BelgePaylasimPaneli';
import { HesapHareketleriBelgesiOlustur } from '../../src/moduller/belge-paylasim/HesapHareketleriBelgesi';
import type { HesapHareketleriBelgeGirdi } from '../../src/moduller/belge-paylasim/HesapHareketleriBelgesi';
import {
  OyunGecmisiniGetir,
  type OyunGecmisiKaydi,
} from '../../src/moduller/oyunlar/ortak/servisler/OyunGecmisiniGetir';
import {
  OyunOyuncuIstatistikGetir,
  type OyunOyuncuIstatistik,
} from '../../src/moduller/oyunlar/ortak/servisler/OyunIstatistikServisi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import type { CoinPackage } from '../../src/types/models';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import {
  CoinTryKarsiligi,
  TryYazi,
} from '../../src/moduller/cuzdan/katalog/CoinTryOrani';
import { useCuzdanUiConfig } from '../../src/moduller/cuzdan/ui-config/useCuzdanUiConfig';
import {
  CuzdanAksiyonlariSirali,
  CuzdanBolumAcikMi,
  CuzdanMetinAl,
} from '../../src/moduller/cuzdan/ui-config/CuzdanUiNormalize';
import { CuzdanDinamikSimge } from '../../src/moduller/cuzdan/bilesenler/CuzdanDinamikSimge';
import { CuzdanDinamikAksiyonGrid } from '../../src/moduller/cuzdan/bilesenler/CuzdanDinamikAksiyonGrid';
import type { CuzdanUiAction } from '../../src/moduller/cuzdan/ui-config/CuzdanUiTipleri';

type CekimTalebi = {
  id: string;
  diamonds: number;
  status: string;
  method: string;
  created_at: string;
};

const CEKIM_DURUM: Record<string, string> = {
  pending: 'İncelemede',
  under_review: 'İncelemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  paid: 'Ödendi',
  frozen: 'Donduruldu',
};

type Sekme = 'hareket' | 'hediye' | 'yukle' | 'cekim';

function formatTarih(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function sekmeParamCoz(v: unknown): Sekme | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === 'hareket' || s === 'hediye' || s === 'yukle' || s === 'cekim') {
    return s;
  }
  return null;
}

export default function WalletScreen() {
  const { wallet, refreshWallet, adjustWallet, isGuest, refreshProfile, user, profile } =
    useAuth();
  const { config: cuzdanUi } = useCuzdanUiConfig();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const params = useLocalSearchParams<{ sekme?: string | string[] }>();
  const scrollRef = useRef<KlavyeScrollHandle>(null);
  const [packages, setPackages] = useState<CoinPackage[]>(COIN_PAKET_FALLBACK);
  const [ledger, setLedger] = useState<LedgerSatiri[]>([]);
  const [hediyeler, setHediyeler] = useState<HediyeGecmisiKaydi[]>([]);
  const [stats, setStats] = useState<KullaniciProfilIstatistikleri | null>(null);
  const [withdrawals, setWithdrawals] = useState<CekimTalebi[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [purchaseLocked, setPurchaseLocked] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [banka, setBanka] = useState<BankaHesabi | null>(null);
  const [sekme, setSekme] = useState<Sekme>(
    () => sekmeParamCoz(params.sekme) ?? 'hareket',
  );
  const [detay, setDetay] = useState<CuzdanHareketDetay | null>(null);
  const [oyunlar, setOyunlar] = useState<OyunGecmisiKaydi[]>([]);
  const [oyunStats, setOyunStats] = useState<OyunOyuncuIstatistik | null>(null);
  const [belgeAcik, setBelgeAcik] = useState(false);
  const [excelGirdi, setExcelGirdi] = useState<HesapHareketleriBelgeGirdi | null>(
    null,
  );
  const [belgeBusy, setBelgeBusy] = useState(false);
  const [mutaHesap, setMutaHesap] = useState<WalletAccount | null>(null);
  const [kartPaylasAcik, setKartPaylasAcik] = useState(false);
  const [kartPaylasBusy, setKartPaylasBusy] = useState(false);
  const [takasAcik, setTakasAcik] = useState(false);
  const [cekimAcik, setCekimAcik] = useState(false);
  const insets = useSafeAreaInsets();

  const yenileHepsi = useCallback(async (iptalRef?: { current: boolean }) => {
    const iptal = () => iptalRef?.current === true;
    await refreshWallet();
    if (iptal()) return;

    void KillSwitchAktifMiSunucu('kill_coin_purchase').then((v) => {
      if (!iptal()) setPurchaseLocked(v);
    });
    void OzellikBayragiAktifMiSunucu('wallet_exchange_enabled').then((v) => {
      if (!iptal()) setTakasAcik(v);
    });
    void Promise.all([
      OzellikBayragiAktifMiSunucu('wallet_withdraw_enabled'),
      OzellikBayragiAktifMiSunucu('withdrawals_enabled'),
    ]).then(([a, b]) => {
      if (!iptal()) setCekimAcik(a || b);
    });

    // Paketler: sadece boşsa veya IAP fiyatı yoksa yükle (her focus IAP = jank)
    CoinPaketleriniGetir()
      .then(async (data) => {
        if (iptal() || !data.length) return;
        setPackages((onceki) => (onceki.length ? onceki : data));
        try {
          const fiyatlar = await MagazaFiyatlariniYukle(data);
          if (iptal()) return;
          if (Object.keys(fiyatlar).length) {
            setPackages(PaketlereMagazaFiyatiUygula(data, fiyatlar));
          }
        } catch {
          if (!iptal()) setPackages((onceki) => (onceki.length ? onceki : data));
        }
      })
      .catch(() => undefined);

    CuzdanLedgeriniGetir(80)
      .then((rows) => {
        if (!iptal()) setLedger(rows);
      })
      .catch(() => {
        if (!iptal()) setLedger([]);
      });
    CekimTaleplerimiGetir()
      .then((rows) => {
        if (!iptal()) setWithdrawals(rows as CekimTalebi[]);
      })
      .catch(() => {
        if (!iptal()) setWithdrawals([]);
      });
    BankaHesabiGetir()
      .then((b) => {
        if (!iptal()) setBanka(b);
      })
      .catch(() => {
        if (!iptal()) setBanka(null);
      });
    if (user?.id) {
      HediyeGecmisiniGetir(user.id, 80)
        .then((h) => {
          if (!iptal()) setHediyeler(h);
        })
        .catch(() => {
          if (!iptal()) setHediyeler([]);
        });
      ProfilIstatistikleriniGetir(user.id)
        .then((s) => {
          if (!iptal()) setStats(s);
        })
        .catch(() => {
          if (!iptal()) setStats(null);
        });
      OyunGecmisiniGetir(user.id, 60)
        .then((o) => {
          if (!iptal()) setOyunlar(o);
        })
        .catch(() => {
          if (!iptal()) setOyunlar([]);
        });
      OyunOyuncuIstatistikGetir(user.id)
        .then((o) => {
          if (!iptal()) setOyunStats(o);
        })
        .catch(() => {
          if (!iptal()) setOyunStats(null);
        });
      void CuzdanHesabiGarantile().then((r) => {
        if (!iptal() && r.ok) setMutaHesap(r.hesap);
      });
    }
  }, [refreshWallet, user?.id]);

  useFocusEffect(
    useCallback(() => {
      const iptalRef = { current: false };
      // Önce bakiye; geçmişi etkileşim sonrası — feed'e dönüş donmasın
      void refreshWallet();
      const gorev = InteractionManager.runAfterInteractions(() => {
        if (iptalRef.current) return;
        void yenileHepsi(iptalRef);
      });
      return () => {
        iptalRef.current = true;
        gorev.cancel();
      };
    }, [yenileHepsi, refreshWallet]),
  );

  const hesapBelgesi = useMemo(() => {
    if (!excelGirdi) return null;
    return HesapHareketleriBelgesiOlustur(excelGirdi);
  }, [excelGirdi]);

  const hesapOzetiniAc = useCallback(async () => {
    setBelgeBusy(true);
    try {
      const [ledgerBuyuk, hediyeBuyuk, cekimler, oyunBuyuk, oyunOzet] =
        await Promise.all([
          CuzdanLedgeriniGetir(250).catch(() => ledger),
          user?.id
            ? HediyeGecmisiniGetir(user.id, 200).catch(() => hediyeler)
            : Promise.resolve(hediyeler),
          CekimTaleplerimiGetir().catch(() => withdrawals),
          user?.id
            ? OyunGecmisiniGetir(user.id, 120).catch(() => oyunlar)
            : Promise.resolve(oyunlar),
          user?.id
            ? OyunOyuncuIstatistikGetir(user.id).catch(() => oyunStats)
            : Promise.resolve(oyunStats),
        ]);

      const girdi: HesapHareketleriBelgeGirdi = {
        sahipAdi: profile?.display_name ?? profile?.username,
        hesapKodu: profile?.public_user_id ?? user?.id,
        coins: wallet?.coins ?? 0,
        diamonds: wallet?.diamonds ?? 0,
        ledger: ledgerBuyuk,
        hediyeler: hediyeBuyuk,
        cekimler: (cekimler as CekimTalebi[]).map((w) => ({
          ...w,
          durumEtiket: CEKIM_DURUM[w.status] ?? w.status,
        })),
        oyunlar: oyunBuyuk,
        oyunOzet: oyunOzet ?? null,
      };
      setExcelGirdi(girdi);
      setBelgeAcik(true);
    } finally {
      setBelgeBusy(false);
    }
  }, [
    ledger,
    hediyeler,
    withdrawals,
    oyunlar,
    oyunStats,
    user?.id,
    profile?.display_name,
    profile?.username,
    profile?.public_user_id,
    wallet?.coins,
    wallet?.diamonds,
  ]);

  const yuklemeler = useMemo(
    () => ledger.filter((r) => r.delta > 0 && (r.currency === 'coin' || r.currency === 'coins')),
    [ledger],
  );
  const gonderilen = useMemo(
    () => hediyeler.filter((h) => h.yon === 'gonderilen'),
    [hediyeler],
  );
  const alinan = useMemo(
    () => hediyeler.filter((h) => h.yon === 'alinan'),
    [hediyeler],
  );

  const onBuy = (pkg: CoinPackage) => {
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
                  // IAP bağlantısı kapandıktan sonra mağaza/yenile yarışmasın
                  await new Promise((r) => setTimeout(r, 350));
                  try {
                    await yenileHepsi();
                  } catch {
                    void refreshWallet().catch(() => undefined);
                  }
                  Alert.alert(
                    'Başarılı',
                    sonuc.coinsAdded != null
                      ? `+${sonuc.coinsAdded} coin`
                      : 'Ödeme tamam',
                  );
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
  };

  const onWithdraw = () => {
    islemiDene('cekim', () => {
      const diamonds = Number.parseInt(withdrawAmount.replace(/\D/g, ''), 10);
      if (!Number.isFinite(diamonds) || diamonds <= 0) {
        Alert.alert('Tutar', 'Geçerli bir elmas miktarı gir.');
        return;
      }
      if ((wallet?.diamonds ?? 0) < diamonds) {
        Alert.alert('Yetersiz', 'Elmas bakiyesi yetersiz.');
        return;
      }
      if (!banka?.iban) {
        Alert.alert('Banka bilgisi', 'Önce IBAN ve banka adını kaydet.', [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Profili düzenle',
            onPress: () => router.push('/profil-duzenle' as any),
          },
        ]);
        return;
      }
      Alert.alert(
        'Çekim talebi',
        `${diamonds} elmas → ${banka.bank_name}\n${banka.iban}\n\n${CEKIM_ODEME_BILGISI}`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Talep et',
            onPress: async () => {
              setWithdrawBusy(true);
              const sonuc = await CekimTalebiOlustur({
                diamonds,
                method: 'bank',
                details: {
                  account_holder: banka.account_holder,
                  bank_name: banka.bank_name,
                  iban: banka.iban,
                },
              });
              setWithdrawBusy(false);
              if (!sonuc.ok) {
                Alert.alert('Çekim', sonuc.hata ?? 'Reddedildi');
                return;
              }
              setWithdrawAmount('');
              adjustWallet({ diamonds: -diamonds });
              await yenileHepsi();
              Alert.alert(
                'Talep alındı',
                `İncelemede.\n\n${CEKIM_ODEME_BILGISI}`,
              );
            },
          },
        ],
      );
    });
  };

  const sekmeler: { id: Sekme; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'hareket', label: 'Hareket', icon: 'swap-vertical' },
    { id: 'hediye', label: 'Hediye', icon: 'gift-outline' },
    { id: 'yukle', label: 'Yükle', icon: 'card-outline' },
    ...(cekimAcik
      ? ([{ id: 'cekim' as const, label: 'Çekim', icon: 'cash-outline' as const }] as const)
      : []),
  ];

  // Bildirim / deep link: ?sekme=yukle → Yükle sekmesi
  React.useEffect(() => {
    const hedef = sekmeParamCoz(params.sekme);
    if (hedef) setSekme(hedef);
  }, [params.sekme]);

  // Çekim kapalıyken sekmede kalma
  React.useEffect(() => {
    if (!cekimAcik && sekme === 'cekim') setSekme('yukle');
  }, [cekimAcik, sekme]);

  const flagMap = useMemo(
    () => ({
      wallet_exchange_enabled: takasAcik,
      wallet_withdraw_enabled: cekimAcik,
      withdrawals_enabled: cekimAcik,
    }),
    [takasAcik, cekimAcik],
  );

  const hizliAksiyonlar = useMemo(() => {
    const list = CuzdanAksiyonlariSirali(cuzdanUi, flagMap).filter(
      (a) => a.key === 'takas' || a.key === 'kyc' || a.action_type === 'route',
    );
    // KYC başlığını durumla zenginleştir
    return list.map((a) => {
      if (a.key !== 'kyc') return a;
      return {
        ...a,
        title:
          mutaHesap?.kyc_status === 'approved'
            ? 'Kimlik onaylı'
            : mutaHesap?.kyc_status === 'pending'
              ? 'KYC bekliyor'
              : a.title,
        icon_color:
          mutaHesap?.kyc_status === 'approved'
            ? RenkTokenlari.mint
            : a.icon_color,
      };
    });
  }, [cuzdanUi, flagMap, mutaHesap?.kyc_status]);

  const aksiyonCalistir = useCallback(
    (a: CuzdanUiAction) => {
      if (a.action_type === 'open_statement') {
        void hesapOzetiniAc();
        return;
      }
      if (a.action_type === 'route' && a.action_target) {
        const hedef = a.action_target;
        if (hedef.includes('takas')) {
          islemiDene('takas', () => router.push(hedef as any));
        } else if (hedef.includes('kyc')) {
          islemiDene('kyc', () => router.push(hedef as any));
        } else {
          router.push(hedef as any);
        }
      }
    },
    [hesapOzetiniAc, islemiDene],
  );

  const tema = cuzdanUi.theme;
  const goster = (key: Parameters<typeof CuzdanBolumAcikMi>[1]) =>
    CuzdanBolumAcikMi(cuzdanUi, key);

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="cuzdan">
        {goster('header') ? (
        <View style={styles.baslikBar}>
          <Pressable
            onPress={() => {
              try {
                router.navigate('/(tabs)/profile');
              } catch {
                try {
                  router.replace('/(tabs)/profile');
                } catch {
                  /* ignore */
                }
              }
            }}
            style={styles.geri}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={tema.primaryText} />
          </Pressable>
          <View style={styles.baslikCopy}>
            {cuzdanUi.general.eyebrow ? (
              <Text style={[styles.baslikFisilti, { color: tema.secondaryText }]}>
                {cuzdanUi.general.eyebrow}
              </Text>
            ) : null}
            <View style={styles.baslikSatir}>
              {cuzdanUi.wallet_icon.visible !== false ? (
                <CuzdanDinamikSimge
                  icon={cuzdanUi.wallet_icon}
                  fallbackIonicon="wallet-outline"
                />
              ) : null}
              <Text style={[styles.baslik, { color: tema.primaryText }]}>
                {cuzdanUi.general.screen_name || 'Cüzdan'}
              </Text>
            </View>
            {cuzdanUi.general.subtitle ? (
              <Text style={[styles.baslikAlt, { color: tema.secondaryText }]}>
                {cuzdanUi.general.subtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.geri} />
        </View>
        ) : null}

        <KlavyeScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          ekstraPad={56}
        >
          <KlavyeKapatan>
            <View style={styles.heroBolum}>
              {goster('hero_card') ? (
              <CuzdanBankaKarti
                coins={wallet?.coins ?? 0}
                diamonds={wallet?.diamonds ?? 0}
                hesapKodu={profile?.public_user_id ?? user?.id}
                cuzdanNo={mutaHesap?.wallet_number}
                cuzdanMarka={
                  cuzdanUi.brand?.name?.trim() ||
                  mutaHesap?.wallet_brand_name ||
                  CUZDAN_MARKA_ADI
                }
                kartTipi={cuzdanUi.brand?.card_type}
                markaTagline={cuzdanUi.brand?.tagline}
                markaTaglineGorunur={cuzdanUi.brand?.tagline_visible !== false}
                degerOzeti={cuzdanUi.value_summary}
                sahipAdi={
                  mutaHesap?.legal_first_name
                    ? `${mutaHesap.legal_first_name} ${mutaHesap.legal_last_name ?? ''}`.trim()
                    : (profile?.display_name ?? profile?.username)
                }
                yuklenen={stats?.total_topup_coin ?? 0}
                harcanan={stats?.total_spent_coin ?? 0}
                onQrOku={
                  takasAcik
                    ? () =>
                        islemiDene('takas', () =>
                          router.push('/cuzdan/takas' as any),
                        )
                    : undefined
                }
                onPaylas={() =>
                  islemiDene('mesaj_gonder', () => {
                    const no = mutaHesap?.wallet_number?.replace(/\D/g, '') ?? '';
                    if (no.length !== 18) {
                      Alert.alert('Cüzdan', 'Numara henüz hazır değil.');
                      return;
                    }
                    setKartPaylasAcik(true);
                  })
                }
                onWhatsAppPaylas={() =>
                  islemiDene('mesaj_gonder', () => {
                    void (async () => {
                      const no = mutaHesap?.wallet_number ?? '';
                      const r = await CuzdanKartiniWhatsAppPaylas(no);
                      if (!r.ok) Alert.alert('WhatsApp', r.hata);
                    })();
                  })
                }
              />
              ) : null}

              {goster('quick_actions') && hizliAksiyonlar.length > 0 ? (
                <CuzdanDinamikAksiyonGrid
                  actions={hizliAksiyonlar}
                  onPress={aksiyonCalistir}
                />
              ) : null}

              {purchaseLocked ? (
                <Text style={[styles.lockHint, { color: tema.warning }]}>
                  {CuzdanMetinAl(
                    cuzdanUi,
                    'purchase_locked',
                    'tr',
                    'Satın alma geçici olarak kapalı',
                  )}
                </Text>
              ) : null}

              {goster('coin_info') ? (
                <Text style={[styles.coinInfo, { color: tema.secondaryText }]}>
                  {CuzdanMetinAl(cuzdanUi, 'coin_info', 'tr')}
                </Text>
              ) : null}
              {CuzdanMetinAl(cuzdanUi, 'hero_note', 'tr') ? (
                <Text style={[styles.coinInfo, { color: tema.secondaryText, marginTop: 4 }]}>
                  {CuzdanMetinAl(cuzdanUi, 'hero_note', 'tr')}
                </Text>
              ) : null}
            </View>

            {goster('summary') ? (
            <View style={styles.ozetBolum}>
              <Text style={[styles.bolumEtiket, { color: tema.secondaryText }]}>
                {CuzdanMetinAl(cuzdanUi, 'summary_title', 'tr', 'Özet')}
              </Text>
              <View style={styles.summaryRow}>
                <OzetKutu
                  icon="arrow-up-circle"
                  tint={RenkTokenlari.danger}
                  label="Gönderilen"
                  value={String(stats?.total_gifts_sent ?? gonderilen.length)}
                />
                <OzetKutu
                  icon="arrow-down-circle"
                  tint={RenkTokenlari.mint}
                  label="Alınan"
                  value={String(stats?.total_gifts_received ?? alinan.length)}
                />
                <OzetKutu
                  icon="trending-up"
                  tint={tema.accent}
                  label="Yükleme"
                  value={String(yuklemeler.length)}
                />
              </View>
            </View>
            ) : null}

            {goster('tabs') ? (
            <View style={styles.sekmeBolum}>
              <Text style={styles.bolumEtiket}>İşlemler</Text>
              <View style={styles.tabs}>
                {sekmeler.map((s) => {
                  const aktif = sekme === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSekme(s.id)}
                      style={({ pressed }) => [
                        styles.tab,
                        aktif && styles.tabActive,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <View
                        style={[
                          styles.tabIkon,
                          aktif && styles.tabIkonActive,
                        ]}
                      >
                        <Ionicons
                          name={s.icon}
                          size={18}
                          color={
                            aktif
                              ? RenkTokenlari.textOnPrimary
                              : RenkTokenlari.textMuted
                          }
                        />
                      </View>
                      <Text
                        style={[styles.tabText, aktif && styles.tabTextActive]}
                        numberOfLines={1}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            ) : null}

            {sekme === 'hareket' && goster('ledger') ? (
              <View style={styles.panel}>
                <View style={styles.panelBaslikSatir}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.panelTitle}>Hesap hareketleri</Text>
                    <Text style={styles.panelSub}>
                      Yükleme · hediye · oyun · çekim — detay için dokun
                    </Text>
                  </View>
                  <BelgePaylasDugmesi
                    onPress={() => {
                      if (belgeBusy) return;
                      void hesapOzetiniAc();
                    }}
                    label={belgeBusy ? 'Hazırlanıyor…' : 'PDF / Excel'}
                  />
                </View>
                {oyunStats && oyunStats.totalGames > 0 ? (
                  <Text style={styles.oyunOzetSatir}>
                    Oyun: {oyunStats.totalGames} · Kazanç (1.): {oyunStats.wins} ·
                    Oran %{oyunStats.winRate} · {oyunStats.leagueLabel}
                  </Text>
                ) : null}
                {ledger.length === 0 ? (
                  <Empty text="Henüz hareket yok" />
                ) : (
                  ledger.map((row) => (
                    <Pressable
                      key={row.id}
                      onPress={() => setDetay({ tur: 'ledger', veri: row })}
                      style={({ pressed }) => [styles.line, pressed && styles.linePressed]}
                    >
                      <View
                        style={[
                          styles.lineIcon,
                          {
                            backgroundColor:
                              row.delta >= 0
                                ? 'rgba(61,207,176,0.14)'
                                : 'rgba(232,75,106,0.14)',
                          },
                        ]}
                      >
                        <Ionicons
                          name={row.delta >= 0 ? 'add' : 'remove'}
                          size={14}
                          color={
                            row.delta >= 0 ? RenkTokenlari.mint : RenkTokenlari.danger
                          }
                        />
                      </View>
                      <View style={styles.lineCopy}>
                        <Text style={styles.lineTitle} numberOfLines={2}>
                          {LedgerAnlasilirOzet(row)}
                        </Text>
                        <Text style={styles.lineMeta}>
                          {formatTarih(row.created_at)}
                          {' · '}
                          {row.delta >= 0 ? 'Giriş' : 'Çıkış'}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.lineDelta,
                          {
                            color:
                              row.delta >= 0
                                ? RenkTokenlari.mint
                                : RenkTokenlari.danger,
                          },
                        ]}
                      >
                        {row.delta >= 0 ? '+' : ''}
                        {row.delta.toLocaleString('tr-TR')}{' '}
                        {LedgerBirimEtiketi(row.currency)}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={RenkTokenlari.textDim}
                      />
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            {sekme === 'hediye' && goster('gifts') ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Hediye geçmişi</Text>
                <Text style={styles.panelSub}>
                  Alınan hediye · elmas · TL karşılığı · detay için dokun
                </Text>
                {hediyeler.length === 0 ? (
                  <Empty text="Henüz hediye yok" />
                ) : (
                  hediyeler.map((h, i) => {
                    const kim =
                      h.karsi_profil?.display_name ??
                      h.karsi_profil?.username ??
                      'Kullanıcı';
                    const gonderildi = h.yon === 'gonderilen';
                    const tryDeger = CoinTryKarsiligi(h.coins_spent);
                    return (
                      <Pressable
                        key={h.id}
                        onPress={() => setDetay({ tur: 'hediye', veri: h })}
                        style={({ pressed }) => [styles.line, pressed && styles.linePressed]}
                      >
                        <View style={styles.hediyeIkon}>
                          <CanliHediyeSimgesi
                            emoji={h.gift?.emoji ?? '🎁'}
                            size={22}
                            delayMs={(i % 6) * 80}
                          />
                        </View>
                        <View style={styles.lineCopy}>
                          <Text style={styles.lineTitle} numberOfLines={1}>
                            {h.gift?.name ?? 'Hediye'}
                            {h.quantity > 1 ? ` ×${h.quantity}` : ''}
                          </Text>
                          <Text style={styles.lineMeta} numberOfLines={2}>
                            {gonderildi ? `→ ${kim}` : `← ${kim}`}
                            {h.oda?.title ? ` · ${h.oda.title}` : ''}
                            {` · ${formatTarih(h.created_at)}`}
                          </Text>
                          {!gonderildi ? (
                            <Text style={styles.lineTry}>
                              Kazanç: {TryYazi(tryDeger)}
                            </Text>
                          ) : (
                            <Text style={styles.lineTryMuted}>
                              Değer: {TryYazi(tryDeger)}
                            </Text>
                          )}
                        </View>
                        <View style={styles.lineRight}>
                          <Text
                            style={[
                              styles.lineDelta,
                              {
                                color: gonderildi
                                  ? RenkTokenlari.danger
                                  : RenkTokenlari.mint,
                              },
                            ]}
                          >
                            {gonderildi
                              ? `-${h.coins_spent}`
                              : `+${h.diamonds_earned}`}
                          </Text>
                          {!gonderildi ? (
                            <Text style={styles.lineTryDelta}>
                              {TryYazi(tryDeger)}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={RenkTokenlari.textDim}
                        />
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}

            {sekme === 'yukle' && goster('topup') ? (
              <View style={styles.panel}>
                <CoinPaketMagaza
                  packages={packages}
                  locked={purchaseLocked}
                  onBuy={onBuy}
                  onPaketleriYenile={() => {
                    CoinPaketleriniGetir()
                      .then((data) => {
                        if (data.length) setPackages(data);
                      })
                      .catch(() => undefined);
                  }}
                />
              </View>
            ) : null}

            {sekme === 'cekim' && goster('withdraw') && cekimAcik ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Elmas çekimi</Text>
                <View style={styles.odemeBilgiKart}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={RenkTokenlari.accent}
                  />
                  <Text style={styles.odemeBilgiYazi}>{CEKIM_ODEME_BILGISI}</Text>
                </View>
                {banka?.iban ? (
                  <View style={styles.ibanKart}>
                    <Text style={styles.ibanEtiket}>Kayıtlı hesap</Text>
                    <Text style={styles.ibanAd}>{banka.account_holder}</Text>
                    <Text style={styles.ibanBanka}>{banka.bank_name}</Text>
                    <Text style={styles.ibanNo}>{banka.iban}</Text>
                  </View>
                ) : (
                  <Pressable onPress={() => router.push('/profil-duzenle' as any)}>
                    <Text style={styles.panelHintWarn}>
                      IBAN kayıtlı değil — profil düzenlemeden ekle
                    </Text>
                  </Pressable>
                )}
                <TextField
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  keyboardType="number-pad"
                  placeholder="Miktar (elmas)"
                  onFocus={(e) =>
                    KlavyeFocusKaydir(scrollRef.current, e as never, {
                      delayMs: 60,
                    })
                  }
                />
                <Pressable
                  onPress={onWithdraw}
                  style={[styles.withdraw, withdrawBusy && { opacity: 0.6 }]}
                  disabled={withdrawBusy}
                >
                  <Text style={styles.withdrawText}>
                    {withdrawBusy ? 'Gönderiliyor…' : 'Çekim talebi oluştur'}
                  </Text>
                </Pressable>
                {withdrawals.length === 0 ? (
                  <Empty text="Çekim talebi yok" />
                ) : (
                  withdrawals.map((w) => (
                    <Pressable
                      key={w.id}
                      onPress={() =>
                        setDetay({
                          tur: 'cekim',
                          veri: w,
                          durumEtiket: CEKIM_DURUM[w.status] ?? w.status,
                        })
                      }
                      style={({ pressed }) => [styles.line, pressed && styles.linePressed]}
                    >
                      <View style={styles.lineCopy}>
                        <Text style={styles.lineTitle}>
                          {w.diamonds} elmas · {w.method}
                        </Text>
                        <Text style={styles.lineMeta}>{formatTarih(w.created_at)}</Text>
                      </View>
                      <Text style={styles.status}>
                        {CEKIM_DURUM[w.status] ?? w.status}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={RenkTokenlari.textDim}
                      />
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}
          </KlavyeKapatan>
        </KlavyeScrollView>
      </ModulHataSiniri>

      <CuzdanHareketDetayKarti detay={detay} onKapat={() => setDetay(null)} />

      <BelgePaylasimPaneli
        visible={belgeAcik}
        onKapat={() => setBelgeAcik(false)}
        icerik={hesapBelgesi}
        excelGirdi={excelGirdi}
      />

      <Modal
        visible={kartPaylasAcik}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !kartPaylasBusy && setKartPaylasAcik(false)}
      >
        <View
          style={[
            styles.paylasModal,
            { paddingTop: Math.max(insets.top, 12) },
          ]}
        >
          <View style={styles.paylasModalUst}>
            <Text style={styles.paylasModalBaslik}>Cüzdan kartını paylaş</Text>
            <Pressable
              onPress={() => !kartPaylasBusy && setKartPaylasAcik(false)}
              hitSlop={8}
              disabled={kartPaylasBusy}
            >
              <Ionicons name="close" size={24} color={RenkTokenlari.text} />
            </Pressable>
          </View>
          <Text style={styles.paylasModalAlt}>
            Kullanıcı seç — cüzdan no ve QR uygulama içi mesajla gider.
          </Text>
          <MesajKullaniciAramaPaneli
            haricUserId={user?.id}
            seciliyor={kartPaylasBusy}
            onSec={(k: ArananKullanici) => {
              const no = mutaHesap?.wallet_number ?? '';
              const ad =
                k.display_name?.trim() || k.username || 'kullanıcı';
              Alert.alert(
                'Kartı paylaş',
                `${ad} kullanıcısına cüzdan kartı mesajı gönderilsin mi?`,
                [
                  { text: 'Vazgeç', style: 'cancel' },
                  {
                    text: 'Gönder',
                    onPress: () => {
                      void (async () => {
                        setKartPaylasBusy(true);
                        const r = await CuzdanKartiniMesajlaPaylas({
                          otherUserId: k.id,
                          walletNumber: no,
                        });
                        setKartPaylasBusy(false);
                        if (!r.ok) {
                          Alert.alert('Paylaşım', r.hata);
                          return;
                        }
                        setKartPaylasAcik(false);
                        Alert.alert('Gönderildi', 'Cüzdan kartı mesaj olarak iletildi.', [
                          {
                            text: 'Sohbete git',
                            onPress: () =>
                              router.push(`/mesaj/${r.threadId}` as any),
                          },
                          { text: 'Tamam' },
                        ]);
                      })();
                    },
                  },
                ],
              );
            }}
          />
        </View>
      </Modal>

      <HesabiTamamlaKarti
        visible={upgradeAcik}
        onClose={upgradeKapat}
        onCompleted={() => {
          void refreshProfile();
          void refreshWallet();
        }}
      />
    </Screen>
  );
}

function OzetKutu({
  icon,
  tint,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summary}>
      <View style={[styles.summaryIkon, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <Text style={styles.summaryVal}>{value}</Text>
      <Text style={styles.summaryLbl}>{label}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

const styles = StyleSheet.create({
  baslikBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.md,
    gap: BoslukTokenlari.sm,
  },
  geri: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baslikCopy: { flex: 1, alignItems: 'center', gap: 4 },
  baslikFisilti: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1.4,
    fontSize: 9,
    lineHeight: 12,
  },
  baslik: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    lineHeight: 28,
  },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  baslikAlt: {
    ...TipografiTokenlari.micro,
    textAlign: 'center',
  },
  coinInfo: {
    ...TipografiTokenlari.micro,
    lineHeight: 16,
    paddingHorizontal: BoslukTokenlari.xl,
  },
  scroll: {
    paddingBottom: YUZEN_TAB_ICERIK_BOSLUGU,
    gap: BoslukTokenlari.xxl,
    paddingTop: BoslukTokenlari.sm,
  },
  heroBolum: {
    gap: BoslukTokenlari.md,
  },
  hizliAksiyonlar: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.xl,
  },
  hizliBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  hizliBtnYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  ozetBolum: {
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.xl,
  },
  sekmeBolum: {
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.xl,
  },
  bolumEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    letterSpacing: 1.2,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 10,
    marginLeft: 2,
  },
  lockHint: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.warning,
    textAlign: 'center',
    marginHorizontal: BoslukTokenlari.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
  },
  summary: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
    paddingVertical: BoslukTokenlari.lg,
    paddingHorizontal: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  summaryIkon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  summaryVal: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 16,
  },
  summaryLbl: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: BoslukTokenlari.md + 2,
    paddingHorizontal: 4,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  tabActive: {
    backgroundColor: 'rgba(232, 64, 145, 0.12)',
    borderColor: 'rgba(232, 64, 145, 0.35)',
  },
  tabIkon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  tabIkonActive: {
    backgroundColor: RenkTokenlari.primarySoft,
  },
  tabText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '600',
    fontSize: 11,
  },
  tabTextActive: { color: RenkTokenlari.text, fontWeight: '700' },
  panel: {
    marginHorizontal: BoslukTokenlari.xl,
    gap: BoslukTokenlari.sm,
  },
  panelBaslikSatir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BoslukTokenlari.sm,
    marginBottom: 2,
  },
  panelTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  panelSub: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  oyunOzetSatir: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    marginBottom: 4,
  },
  panelHintWarn: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '600',
  },
  odemeBilgiKart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BoslukTokenlari.sm,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: 'rgba(240, 180, 41, 0.35)',
    backgroundColor: 'rgba(240, 180, 41, 0.08)',
    marginBottom: 4,
  },
  odemeBilgiYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
    lineHeight: 20,
  },
  empty: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    paddingVertical: BoslukTokenlari.lg,
    textAlign: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    marginBottom: 6,
  },
  linePressed: { opacity: 0.88 },
  lineIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  hediyeIkon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.pressFill,
    flexShrink: 0,
  },
  lineCopy: { flex: 1, gap: 2, minWidth: 0 },
  lineTitle: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  lineMeta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  lineTry: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '700',
  },
  lineTryMuted: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  lineRight: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  lineDelta: {
    ...TipografiTokenlari.caption,
    fontWeight: '800',
    flexShrink: 0,
  },
  lineTryDelta: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '700',
  },
  pkg: { marginBottom: 8 },
  pkgInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  pkgLeft: { gap: 2, flex: 1, minWidth: 0 },
  pkgTitle: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  pkgCoins: { ...TipografiTokenlari.caption, color: RenkTokenlari.accent },
  pkgRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  badge: {
    backgroundColor: 'rgba(232, 64, 145, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: YaricapTokenlari.pill,
  },
  badgeText: { ...TipografiTokenlari.micro, color: RenkTokenlari.primarySoft },
  price: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  ibanKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    gap: 2,
    marginBottom: 4,
  },
  ibanEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginBottom: 4,
  },
  ibanAd: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  ibanBanka: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  ibanNo: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.4,
  },
  withdraw: {
    borderRadius: YaricapTokenlari.md,
    paddingVertical: BoslukTokenlari.md,
    alignItems: 'center',
    backgroundColor: 'rgba(61,207,176,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(61,207,176,0.35)',
  },
  withdrawText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.mint,
    fontWeight: '700',
  },
  status: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
    flexShrink: 0,
  },
  paylasModal: {
    flex: 1,
    backgroundColor: RenkTokenlari.bg,
  },
  paylasModalUst: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.sm,
  },
  paylasModalBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  paylasModalAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    paddingHorizontal: BoslukTokenlari.xl,
    marginBottom: BoslukTokenlari.sm,
  },
});
