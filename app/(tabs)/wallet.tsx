import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { YonluIkon } from '../../src/components/YonluIkon';
import { YUZEN_TAB_ICERIK_BOSLUGU } from '../../src/components/YuzenTabBar';
import { useAuth, useWallet } from '../../src/contexts/AuthContext';
import {
  CuzdanBakiyeKartlari,
  CuzdanBilgiBolumu,
  CuzdanErisimListesi,
  CuzdanHero,
} from '../../src/moduller/cuzdan/bilesenler/CuzdanimBolumleri';
import { OnemliBilgilendirmeKarti } from '../../src/moduller/cuzdan/bilesenler/CuzdanBilgiKartlari';
import {
  HareketSatiri,
} from '../../src/moduller/cuzdan/bilesenler/HareketListesi';
import {
  CuzdanHareketDetayKarti,
  type CuzdanHareketDetay,
} from '../../src/moduller/cuzdan/bilesenler/CuzdanHareketDetayKarti';
import {
  CuzdanLedgeriniGetir,
  type LedgerSatiri,
} from '../../src/moduller/cuzdan/okuma/CuzdanLedgeriniGetir';
import {
  YayinciKazancOzetiGetir,
  type YayinciKazancOzeti,
} from '../../src/moduller/cuzdan/yayinci/YayinciKazancApi';
import {
  ProfilIstatistikleriniGetir,
  type KullaniciProfilIstatistikleri,
} from '../../src/moduller/kullanici-profili/istatistik/ProfilIstatistikleriniGetir';
import { KillSwitchAktifMiSunucu } from '../../src/moduller/ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { CoinPaketMagazasiniOnYukle } from '../../src/moduller/cuzdan/katalog/CoinPaketOnYukleme';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  HeaderTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { DIL_LOCALE_MAP } from '../../src/i18n/diller';
import { useCeviri } from '../../src/i18n/useCeviri';

/** Cüzdanda gösterilen son hareket sayısı; tamamı /cuzdan/hareketler ekranında. */
const SON_HAREKET_LIMIT = 4;

/**
 * Manuel yenileme simülasyonu kısa tutulur: bakiye ağdan gelene kadar
 * düğme en az bu kadar döner, en fazla aşağıdaki süre beklenir.
 */
const EN_AZ_YENILEME_MS = 600;
const EN_FAZLA_BEKLEME_MS = 2500;
const YENILENDI_GOSTER_MS = 1400;

/**
 * Eski bildirim / deep link parametresi.
 * Hareketler, hediye geçmişi ve coin yükleme artık ayrı ekranlarda.
 */
function eskiSekmeYolu(deger: unknown): string | null {
  const s = Array.isArray(deger) ? deger[0] : deger;
  if (s === 'hareket') return '/cuzdan/hareketler';
  if (s === 'hediye') return '/cuzdan/hediye-gecmisi';
  if (s === 'yukle') return '/cuzdan/coin-yukle';
  return null;
}

export default function WalletScreen() {
  const { t, dil } = useCeviri();
  const locale = DIL_LOCALE_MAP[dil];
  const { user } = useAuth();
  const { wallet, refreshWallet } = useWallet();
  const params = useLocalSearchParams<{ sekme?: string | string[] }>();

  const [ledger, setLedger] = useState<LedgerSatiri[]>([]);
  const [stats, setStats] = useState<KullaniciProfilIstatistikleri | null>(null);
  const [yayinciOzet, setYayinciOzet] = useState<YayinciKazancOzeti | null>(null);
  const [purchaseLocked, setPurchaseLocked] = useState(false);
  const [detay, setDetay] = useState<CuzdanHareketDetay | null>(null);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [yenilendiGoster, setYenilendiGoster] = useState(false);
  const yenilemeSuruyor = useRef(false);

  const yenile = useCallback(
    async (iptalRef?: { current: boolean }) => {
      const iptal = () => iptalRef?.current === true;
      await refreshWallet();
      if (iptal()) return;

      void KillSwitchAktifMiSunucu('kill_coin_purchase').then((v) => {
        if (!iptal()) setPurchaseLocked(v);
      });

      CuzdanLedgeriniGetir(SON_HAREKET_LIMIT)
        .then((rows) => {
          if (!iptal()) setLedger(rows);
        })
        .catch(() => {
          if (!iptal()) setLedger([]);
        });

      if (!user?.id) return;

      YayinciKazancOzetiGetir()
        .then((o) => {
          if (!iptal()) setYayinciOzet(o);
        })
        .catch(() => {
          if (!iptal()) setYayinciOzet(null);
        });

      ProfilIstatistikleriniGetir(user.id)
        .then((s) => {
          if (!iptal()) setStats(s);
        })
        .catch(() => {
          if (!iptal()) setStats(null);
        });
    },
    [refreshWallet, user?.id],
  );

  /**
   * Manuel yenileme: düğme en az `EN_AZ_YENILEME_MS` döner,
   * ağ takılırsa `EN_FAZLA_BEKLEME_MS` sonunda bırakır (kalan istek arkada sürer).
   */
  const elleYenile = useCallback(async () => {
    if (yenilemeSuruyor.current) return;
    yenilemeSuruyor.current = true;
    setYenileniyor(true);
    const basla = Date.now();
    try {
      const iptalRef = { current: false };
      await Promise.race([
        yenile(iptalRef),
        new Promise<void>((coz) => setTimeout(coz, EN_FAZLA_BEKLEME_MS)),
      ]);
    } catch {
      /* ağ hatası — düğme yine de kısa sürede bırakılır */
    } finally {
      const kalan = EN_AZ_YENILEME_MS - (Date.now() - basla);
      if (kalan > 0) {
        await new Promise<void>((coz) => setTimeout(coz, kalan));
      }
      setYenileniyor(false);
      setYenilendiGoster(true);
      yenilemeSuruyor.current = false;
    }
  }, [yenile]);

  useEffect(() => {
    if (!yenilendiGoster) return;
    const zamanlayici = setTimeout(
      () => setYenilendiGoster(false),
      YENILENDI_GOSTER_MS,
    );
    return () => clearTimeout(zamanlayici);
  }, [yenilendiGoster]);

  useFocusEffect(
    useCallback(() => {
      const iptalRef = { current: false };
      // Önce bakiye; ağır sorgular etkileşim sonrası
      void refreshWallet();
      // Coin mağazası arka planda hazırlansın — /cuzdan/coin-yukle anında açılsın.
      CoinPaketMagazasiniOnYukle();
      const gorev = InteractionManager.runAfterInteractions(() => {
        if (iptalRef.current) return;
        void yenile(iptalRef);
      });
      return () => {
        iptalRef.current = true;
        gorev.cancel();
      };
    }, [yenile, refreshWallet]),
  );

  // Eski deep link: ?sekme=hareket|hediye|yukle → ilgili ekran
  useEffect(() => {
    const yol = eskiSekmeYolu(params.sekme);
    if (!yol) return;
    router.replace(yol as any);
  }, [params.sekme]);

  const ac = useCallback((yol: string) => {
    router.push(yol as any);
  }, []);

  const hediyeAlt = stats
    ? `${stats.total_gifts_sent.toLocaleString(locale)} ${t('cuzdan.gonderilen').toLocaleLowerCase(locale)} · ${stats.total_gifts_received.toLocaleString(locale)} ${t('cuzdan.alinan').toLocaleLowerCase(locale)}`
    : t('cuzdanY.hediyeKartAlt');

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="cuzdan">
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
            <YonluIkon yon="chevron-back" size={22} color={RenkTokenlari.text} />
          </Pressable>
          <View style={styles.baslikCopy}>
            <View style={styles.baslikSatir}>
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.baslikSimge}
              >
                <Ionicons name="wallet" size={15} color={RenkTokenlari.textOnPrimary} />
              </LinearGradient>
              <Text style={styles.baslik} numberOfLines={1} ellipsizeMode="tail">
                {t('cuzdanY.cuzdanim')}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              void elleYenile();
            }}
            disabled={yenileniyor}
            style={({ pressed }) => [styles.geri, pressed && styles.geriBasili]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('cuzdanY.yenile')}
            accessibilityState={{ busy: yenileniyor, disabled: yenileniyor }}
          >
            {yenileniyor ? (
              <ActivityIndicator size="small" color={RenkTokenlari.primarySoft} />
            ) : (
              <Ionicons name="refresh" size={20} color={RenkTokenlari.text} />
            )}
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={yenileniyor}
              onRefresh={() => {
                void elleYenile();
              }}
              tintColor={RenkTokenlari.primarySoft}
              colors={[RenkTokenlari.primary]}
              progressBackgroundColor={RenkTokenlari.bgCard}
            />
          }
        >
          <View style={styles.heroAlani}>
            <CuzdanHero
              wallet={wallet}
              purchaseLocked={purchaseLocked}
              onCoinYukle={() => ac('/cuzdan/coin-yukle')}
            />
            {yenilendiGoster ? (
              <View style={styles.yenilendiSatir}>
                <Ionicons
                  name="checkmark-circle"
                  size={13}
                  color={RenkTokenlari.mint}
                />
                <Text style={styles.yenilendiYazi}>
                  {t('cuzdanY.yenilendi')}
                </Text>
              </View>
            ) : null}
            {purchaseLocked ? (
              <Text style={styles.lockHint}>{t('cuzdanX.satinAlmaKapali')}</Text>
            ) : null}
          </View>

          <CuzdanBakiyeKartlari
            wallet={wallet}
            yayinciOzet={yayinciOzet}
            onYayinciKazanc={() => ac('/cuzdan/yayinci-kazanclari')}
          />

          <CuzdanErisimListesi
            hareketlerAlt={t('cuzdanY.hareketlerKartAlt')}
            hediyeAlt={hediyeAlt}
            onHareketler={() => ac('/cuzdan/hareketler')}
            onHediyeGecmisi={() => ac('/cuzdan/hediye-gecmisi')}
            onCoinYukle={() => ac('/cuzdan/coin-yukle')}
          />

          {ledger.length > 0 ? (
            <View style={styles.sonBolum}>
              <View style={styles.sonBaslikSatir}>
                <Text style={styles.sonBaslik}>{t('cuzdanY.sonHareketler')}</Text>
                <Pressable
                  onPress={() => ac('/cuzdan/hareketler')}
                  hitSlop={8}
                  style={({ pressed }) => [styles.tumuDugme, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.tumuYazi}>{t('cuzdanY.tumunuGor')}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={13}
                    color={RenkTokenlari.mint}
                  />
                </Pressable>
              </View>
              <View style={styles.liste}>
                {ledger.map((row) => (
                  <HareketSatiri
                    key={row.id}
                    row={row}
                    locale={locale}
                    onPress={() => setDetay({ tur: 'ledger', veri: row })}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <CuzdanBilgiBolumu />

          <View style={styles.altBilgiKap}>
            <OnemliBilgilendirmeKarti />
          </View>
        </ScrollView>
      </ModulHataSiniri>

      <CuzdanHareketDetayKarti detay={detay} onKapat={() => setDetay(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  baslikBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HeaderTokenlari.horizontal,
    paddingTop: HeaderTokenlari.paddingTop,
    paddingBottom: HeaderTokenlari.paddingBottom,
    gap: HeaderTokenlari.titleGapAfterBack,
  },
  geri: {
    width: HeaderTokenlari.touchTarget,
    height: HeaderTokenlari.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geriBasili: {
    opacity: 0.6,
  },
  baslikCopy: { flex: 1, minWidth: 0, alignItems: 'stretch', gap: 4 },
  baslikSimge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  baslik: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    lineHeight: 28,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
    letterSpacing: 0,
  },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    minWidth: 0,
    gap: 9,
  },
  scroll: {
    paddingTop: BoslukTokenlari.sm,
    paddingBottom: YUZEN_TAB_ICERIK_BOSLUGU,
    gap: BoslukTokenlari.xl,
  },
  heroAlani: { gap: BoslukTokenlari.sm },
  yenilendiSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  yenilendiYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontSize: 11,
    fontWeight: '800',
  },
  lockHint: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.warning,
    textAlign: 'center',
    marginHorizontal: BoslukTokenlari.xl,
  },
  sonBolum: {
    gap: BoslukTokenlari.sm,
    paddingHorizontal: 20,
  },
  sonBaslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: 2,
  },
  sonBaslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    letterSpacing: 1.4,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: 10,
    flex: 1,
  },
  tumuDugme: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tumuYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontSize: 11,
    fontWeight: '800',
  },
  liste: { gap: 2 },
  altBilgiKap: {
    paddingHorizontal: 20,
    gap: BoslukTokenlari.sm,
  },
});
