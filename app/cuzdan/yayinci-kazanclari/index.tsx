import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { EkranBasligi } from '../../../src/components/EkranBasligi';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../src/i18n/useCeviri';
import type { CeviriAnahtari } from '../../../src/i18n/useCeviri';
import { DIL_LOCALE_MAP } from '../../../src/i18n/diller';
import {
  DurumRengi,
  KazancDurumAnahtari,
  UsdYazi,
  YayinciItirazlarimGetir,
  YayinciKazancGrafikleriGetir,
  YayinciKazancKayitlariniGetir,
  YayinciKazancOzetiGetir,
  YayinciOdemeGecmisiniGetir,
  YayinciOdemeTalebiOlustur,
  YayinciProgramBasvuru,
  YayinciProgramDurumuGetir,
  type YayinciGrafikler,
  type YayinciItiraz,
  type YayinciKazancKaydi,
  type YayinciKazancOzeti,
  type YayinciOdemeGecmisi,
  type YayinciProgramDurumu,
} from '../../../src/moduller/cuzdan/yayinci/YayinciKazancApi';
import {
  CekimDurumunuHesapla,
  CekimHataAnahtari,
  CekimHataYonlendirmesi,
  YeniCekimAnahtari,
  type CekimDurumu,
} from '../../../src/moduller/cuzdan/yayinci/CekimKapisi';
import {
  OdemeProfiliGetir,
  type OdemeProfiliVerisi,
} from '../../../src/moduller/cuzdan/yayinci/OdemeProfiliApi';
import {
  BilgiKarti,
  CuzdanYasalBaglantiKarti,
  OnemliBilgilendirmeKarti,
} from '../../../src/moduller/cuzdan/bilesenler/CuzdanBilgiKartlari';

type Sekme = 'gecmis' | 'odemeler' | 'itirazlar';

function tarihYazi(iso: string | null | undefined, locale: string, saatli = false): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(saatli ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'UTC',
  });
}

function kanalAnahtari(channel: string | null | undefined): CeviriAnahtari {
  switch (channel) {
    case 'live':
      return 'yayinciK.kanalCanli';
    case 'voice_room':
      return 'yayinciK.kanalSesliOda';
    case 'post':
      return 'yayinciK.kanalGonderi';
    case 'message':
      return 'yayinciK.kanalMesaj';
    case 'call':
      return 'yayinciK.kanalArama';
    default:
      return 'yayinciK.kanalDiger';
  }
}

function coinKaynagiAnahtari(kaynak: string): CeviriAnahtari {
  switch (kaynak) {
    case 'purchased':
      return 'yayinciK.coinSatinAlinan';
    case 'game':
      return 'yayinciK.coinOyun';
    case 'bonus':
      return 'yayinciK.coinOdul';
    default:
      return 'yayinciK.kanalDiger';
  }
}

function itirazDurumAnahtari(durum: string): CeviriAnahtari {
  switch (durum) {
    case 'reviewing':
      return 'yayinciK.itirazDurumReviewing';
    case 'resolved':
      return 'yayinciK.itirazDurumResolved';
    case 'rejected':
      return 'yayinciK.itirazDurumRejected';
    default:
      return 'yayinciK.itirazDurumOpen';
  }
}

function HataKoduCevir(kod: string | undefined, t: (k: CeviriAnahtari) => string): string {
  switch (kod) {
    case 'adult_required':
      return t('yayinciK.hataYetiskin');
    case 'guest_not_allowed':
      return t('yayinciK.hataMisafir');
    case 'contract_missing':
      return t('yayinciK.hataSozlesme');
    default:
      return t('yayinciK.hata');
  }
}

export default function YayinciKazanclariEkrani() {
  const { t, dil } = useCeviri();
  const locale = DIL_LOCALE_MAP[dil];

  const [ozet, setOzet] = useState<YayinciKazancOzeti | null>(null);
  const [program, setProgram] = useState<YayinciProgramDurumu | null>(null);
  const [profil, setProfil] = useState<OdemeProfiliVerisi | null>(null);
  const [kayitlar, setKayitlar] = useState<YayinciKazancKaydi[]>([]);
  const [odemeler, setOdemeler] = useState<YayinciOdemeGecmisi[]>([]);
  const [grafik, setGrafik] = useState<YayinciGrafikler | null>(null);
  const [itirazlar, setItirazlar] = useState<YayinciItiraz[]>([]);
  const [sekme, setSekme] = useState<Sekme>('gecmis');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sozlesmeAcik, setSozlesmeAcik] = useState(false);

  const [ulkeKodu, setUlkeKodu] = useState('');
  const [vergiOnay, setVergiOnay] = useState(false);
  const [basvuruBusy, setBasvuruBusy] = useState(false);
  const [cekimBusy, setCekimBusy] = useState(false);
  /** Başarısız ağ denemesinde aynı talebi tekrar göndermek için sabit anahtar. */
  const cekimAnahtari = useRef<string | null>(null);

  const yukle = useCallback(async () => {
    setHata(null);
    try {
      const [o, p] = await Promise.all([
        YayinciKazancOzetiGetir(),
        YayinciProgramDurumuGetir(),
      ]);
      setOzet(o);
      setProgram(p);
      // Profil RPC'si henüz dağıtılmadıysa kapı uygulanmaz (null).
      setProfil(await OdemeProfiliGetir().catch(() => null));
      if (!ulkeKodu && p?.enrollment?.country_code) {
        setUlkeKodu(p.enrollment.country_code);
      }
      const [k, od, g, it] = await Promise.all([
        YayinciKazancKayitlariniGetir({ limit: 60 }).catch(() => []),
        YayinciOdemeGecmisiniGetir().catch(() => []),
        YayinciKazancGrafikleriGetir(30).catch(() => null),
        YayinciItirazlarimGetir().catch(() => []),
      ]);
      setKayitlar(k);
      setOdemeler(od);
      setGrafik(g);
      setItirazlar(it);
    } catch (e) {
      setHata(e instanceof Error ? e.message : t('yayinciK.yuklenemedi'));
    } finally {
      setYukleniyor(false);
      setYenileniyor(false);
    }
  }, [t, ulkeKodu]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const yenile = () => {
    setYenileniyor(true);
    void yukle();
  };

  const basvuruGonder = async () => {
    const kod = ulkeKodu.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(kod)) {
      Alert.alert(t('yayinciK.hata'), t('yayinciK.hataUlke'));
      return;
    }
    if (!vergiOnay) {
      Alert.alert(t('yayinciK.hata'), t('yayinciK.hataVergi'));
      return;
    }
    setBasvuruBusy(true);
    const r = await YayinciProgramBasvuru(kod, true);
    setBasvuruBusy(false);
    if (!r.ok) {
      Alert.alert(t('yayinciK.hata'), HataKoduCevir(r.kod, t));
      return;
    }
    setSozlesmeAcik(false);
    await yukle();
    if (!profil?.tamam) {
      Alert.alert(t('yayinciK.programBasvuruAlindi'), t('yayinciK.programBasvuruProfilUyari'), [
        { text: t('yayinciK.sonra'), style: 'cancel' },
        {
          text: t('yayinciK.profilBaslik'),
          onPress: () =>
            router.push('/cuzdan/yayinci-kazanclari/odeme-profili' as any),
        },
      ]);
    }
  };

  const durum = program?.eligibility;
  const programDurumu = program?.enrollment?.status ?? 'none';
  const onayli = programDurumu === 'approved';
  const basvurulabilir =
    !program?.enrollment ||
    ['withdrawn', 'rejected', 'suspended'].includes(programDurumu);

  const kpiHazir = ozet?.available_usd ?? 0;
  const kpiBekleyen = ozet?.pending_usd ?? 0;
  const kpiToplam = ozet?.lifetime_creator_usd ?? 0;
  const min = ozet?.payout_min_usd ?? 25;
  const kalan = ozet?.amount_to_minimum_usd ?? min;
  const ilerleme = min > 0 ? Math.min(1, kpiHazir / min) : 0;

  const cekimDurumu = useMemo(
    () => CekimDurumunuHesapla(durum, ozet, profil?.tamam),
    [durum, ozet, profil?.tamam],
  );

  const cekimYonlendir = (hedef: 'kimlik' | 'hesap' | 'profil') => {
    const yol =
      hedef === 'kimlik'
        ? '/cuzdan/yayinci-kazanclari/kimlik-dogrula'
        : hedef === 'hesap'
          ? '/cuzdan/yayinci-kazanclari/odeme-hesabi'
          : '/cuzdan/yayinci-kazanclari/odeme-profili';
    router.push(yol as any);
  };

  const cekimYonlendirmeEtiketi = (hedef: 'kimlik' | 'hesap' | 'profil'): CeviriAnahtari =>
    hedef === 'kimlik'
      ? 'verify.cekimKycGit'
      : hedef === 'hesap'
        ? 'verify.cekimHesapGit'
        : 'verify.cekimProfilGit';

  const cekimYonlendirmeBasligi = (hedef: 'kimlik' | 'hesap' | 'profil'): CeviriAnahtari =>
    hedef === 'kimlik'
      ? 'verify.cekimKimlikBaslik'
      : hedef === 'hesap'
        ? 'verify.cekimHesapBaslik'
        : 'verify.cekimProfilBaslik';

  /**
   * Para çekme talebi — doğrulama yoksa talebi hiç göndermeden Tamuso Verify'a
   * yönlendirir. Kapı sunucuda da (trigger) zorunludur; bu yalnızca UX katmanı.
   */
  const cekimTalebiOlustur = () => {
    if (cekimDurumu.yonlendirme) {
      const hedef = cekimDurumu.yonlendirme;
      Alert.alert(
        t(cekimDurumu.baslikAnahtari),
        t(cekimDurumu.metinAnahtari),
        [
          { text: t('yayinciK.vazgec'), style: 'cancel' },
          {
            text: t(cekimYonlendirmeEtiketi(hedef)),
            onPress: () => cekimYonlendir(hedef),
          },
        ],
      );
      return;
    }
    if (!cekimDurumu.talepOlusturulabilir || cekimBusy) return;

    const gonder = async () => {
      setCekimBusy(true);
      const anahtar = cekimAnahtari.current ?? YeniCekimAnahtari();
      cekimAnahtari.current = anahtar;
      const r = await YayinciOdemeTalebiOlustur(anahtar);
      setCekimBusy(false);
      if (!r.ok) {
        const yonlendirme = CekimHataYonlendirmesi(r.kod);
        if (yonlendirme) {
          Alert.alert(
            t(cekimYonlendirmeBasligi(yonlendirme)),
            t(CekimHataAnahtari(r.kod)),
            [
              { text: t('yayinciK.vazgec'), style: 'cancel' },
              {
                text: t(cekimYonlendirmeEtiketi(yonlendirme)),
                onPress: () => cekimYonlendir(yonlendirme),
              },
            ],
          );
          return;
        }
        Alert.alert(t('verify.cekimHataBaslik'), t(CekimHataAnahtari(r.kod)));
        return;
      }
      Alert.alert(t('verify.cekimBasariliBaslik'), t('verify.cekimBasariliMetin'));
      cekimAnahtari.current = null;
      await yukle();
    };

    Alert.alert(t('verify.cekimOnayBaslik'), t('verify.cekimOnayMetin'), [
      { text: t('yayinciK.vazgec'), style: 'cancel' },
      { text: t('verify.cekimOlustur'), onPress: () => void gonder() },
    ]);
  };

  const gunluk = useMemo(() => (grafik?.daily ?? []).slice(-14), [grafik]);
  const gunlukMax = useMemo(
    () => Math.max(0.0001, ...gunluk.map((d) => Number(d.creator_usd ?? 0))),
    [gunluk],
  );

  const kanalDagilimi = useMemo(() => {
    const entries = Object.entries(grafik?.by_channel ?? {}) as [string, number][];
    const toplam = entries.reduce((acc, [, v]) => acc + Number(v ?? 0), 0);
    return entries
      .filter(([, v]) => Number(v) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([k, v]) => ({
        kanal: k,
        tutar: Number(v),
        oran: toplam > 0 ? Number(v) / toplam : 0,
      }));
  }, [grafik]);

  const sekmeler: { id: Sekme; label: CeviriAnahtari; ikon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { id: 'gecmis', label: 'yayinciK.gecmis', ikon: 'receipt-outline' },
    { id: 'odemeler', label: 'yayinciK.odemeler', ikon: 'card-outline' },
    { id: 'itirazlar', label: 'yayinciK.itirazlarim', ikon: 'chatbubble-ellipses-outline' },
  ];

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title={t('yayinciK.baslik')}
        subtitle={t('yayinciK.altBaslik')}
        fallbackHref="/(tabs)/wallet"
        right={
          <Pressable
            onPress={() => router.push('/cuzdan/yayinci-kazanclari/odeme-profili' as any)}
            style={styles.ustAksiyon}
            hitSlop={8}
            accessibilityLabel={t('yayinciK.profilBaslik')}
          >
            <Ionicons name="id-card-outline" size={19} color={RenkTokenlari.text} />
          </Pressable>
        }
      />

      {yukleniyor ? (
        <View style={styles.merkez}>
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
          <Text style={styles.merkezYazi}>{t('yayinciK.yukleniyor')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={yenileniyor}
              onRefresh={yenile}
              tintColor={RenkTokenlari.primarySoft}
            />
          }
        >
          {hata ? (
            <View style={styles.hataKart}>
              <Ionicons name="alert-circle-outline" size={17} color={RenkTokenlari.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.hataYazi}>{t('yayinciK.yuklenemedi')}</Text>
                <Text style={styles.hataAlt} numberOfLines={2}>
                  {hata}
                </Text>
              </View>
              <Pressable onPress={yukle} style={styles.hataDugme}>
                <Text style={styles.hataDugmeYazi}>{t('yayinciK.yenidenDene')}</Text>
              </Pressable>
            </View>
          ) : null}

          {!onayli ? (
            <>
              <ProgramKarti
                programDurumu={programDurumu}
                program={program}
                basvurulabilir={basvurulabilir}
                ulkeKodu={ulkeKodu}
                setUlkeKodu={setUlkeKodu}
                vergiOnay={vergiOnay}
                setVergiOnay={setVergiOnay}
                basvuruBusy={basvuruBusy}
                onBasvuru={() => setSozlesmeAcik(true)}
                onSozlesmeAc={() => setSozlesmeAcik(true)}
              />
              <OdemeProfiliKarti
                profil={profil}
                onPress={() =>
                  router.push('/cuzdan/yayinci-kazanclari/odeme-profili' as any)
                }
              />
              <BilgiKarti
                baslikAnahtari="cuzdanBilgi.kartBaslikKazanc"
                metinAnahtari="cuzdanBilgi.kartMetinKazanc"
                ikon="trending-up-outline"
                renk={RenkTokenlari.mint}
                varsayilanAcik
              />
              <BilgiKarti
                baslikAnahtari="cuzdanBilgi.kartBaslikOdeme"
                metinAnahtari="cuzdanBilgi.kartMetinOdeme"
                ikon="calendar-outline"
                renk={RenkTokenlari.accent}
              />
            </>
          ) : (
            <>
              <HeroKart
                toplam={kpiToplam}
                hazir={kpiHazir}
                bekleyen={kpiBekleyen}
                incelemede={ozet?.on_hold_usd ?? 0}
                odemede={ozet?.in_payout_usd ?? 0}
                odendi={ozet?.paid_usd ?? 0}
                elmas={Number(ozet?.diamonds ?? 0)}
                sonrakiTarih={tarihYazi(ozet?.next_payout_date, locale)}
                min={min}
                kalan={kalan}
                ilerleme={ilerleme}
                locale={locale}
              />

              {ozet?.withdrawals_enabled === false ? (
                <View style={styles.hazirlikKart}>
                  <Ionicons
                    name="information-circle-outline"
                    size={17}
                    color={RenkTokenlari.accent}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.hazirlikBaslik}>
                      {t('yayinciK.odemeHazirlaniyorBaslik')}
                    </Text>
                    <Text style={styles.hazirlikMetin}>
                      {t('yayinciK.odemeHazirlaniyorMetin')}
                    </Text>
                  </View>
                </View>
              ) : null}

              <EligibilityKarti durum={durum} t={t} />

              <OdemeProfiliKarti
                profil={profil}
                onPress={() =>
                  router.push('/cuzdan/yayinci-kazanclari/odeme-profili' as any)
                }
              />

              <KimlikDogrulamaKarti
                durum={durum}
                t={t}
                onPress={() =>
                  router.push('/cuzdan/yayinci-kazanclari/kimlik-dogrula' as any)
                }
              />

              <CekimTalebiKarti
                karar={cekimDurumu}
                ozet={ozet}
                busy={cekimBusy}
                onPress={cekimTalebiOlustur}
                onYonlendir={cekimYonlendir}
              />

              <GrafikKarti
                gunluk={gunluk}
                gunlukMax={gunlukMax}
                kanalDagilimi={kanalDagilimi}
                locale={locale}
                t={t}
              />

              <View style={styles.hizliAksiyonlar}>
                <Pressable
                  style={styles.hizliBtn}
                  onPress={() => router.push('/cuzdan/yayinci-kazanclari/odeme-profili' as any)}
                >
                  <View style={[styles.hizliIkon, { backgroundColor: `${RenkTokenlari.accent}1F` }]}>
                    <Ionicons name="id-card-outline" size={16} color={RenkTokenlari.accent} />
                  </View>
                  <Text style={styles.hizliYazi}>{t('yayinciK.profilBaslik')}</Text>
                  <Ionicons name="chevron-forward" size={14} color={RenkTokenlari.textDim} />
                </Pressable>
                <Pressable
                  style={styles.hizliBtn}
                  onPress={() => router.push('/cuzdan/yayinci-kazanclari/itiraz' as any)}
                >
                  <View style={[styles.hizliIkon, { backgroundColor: `${RenkTokenlari.violet}1F` }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={RenkTokenlari.violet} />
                  </View>
                  <Text style={styles.hizliYazi}>{t('yayinciK.itirazOlustur')}</Text>
                  <Ionicons name="chevron-forward" size={14} color={RenkTokenlari.textDim} />
                </Pressable>
              </View>

              <View style={styles.sekmeSatir}>
                {sekmeler.map((s) => {
                  const aktif = sekme === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSekme(s.id)}
                      style={[styles.sekme, aktif && styles.sekmeAktif]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: aktif }}
                    >
                      <Ionicons
                        name={s.ikon}
                        size={14}
                        color={aktif ? RenkTokenlari.textOnPrimary : RenkTokenlari.textMuted}
                      />
                      <Text
                        style={[styles.sekmeYazi, aktif && styles.sekmeYaziAktif]}
                        numberOfLines={1}
                      >
                        {t(s.label)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {sekme === 'gecmis' ? (
                <KazancGecmisi kayitlar={kayitlar} locale={locale} t={t} />
              ) : null}
              {sekme === 'odemeler' ? (
                <OdemeGecmisi odemeler={odemeler} locale={locale} t={t} />
              ) : null}
              {sekme === 'itirazlar' ? (
                <ItirazListesi itirazlar={itirazlar} locale={locale} t={t} />
              ) : null}

              <BilgiKarti
                baslikAnahtari="cuzdanBilgi.kartBaslikKazanc"
                metinAnahtari="cuzdanBilgi.kartMetinKazanc"
                ikon="trending-up-outline"
                renk={RenkTokenlari.mint}
              />
              <BilgiKarti
                baslikAnahtari="cuzdanBilgi.kartBaslikOdeme"
                metinAnahtari="cuzdanBilgi.kartMetinOdeme"
                ikon="calendar-outline"
                renk={RenkTokenlari.accent}
              />
            </>
          )}

          <View style={styles.yasalSatir}>
            <CuzdanYasalBaglantiKarti />
          </View>

          <OnemliBilgilendirmeKarti />
        </ScrollView>
      )}

      <SozlesmeModal
        visible={sozlesmeAcik}
        program={program}
        onKapat={() => setSozlesmeAcik(false)}
        onKabul={basvuruGonder}
        busy={basvuruBusy}
        t={t}
      />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function ProgramKarti({
  programDurumu,
  program,
  basvurulabilir,
  ulkeKodu,
  setUlkeKodu,
  vergiOnay,
  setVergiOnay,
  basvuruBusy,
  onBasvuru,
  onSozlesmeAc,
}: {
  programDurumu: string;
  program: YayinciProgramDurumu | null;
  basvurulabilir: boolean;
  ulkeKodu: string;
  setUlkeKodu: (v: string) => void;
  vergiOnay: boolean;
  setVergiOnay: (v: boolean) => void;
  basvuruBusy: boolean;
  onBasvuru: () => void;
  onSozlesmeAc: () => void;
}) {
  const { t } = useCeviri();

  if (programDurumu === 'applied') {
    return (
      <View style={styles.bilgiBuyuk}>
        <Ionicons name="time-outline" size={22} color={RenkTokenlari.accent} />
        <Text style={styles.bilgiBuyukBaslik}>{t('yayinciK.programBekliyor')}</Text>
        <Text style={styles.bilgiBuyukMetin}>{t('yayinciK.programBekliyorAlt')}</Text>
      </View>
    );
  }

  if (programDurumu === 'suspended') {
    return (
      <View style={styles.bilgiBuyuk}>
        <Ionicons name="pause-circle-outline" size={22} color={RenkTokenlari.danger} />
        <Text style={styles.bilgiBuyukBaslik}>{t('yayinciK.programAskida')}</Text>
        <Text style={styles.bilgiBuyukMetin}>{t('yayinciK.programAskidaAlt')}</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[
        `${RenkTokenlari.primary}2E`,
        `${RenkTokenlari.violet}1A`,
        RenkTokenlari.bgCard,
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.basvuruKart}
    >
      <View style={styles.basvuruUst}>
        <View style={styles.basvuruIkon}>
          <Ionicons name="diamond" size={18} color={RenkTokenlari.primarySoft} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.basvuruBaslik}>{t('yayinciK.programKatil')}</Text>
          <Text style={styles.basvuruAlt}>{t('yayinciK.programAciklama')}</Text>
        </View>
      </View>

      {program?.contract ? (
        <Pressable
          onPress={onSozlesmeAc}
          style={({ pressed }) => [styles.sozlesmeSatir, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="document-text-outline" size={16} color={RenkTokenlari.accent} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.sozlesmeBaslik} numberOfLines={1}>
              {program.contract.title}
            </Text>
            <Text style={styles.sozlesmeAlt}>
              {t('yayinciK.sozlesmeSurum', { surum: program.contract.version })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={RenkTokenlari.textDim} />
        </Pressable>
      ) : null}

      {basvurulabilir ? (
        <>
          <View style={styles.alan}>
            <Text style={styles.alanEtiket}>{t('yayinciK.ulkeKodu')}</Text>
            <TextInput
              value={ulkeKodu}
              onChangeText={(v) => setUlkeKodu(v.toUpperCase().slice(0, 2))}
              placeholder="TR"
              placeholderTextColor={RenkTokenlari.textDim}
              autoCapitalize="characters"
              maxLength={2}
              style={styles.girdi}
            />
          </View>

          <Pressable
            onPress={() => setVergiOnay(!vergiOnay)}
            style={styles.onaySatir}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: vergiOnay }}
          >
            <View style={[styles.onayKutu, vergiOnay && styles.onayKutuAktif]}>
              {vergiOnay ? (
                <Ionicons name="checkmark" size={13} color={RenkTokenlari.textOnPrimary} />
              ) : null}
            </View>
            <Text style={styles.onayYazi}>{t('yayinciK.vergiOnay')}</Text>
          </Pressable>

          <Pressable
            onPress={onBasvuru}
            disabled={basvuruBusy}
            style={({ pressed }) => [
              styles.basvuruDugme,
              (pressed || basvuruBusy) && { opacity: 0.75 },
            ]}
          >
            {basvuruBusy ? (
              <ActivityIndicator color={RenkTokenlari.textOnPrimary} size="small" />
            ) : (
              <>
                <Text style={styles.basvuruDugmeYazi}>{t('yayinciK.programBasvuru')}</Text>
                <Ionicons name="arrow-forward" size={15} color={RenkTokenlari.textOnPrimary} />
              </>
            )}
          </Pressable>
          <Text style={styles.basvuruNot}>{t('yayinciK.sozlesmeOnayNotu')}</Text>
        </>
      ) : null}
    </LinearGradient>
  );
}

function HeroKart({
  toplam,
  hazir,
  bekleyen,
  incelemede,
  odemede,
  odendi,
  elmas,
  sonrakiTarih,
  min,
  kalan,
  ilerleme,
  locale,
}: {
  toplam: number;
  hazir: number;
  bekleyen: number;
  incelemede: number;
  odemede: number;
  odendi: number;
  elmas: number;
  sonrakiTarih: string;
  min: number;
  kalan: number;
  ilerleme: number;
  locale: string;
}) {
  const { t } = useCeviri();
  const minUlasildi = kalan <= 0;

  return (
    <LinearGradient
      colors={[
        RenkTokenlari.primary,
        RenkTokenlari.magenta,
        RenkTokenlari.violet,
      ]}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View pointerEvents="none" style={styles.heroIsik} />
      <View style={styles.heroUst}>
        <Text style={styles.heroEtiket}>{t('yayinciK.toplamKazanc')}</Text>
        <View style={styles.heroElmas}>
          <Ionicons name="diamond" size={11} color={RenkTokenlari.accent} />
          <Text style={styles.heroElmasYazi}>
            {elmas.toLocaleString(locale)} {t('yayinciK.elmasKisa')}
          </Text>
        </View>
      </View>
      <Text style={styles.heroTutar} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {UsdYazi(toplam)}
      </Text>
      <Text style={styles.heroAlt}>{t('yayinciK.toplamKazancAlt')}</Text>

      <View style={styles.heroGrid}>
        <View style={styles.heroHucre}>
          <Text style={styles.heroHucreEtiket}>{t('yayinciK.odemeyeHazir')}</Text>
          <Text style={styles.heroHucreDeger} numberOfLines={1} adjustsFontSizeToFit>
            {UsdYazi(hazir)}
          </Text>
        </View>
        <View style={styles.heroHucre}>
          <Text style={styles.heroHucreEtiket}>{t('yayinciK.bekleyenKazanc')}</Text>
          <Text style={styles.heroHucreDeger} numberOfLines={1} adjustsFontSizeToFit>
            {UsdYazi(bekleyen)}
          </Text>
        </View>
      </View>

      <View style={styles.heroGrid}>
        <View style={styles.heroHucreKucuk}>
          <Text style={styles.heroKucukEtiket}>{t('yayinciK.incelemede')}</Text>
          <Text style={styles.heroKucukDeger}>{UsdYazi(incelemede)}</Text>
        </View>
        <View style={styles.heroHucreKucuk}>
          <Text style={styles.heroKucukEtiket}>{t('yayinciK.odemede')}</Text>
          <Text style={styles.heroKucukDeger}>{UsdYazi(odemede)}</Text>
        </View>
        <View style={styles.heroHucreKucuk}>
          <Text style={styles.heroKucukEtiket}>{t('yayinciK.odendi')}</Text>
          <Text style={styles.heroKucukDeger}>{UsdYazi(odendi)}</Text>
        </View>
      </View>

      <View style={styles.heroTakvim}>
        <View style={styles.heroTakvimSol}>
          <Ionicons name="calendar" size={13} color={RenkTokenlari.accent} />
          <Text style={styles.heroTakvimYazi} numberOfLines={1}>
            {t('yayinciK.sonrakiOdeme')}: {sonrakiTarih}
          </Text>
        </View>
        <Text style={styles.heroTakvimMin}>{t('yayinciK.minimumKisa', { tutar: UsdYazi(min) })}</Text>
      </View>

      <View style={styles.ilerlemeKap}>
        <View style={styles.ilerlemeUst}>
          <Text style={styles.ilerlemeYazi}>
            {minUlasildi
              ? t('yayinciK.minUlasildi')
              : t('yayinciK.minKalan', { tutar: UsdYazi(kalan) })}
          </Text>
          <Text style={styles.ilerlemeYuzde}>{Math.round(ilerleme * 100)}%</Text>
        </View>
        <View style={styles.ilerlemeRay}>
          <View style={[styles.ilerlemeDolu, { width: `${Math.max(2, ilerleme * 100)}%` }]} />
        </View>
      </View>
    </LinearGradient>
  );
}

function EligibilityKarti({
  durum,
  t,
}: {
  durum: YayinciKazancOzeti['eligibility'] | undefined;
  t: (k: CeviriAnahtari) => string;
}) {
  if (!durum) return null;
  const satirlar: { label: CeviriAnahtari; ok: boolean }[] = [
    { label: 'yayinciK.uygunlukYetiskin', ok: durum.is_adult },
    { label: 'yayinciK.uygunlukProgram', ok: durum.program_approved },
    { label: 'yayinciK.uygunlukKyc', ok: durum.kyc_verified },
    { label: 'yayinciK.uygunlukHesap', ok: durum.payout_account_verified },
    { label: 'yayinciK.uygunlukVergi', ok: durum.tax_complete },
    { label: 'yayinciK.uygunlukRisk', ok: !durum.open_high_risk },
  ];
  const tamam = satirlar.filter((s) => s.ok).length;

  return (
    <View style={styles.uygunlukKart}>
      <View style={styles.uygunlukUst}>
        <Text style={styles.uygunlukBaslik}>{t('yayinciK.uygunlukBaslik')}</Text>
        <View style={[styles.uygunlukRozet, { backgroundColor: `${tamam === satirlar.length ? RenkTokenlari.mint : RenkTokenlari.accent}1F` }]}>
          <Text
            style={[
              styles.uygunlukRozetYazi,
              { color: tamam === satirlar.length ? RenkTokenlari.mint : RenkTokenlari.accent },
            ]}
          >
            {tamam}/{satirlar.length}
          </Text>
        </View>
      </View>
      {satirlar.map((s) => (
        <View key={s.label} style={styles.uygunlukSatir}>
          <Ionicons
            name={s.ok ? 'checkmark-circle' : 'ellipse-outline'}
            size={15}
            color={s.ok ? RenkTokenlari.mint : RenkTokenlari.textDim}
          />
          <Text style={[styles.uygunlukYazi, !s.ok && styles.uygunlukYaziEksik]}>{t(s.label)}</Text>
          <Text style={[styles.uygunlukDurum, { color: s.ok ? RenkTokenlari.mint : RenkTokenlari.textDim }]}>
            {s.ok ? t('yayinciK.uygunlukTamam') : t('yayinciK.uygunlukEksik')}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Banka + vergi + şirket evrakları tek ekranda toplanır. */
function OdemeProfiliKarti({
  profil,
  onPress,
}: {
  profil: OdemeProfiliVerisi | null;
  onPress: () => void;
}) {
  const { t } = useCeviri();
  const tamam = Boolean(profil?.tamam);
  const durum = profil?.status ?? 'incomplete';
  const renk =
    durum === 'verified'
      ? RenkTokenlari.mint
      : durum === 'submitted'
        ? RenkTokenlari.violet
        : durum === 'rejected'
          ? RenkTokenlari.danger
          : tamam
            ? RenkTokenlari.mint
            : RenkTokenlari.accent;
  const durumYazi =
    durum === 'verified'
      ? t('yayinciK.profilDurumDogrulandi')
      : durum === 'submitted'
        ? t('yayinciK.profilDurumIncelemede')
        : durum === 'rejected'
          ? t('yayinciK.profilDurumReddedildi')
          : tamam
            ? t('yayinciK.profilDurumHazir')
            : t('yayinciK.profilDurumEksik');

  const eksik = (profil?.eksikler ?? []).filter((e) => e !== 'profil');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.kimlikKart,
        { borderColor: `${renk}44` },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={[styles.kimlikIkon, { backgroundColor: `${renk}1F` }]}>
        <Ionicons
          name={tamam ? 'shield-checkmark' : 'id-card-outline'}
          size={19}
          color={renk}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={styles.kimlikBaslik}>
          {t(tamam ? 'yayinciK.profilKartTamam' : 'yayinciK.profilKartEksik')}
        </Text>
        <Text style={styles.kimlikMetin} numberOfLines={2}>
          {profil
            ? eksik.length
              ? t('yayinciK.profilKartEksikAlt', { sayi: eksik.length })
              : t('yayinciK.profilKartTamamAlt')
            : t('yayinciK.profilTekYerNotu')}
        </Text>
      </View>
      <View style={[styles.durumCip, { backgroundColor: `${renk}1F` }]}>
        <Text style={[styles.durumCipYazi, { color: renk }]}>{durumYazi}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={RenkTokenlari.textDim} />
    </Pressable>
  );
}

function KimlikDogrulamaKarti({
  durum,
  onPress,
  t,
}: {
  durum: YayinciKazancOzeti['eligibility'] | undefined;
  t: (k: CeviriAnahtari) => string;
  onPress: () => void;
}) {
  const tamam = Boolean(durum?.kyc_verified);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.kimlikKart,
        tamam && styles.kimlikKartTamam,
        pressed && { opacity: 0.8 },
      ]}
    >
      <View
        style={[
          styles.kimlikIkon,
          { backgroundColor: tamam ? `${RenkTokenlari.mint}1F` : `${RenkTokenlari.accent}1F` },
        ]}
      >
        <Ionicons
          name={tamam ? 'shield-checkmark' : 'shield-outline'}
          size={19}
          color={tamam ? RenkTokenlari.mint : RenkTokenlari.accent}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.kimlikBaslik}>
          {t(tamam ? 'yayinciK.kimlikTamam' : 'yayinciK.kimlikBaslik')}
        </Text>
        <Text style={styles.kimlikMetin} numberOfLines={tamam ? 1 : 3}>
          {t(tamam ? 'yayinciK.uygunlukKyc' : 'yayinciK.kimlikMetin')}
        </Text>
      </View>
      <Ionicons
        name={tamam ? 'checkmark-circle' : 'chevron-forward'}
        size={tamam ? 18 : 15}
        color={tamam ? RenkTokenlari.mint : RenkTokenlari.textDim}
      />
    </Pressable>
  );
}

function cekimToneRengi(karar: CekimDurumu): string {
  switch (karar.ton) {
    case 'basari':
      return RenkTokenlari.mint;
    case 'uyari':
      return RenkTokenlari.accent;
    case 'engel':
      return RenkTokenlari.danger;
    default:
      return RenkTokenlari.violet;
  }
}

/**
 * Para çekme talebi kartı.
 *
 * Doğrulama yoksa buton "Kimliğimi doğrula" olur ve kullanıcı Tamuso Verify
 * akışına gider; talep sunucuya hiç gönderilmez.
 */
function CekimTalebiKarti({
  karar,
  ozet,
  busy,
  onPress,
  onYonlendir,
}: {
  karar: CekimDurumu;
  ozet: YayinciKazancOzeti | null;
  busy: boolean;
  onPress: () => void;
  onYonlendir: (hedef: 'kimlik' | 'hesap' | 'profil') => void;
}) {
  const { t } = useCeviri();
  const renk = cekimToneRengi(karar);
  const butonEtiket =
    karar.yonlendirme === 'kimlik'
      ? t('verify.cekimKycGit')
      : karar.yonlendirme === 'hesap'
        ? t('verify.cekimHesapGit')
        : karar.yonlendirme === 'profil'
          ? t('verify.cekimProfilGit')
          : karar.talepOlusturulabilir
            ? t('verify.cekimOlustur')
            : null;

  const eylem = () => {
    if (karar.yonlendirme) onYonlendir(karar.yonlendirme);
    else onPress();
  };

  return (
    <View style={[styles.cekimKart, { borderColor: `${renk}44` }]}>
      <View style={styles.cekimUst}>
        <View style={[styles.cekimIkon, { backgroundColor: `${renk}1F` }]}>
          <Ionicons
            name={
              karar.talepOlusturulabilir
                ? 'cash-outline'
                : karar.kod === 'acik_talep'
                  ? 'time-outline'
                  : 'lock-closed-outline'
            }
            size={19}
            color={renk}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={styles.cekimBaslik}>{t(karar.baslikAnahtari)}</Text>
          <Text style={styles.cekimMetin}>{t(karar.metinAnahtari)}</Text>
        </View>
      </View>

      {karar.talepOlusturulabilir && ozet ? (
        <View style={styles.cekimTutarSatir}>
          <Text style={styles.cekimTutarEtiket}>{t('verify.cekimHazirTutar')}</Text>
          <Text style={[styles.cekimTutar, { color: renk }]}>
            {UsdYazi(ozet.available_usd)}
          </Text>
        </View>
      ) : null}

      {butonEtiket ? (
        <Pressable
          onPress={eylem}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cekimDugme,
            { backgroundColor: renk },
            (pressed || busy) && { opacity: 0.75 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={RenkTokenlari.textOnPrimary} size="small" />
          ) : (
            <>
              <Text style={styles.cekimDugmeYazi}>{butonEtiket}</Text>
              <Ionicons
                name={karar.yonlendirme ? 'chevron-forward' : 'arrow-up-circle-outline'}
                size={15}
                color={RenkTokenlari.textOnPrimary}
              />
            </>
          )}
        </Pressable>
      ) : null}

      <Text style={styles.cekimNot}>{t('verify.cekimGuvenlikNotu')}</Text>
    </View>
  );
}

function GrafikKarti({
  gunluk,
  gunlukMax,
  kanalDagilimi,
  locale,
  t,
}: {
  gunluk: { day: string; creator_usd: number }[];
  gunlukMax: number;
  kanalDagilimi: { kanal: string; tutar: number; oran: number }[];
  locale: string;
  t: (k: CeviriAnahtari) => string;
}) {
  return (
    <View style={styles.grafikKart}>
      <View style={styles.grafikUst}>
        <Text style={styles.grafikBaslik}>{t('yayinciK.grafikGunluk')}</Text>
        <Text style={styles.grafikAlt}>{t('yayinciK.grafikSon14')}</Text>
      </View>
      <View style={styles.grafikAlan}>
        {gunluk.map((d) => {
          const oran = Math.max(0.02, Number(d.creator_usd ?? 0) / gunlukMax);
          const boy = Math.round(78 * oran);
          return (
            <View key={d.day} style={styles.grafikKolon}>
              <Text style={styles.grafikDeger} numberOfLines={1}>
                {Number(d.creator_usd) > 0 ? `$${Number(d.creator_usd).toFixed(2)}` : ''}
              </Text>
              <View style={styles.grafikCubukKap}>
                <LinearGradient
                  colors={[RenkTokenlari.primarySoft, RenkTokenlari.violet]}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 0, y: 0 }}
                  style={[styles.grafikCubuk, { height: boy }]}
                />
              </View>
              <Text style={styles.grafikGun} numberOfLines={1}>
                {new Date(`${d.day}T00:00:00Z`).toLocaleDateString(locale, {
                  day: '2-digit',
                  timeZone: 'UTC',
                })}
              </Text>
            </View>
          );
        })}
      </View>

      {kanalDagilimi.length ? (
        <>
          <View style={styles.grafikAyrac} />
          <Text style={styles.grafikBaslik}>{t('yayinciK.kanalDagilimi')}</Text>
          {kanalDagilimi.slice(0, 5).map((k) => (
            <View key={k.kanal} style={styles.kanalSatir}>
              <Text style={styles.kanalAd} numberOfLines={1}>
                {t(kanalAnahtari(k.kanal))}
              </Text>
              <View style={styles.kanalRay}>
                <View style={[styles.kanalDolu, { width: `${Math.max(3, k.oran * 100)}%` }]} />
              </View>
              <Text style={styles.kanalTutar}>{UsdYazi(k.tutar)}</Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

function KazancGecmisi({
  kayitlar,
  locale,
  t,
}: {
  kayitlar: YayinciKazancKaydi[];
  locale: string;
  t: (k: CeviriAnahtari) => string;
}) {
  if (!kayitlar.length) {
    return <Text style={styles.bosYazi}>{t('yayinciK.gelirYok')}</Text>;
  }
  return (
    <View style={styles.listeKap}>
      {kayitlar.map((k) => {
        const gelirUygun = k.eligible && k.coin_source === 'purchased';
        const durumRenk = DurumRengi(k.status, RenkTokenlari);
        return (
          <View key={k.id} style={styles.satir}>
            <View style={styles.satirIkon}>
              <Ionicons
                name={gelirUygun ? 'gift' : 'gift-outline'}
                size={16}
                color={gelirUygun ? RenkTokenlari.mint : RenkTokenlari.textDim}
              />
            </View>
            <View style={styles.satirCopy}>
              <Text style={styles.satirBaslik} numberOfLines={1}>
                {gelirUygun ? t('yayinciK.gelireUygunHediye') : t('yayinciK.sosyalHediye')}
              </Text>
              <Text style={styles.satirMeta} numberOfLines={2}>
                {t(kanalAnahtari(k.channel))}
                {k.payer_name ? ` · ${k.payer_name}` : ''}
                {' · '}
                {tarihYazi(k.created_at, locale, true)}
              </Text>
              <View style={styles.satirEtiketler}>
                <View style={[styles.durumCip, { backgroundColor: `${durumRenk}1F` }]}>
                  <Text style={[styles.durumCipYazi, { color: durumRenk }]}>
                    {t(KazancDurumAnahtari(k.status))}
                  </Text>
                </View>
                <Text style={styles.kaynakYazi}>{t(coinKaynagiAnahtari(k.coin_source))}</Text>
              </View>
            </View>
            <View style={styles.satirSag}>
              <Text
                style={[
                  styles.satirTutar,
                  { color: gelirUygun ? RenkTokenlari.mint : RenkTokenlari.textDim },
                ]}
              >
                {gelirUygun ? UsdYazi(k.net_usd) : UsdYazi(0)}
              </Text>
              <Text style={styles.satirCoin}>{k.coins.toLocaleString(locale)} coin</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function OdemeGecmisi({
  odemeler,
  locale,
  t,
}: {
  odemeler: YayinciOdemeGecmisi[];
  locale: string;
  t: (k: CeviriAnahtari) => string;
}) {
  if (!odemeler.length) {
    return <Text style={styles.bosYazi}>{t('yayinciK.odemeYok')}</Text>;
  }
  return (
    <View style={styles.listeKap}>
      {odemeler.map((o) => {
        const renk =
          o.status === 'paid'
            ? RenkTokenlari.mint
            : o.status === 'failed'
              ? RenkTokenlari.danger
              : RenkTokenlari.accent;
        return (
          <View key={o.id} style={styles.satir}>
            <View style={styles.satirIkon}>
              <Ionicons name="checkmark-done-outline" size={16} color={renk} />
            </View>
            <View style={styles.satirCopy}>
              <Text style={styles.satirBaslik} numberOfLines={1}>
                {o.period_month?.slice(0, 7)} · {UsdYazi(o.net_usd)}
              </Text>
              <Text style={styles.satirMeta} numberOfLines={2}>
                {t('yayinciK.odemeTarihi')}: {tarihYazi(o.payout_date, locale)}
                {o.iban_masked ? ` · ${o.iban_masked}` : ''}
              </Text>
              {o.external_reference ? (
                <Text style={styles.satirMeta} numberOfLines={1}>
                  {t('yayinciK.islemReferansi')}: {o.external_reference}
                </Text>
              ) : null}
            </View>
            <View style={[styles.durumCip, { backgroundColor: `${renk}1F` }]}>
              <Text style={[styles.durumCipYazi, { color: renk }]}>
                {o.status === 'paid'
                  ? t('yayinciK.durumOdendi')
                  : o.status === 'failed'
                    ? t('yayinciK.hata')
                    : t('yayinciK.durumOdemede')}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ItirazListesi({
  itirazlar,
  locale,
  t,
}: {
  itirazlar: YayinciItiraz[];
  locale: string;
  t: (k: CeviriAnahtari) => string;
}) {
  if (!itirazlar.length) {
    return (
      <View style={styles.bosKutu}>
        <Text style={styles.bosYazi}>{t('yayinciK.itirazYok')}</Text>
        <Pressable
          onPress={() => router.push('/cuzdan/yayinci-kazanclari/itiraz' as any)}
          style={styles.bosDugme}
        >
          <Text style={styles.bosDugmeYazi}>{t('yayinciK.itirazOlustur')}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.listeKap}>
      {itirazlar.map((i) => (
        <View key={i.id} style={styles.satir}>
          <View style={styles.satirIkon}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={RenkTokenlari.violet} />
          </View>
          <View style={styles.satirCopy}>
            <Text style={styles.satirBaslik} numberOfLines={1}>
              {i.subject}
            </Text>
            <Text style={styles.satirMeta} numberOfLines={2}>
              {i.body}
            </Text>
            <Text style={styles.satirMeta}>{tarihYazi(i.created_at, locale, true)}</Text>
          </View>
          <View style={styles.durumCip}>
            <Text style={styles.durumCipYazi}>{t(itirazDurumAnahtari(i.status))}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SozlesmeModal({
  visible,
  program,
  onKapat,
  onKabul,
  busy,
  t,
}: {
  visible: boolean;
  program: YayinciProgramDurumu | null;
  onKapat: () => void;
  onKabul: () => void;
  busy: boolean;
  t: (k: CeviriAnahtari) => string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onKapat}>
      <View style={styles.modalArka}>
        <View style={styles.modalKart}>
          <View style={styles.modalUst}>
            <Text style={styles.modalBaslik} numberOfLines={2}>
              {program?.contract?.title ?? t('yayinciK.sozlesmeBaslik')}
            </Text>
            <Pressable onPress={onKapat} hitSlop={8}>
              <Ionicons name="close" size={20} color={RenkTokenlari.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalGovde} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalMetin}>
              {program?.contract?.summary_md ?? t('yayinciK.sozlesmeOzet')}
            </Text>
          </ScrollView>
          <View style={styles.modalDugmeler}>
            <Pressable onPress={onKapat} style={[styles.modalBtn, styles.modalBtnIkincil]}>
              <Text style={styles.modalBtnIkincilYazi}>{t('yayinciK.vazgec')}</Text>
            </Pressable>
            <Pressable
              onPress={onKabul}
              disabled={busy}
              style={({ pressed }) => [
                styles.modalBtn,
                styles.modalBtnAna,
                (pressed || busy) && { opacity: 0.75 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={RenkTokenlari.textOnPrimary} size="small" />
              ) : (
                <Text style={styles.modalBtnAnaYazi}>{t('yayinciK.sozlesmeKabulEt')}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  merkez: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  merkezYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  ustAksiyon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  hataKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.danger}44`,
    backgroundColor: `${RenkTokenlari.danger}12`,
  },
  hataYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '700', fontSize: 13 },
  hataAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 10 },
  hataDugme: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: `${RenkTokenlari.danger}22`,
  },
  hataDugmeYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.danger, fontSize: 10, fontWeight: '800' },

  hazirlikKart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.accent}40`,
    backgroundColor: `${RenkTokenlari.accent}12`,
  },
  hazirlikBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontSize: 12,
    fontWeight: '800',
  },
  hazirlikMetin: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10.5,
    lineHeight: 15,
  },

  hero: {
    borderRadius: YaricapTokenlari.xl,
    padding: 20,
    gap: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroIsik: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -130,
    right: -70,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnPrimary,
    opacity: 0.72,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  heroElmas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  heroElmasYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textOnPrimary, fontSize: 9.5, fontWeight: '700' },
  heroTutar: {
    color: RenkTokenlari.textOnPrimary,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
  heroAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textOnPrimary, opacity: 0.6, fontSize: 10 },
  heroGrid: { flexDirection: 'row', gap: 10, marginTop: 10 },
  heroHucre: {
    flex: 1,
    minWidth: 0,
    padding: 11,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    gap: 2,
  },
  heroHucreEtiket: { ...TipografiTokenlari.micro, color: RenkTokenlari.textOnPrimary, opacity: 0.72, fontSize: 9.5 },
  heroHucreDeger: { color: RenkTokenlari.textOnPrimary, fontSize: 19, fontWeight: '900', letterSpacing: -0.4 },
  heroHucreKucuk: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  heroKucukEtiket: { ...TipografiTokenlari.micro, color: RenkTokenlari.textOnPrimary, opacity: 0.6, fontSize: 8.5 },
  heroKucukDeger: { color: RenkTokenlari.textOnPrimary, fontSize: 12, fontWeight: '800' },
  heroTakvim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  heroTakvimSol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  heroTakvimYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textOnPrimary, fontSize: 10.5, flexShrink: 1 },
  heroTakvimMin: { ...TipografiTokenlari.micro, color: RenkTokenlari.accent, fontSize: 9.5, fontWeight: '800' },
  ilerlemeKap: { gap: 5, marginTop: 8 },
  ilerlemeUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ilerlemeYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textOnPrimary, opacity: 0.78, fontSize: 9.5 },
  ilerlemeYuzde: { ...TipografiTokenlari.micro, color: RenkTokenlari.textOnPrimary, fontSize: 9.5, fontWeight: '800' },
  ilerlemeRay: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.28)',
    overflow: 'hidden',
  },
  ilerlemeDolu: { height: '100%', borderRadius: 3, backgroundColor: RenkTokenlari.accent },

  uygunlukKart: {
    gap: 7,
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  uygunlukUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  uygunlukBaslik: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '800', fontSize: 13 },
  uygunlukRozet: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: YaricapTokenlari.pill },
  uygunlukRozetYazi: { ...TipografiTokenlari.micro, fontSize: 9.5, fontWeight: '800' },
  uygunlukSatir: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  uygunlukYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 11, flex: 1 },
  uygunlukYaziEksik: { color: RenkTokenlari.textDim },
  uygunlukDurum: { ...TipografiTokenlari.micro, fontSize: 9, fontWeight: '700' },

  kimlikKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.accent}44`,
  },
  kimlikKartTamam: { borderColor: `${RenkTokenlari.mint}44` },
  kimlikIkon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kimlikBaslik: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '800', fontSize: 13 },
  kimlikMetin: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10.5,
    lineHeight: 14,
  },

  cekimKart: {
    gap: 11,
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
  },
  cekimUst: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  cekimIkon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cekimBaslik: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '800', fontSize: 13 },
  cekimMetin: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10.5,
    lineHeight: 15,
  },
  cekimTutarSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.surface,
  },
  cekimTutarEtiket: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10.5, fontWeight: '700' },
  cekimTutar: { ...TipografiTokenlari.caption, fontSize: 15, fontWeight: '900' },
  cekimDugme: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.pill,
  },
  cekimDugmeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '900',
    fontSize: 13,
  },
  cekimNot: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 8.5,
    lineHeight: 12,
    textAlign: 'center',
  },

  grafikKart: {
    gap: 9,
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  grafikUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grafikBaslik: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '800', fontSize: 13 },
  grafikAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 9.5 },
  grafikAlan: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 118, marginTop: 4 },
  grafikKolon: { flex: 1, alignItems: 'center', gap: 2 },
  grafikDeger: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 7.5 },
  grafikCubukKap: { height: 82, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  grafikCubuk: { width: '68%', borderRadius: 4, minHeight: 2 },
  grafikGun: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 8 },
  grafikAyrac: { height: StyleSheet.hairlineWidth, backgroundColor: RenkTokenlari.border, marginVertical: 3 },
  kanalSatir: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 },
  kanalAd: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10, width: 74 },
  kanalRay: { flex: 1, height: 5, borderRadius: 3, backgroundColor: RenkTokenlari.surface, overflow: 'hidden' },
  kanalDolu: { height: '100%', borderRadius: 3, backgroundColor: RenkTokenlari.primarySoft },
  kanalTutar: { ...TipografiTokenlari.micro, color: RenkTokenlari.text, fontSize: 9.5, fontWeight: '700', width: 62, textAlign: 'right' },

  hizliAksiyonlar: { flexDirection: 'row', gap: 9 },
  hizliBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 11,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  hizliIkon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  hizliYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.text, fontSize: 10.5, fontWeight: '700', flex: 1 },

  sekmeSatir: { flexDirection: 'row', gap: 6, marginTop: 2 },
  sekme: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
  },
  sekmeAktif: { backgroundColor: RenkTokenlari.primary },
  sekmeYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10, fontWeight: '700', flexShrink: 1 },
  sekmeYaziAktif: { color: RenkTokenlari.textOnPrimary, fontWeight: '900' },

  listeKap: { gap: 7 },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  satirIkon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  satirCopy: { flex: 1, minWidth: 0, gap: 2 },
  satirBaslik: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '700', fontSize: 12 },
  satirMeta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 9.5 },
  satirEtiketler: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  durumCip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: YaricapTokenlari.pill, backgroundColor: RenkTokenlari.surface },
  durumCipYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 8.5, fontWeight: '800' },
  kaynakYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 8.5 },
  satirSag: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  satirTutar: { ...TipografiTokenlari.caption, fontWeight: '900', fontSize: 12.5 },
  satirCoin: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 8.5 },
  bosYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 18,
  },
  bosKutu: { gap: 8, alignItems: 'center' },
  bosDugme: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: `${RenkTokenlari.primarySoft}22`,
  },
  bosDugmeYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.primarySoft, fontSize: 11, fontWeight: '800' },

  basvuruKart: {
    gap: 13,
    padding: 16,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.primarySoft}33`,
    overflow: 'hidden',
  },
  basvuruUst: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  basvuruIkon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${RenkTokenlari.primarySoft}22`,
  },
  basvuruBaslik: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, fontSize: 16 },
  basvuruAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  sozlesmeSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 11,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.surface,
  },
  sozlesmeBaslik: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '700', fontSize: 12 },
  sozlesmeAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 9.5 },
  alan: { gap: 5 },
  alanEtiket: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10, fontWeight: '700' },
  girdi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  onaySatir: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  onayKutu: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onayKutuAktif: { backgroundColor: RenkTokenlari.primary, borderColor: RenkTokenlari.primary },
  onayYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10.5, flex: 1, lineHeight: 15 },
  basvuruDugme: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.primary,
  },
  basvuruDugmeYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textOnPrimary, fontWeight: '900', fontSize: 13 },
  basvuruNot: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 8.5, textAlign: 'center', lineHeight: 12 },

  bilgiBuyuk: {
    alignItems: 'center',
    gap: 7,
    padding: 20,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  bilgiBuyukBaslik: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, fontSize: 16, textAlign: 'center' },
  bilgiBuyukMetin: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10.5, lineHeight: 16, textAlign: 'center' },

  yasalSatir: { paddingVertical: 4 },
  yasalYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10, textDecorationLine: 'underline' },
  yasalNokta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 10 },

  modalArka: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalKart: {
    maxHeight: '86%',
    backgroundColor: RenkTokenlari.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  modalUst: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  modalBaslik: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, flex: 1, fontSize: 17 },
  modalGovde: { maxHeight: 400 },
  modalMetin: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, fontSize: 12, lineHeight: 19 },
  modalDugmeler: { flexDirection: 'row', gap: 9 },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: YaricapTokenlari.pill,
  },
  modalBtnIkincil: { backgroundColor: RenkTokenlari.surface },
  modalBtnIkincilYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, fontWeight: '700', fontSize: 12.5 },
  modalBtnAna: { backgroundColor: RenkTokenlari.primary },
  modalBtnAnaYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textOnPrimary, fontWeight: '900', fontSize: 12.5 },
});
