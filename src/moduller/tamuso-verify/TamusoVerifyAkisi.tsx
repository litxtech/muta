/**
 * Tamuso Verify — mobil doğrulama akışı.
 *
 * Cüzdanım → Yayıncı Kazancım → Kimliğimi Doğrula
 *
 * Akış: Bilgilendirme → Belge türü → Belge fotoğrafları (+ön kalite kontrolü)
 *       → Canlı selfie (sunucu oturumu + hareket sırası) → Bilgi onayı → Durum
 *
 * Tüm durum geçişleri sunucu RPC'lerinde yapılır; istemci yalnızca akışı yönetir.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { EkranBasligi } from '../../components/EkranBasligi';
import { useCeviri, type CeviriAnahtari } from '../../i18n/useCeviri';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import {
  VerifyBasvuruBaslat,
  VerifyBasvuruGonder,
  VerifyBelgeTurleriGetir,
  VerifyBelgeYukle,
  VerifyDurumDinleBenim,
  VerifyDurumuGetir,
  VerifyHamBelgeSilmeTalebi,
  VerifyItirazOlustur,
  VerifySelfieGonder,
  VerifySelfieOturumuBaslat,
  VerifyUlkeKoduGetir,
} from './VerifyApi';
import {
  adimAnahtari,
  belgeTuruAnahtari,
  durumAciklamaAnahtari,
  durumBaslikAnahtari,
  verifyHataAnahtari,
} from './HataCeviri';
import type {
  VerifyAdim,
  VerifyBelgeTuru,
  VerifyBelgeTuruDestegi,
  VerifyCekimSonucu,
  VerifyDurum,
  VerifyDurumKodu,
  VerifyOturum,
} from './tipler';
import { BelgeCekimModal } from './bilesenler/BelgeCekimModal';
import { SelfieModal } from './bilesenler/SelfieModal';
import {
  AdimGostergesi,
  BilgiKutusu,
  BirincilDugme,
  Bolum,
  DurumRozeti,
  IkincilDugme,
  OnayKutusu,
} from './bilesenler/VerifyParcalari';

/** Aydınlatma metni sürümü — metin değişirse artırılır, sunucuda saklanır. */
const ONAY_SURUMU = 'tamuso-verify-2026-11';

/**
 * Belge türü → gerekli yüz sayısı (yerel yedek).
 * Sunucu `identity_belge_turleri` cevap vermezse iki yüzlü belgelerde arka yüz
 * atlanmasın; aksi halde gönderim `document_back_required` ile reddedilirdi.
 */
const BELGE_YUZ_SAYISI: Record<string, number> = {
  id_card: 2,
  drivers_license: 2,
  residence_permit: 2,
  passport: 1,
};

/** Sunucu listesi boş dönerse kullanılabilir asgari belge türleri. */
const VARSAYILAN_TURLER: VerifyBelgeTuruDestegi[] = [
  { doc_type: 'id_card', sides_required: 2, mrz_supported: false },
  { doc_type: 'passport', sides_required: 1, mrz_supported: true },
  { doc_type: 'drivers_license', sides_required: 2, mrz_supported: false },
];

const DUZENLENEBILIR: VerifyDurumKodu[] = [
  'in_progress',
  'awaiting_document',
  'awaiting_selfie',
  'additional_verification',
];

type Asama = 'giris' | 'belgeTuru' | 'belge' | 'selfie' | 'bilgi' | 'sonuc';

function hataAnahtari(e: unknown): CeviriAnahtari {
  const mesaj = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return verifyHataAnahtari(mesaj);
}

function belgeIkonu(tur: VerifyBelgeTuru): React.ComponentProps<typeof Ionicons>['name'] {
  switch (tur) {
    case 'passport':
      return 'airplane-outline';
    case 'drivers_license':
      return 'car-outline';
    case 'residence_permit':
      return 'home-outline';
    default:
      return 'card-outline';
  }
}

/** GG.AA.YYYY — rakam yazıldıkça nokta ekler */
function tarihFormatla(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
}

/** GG.AA.YYYY → YYYY-MM-DD; geçersizse null */
function tarihIso(tr: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(tr.trim());
  if (!m) return null;
  const [gg, aa, yyyy] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (aa < 1 || aa > 12 || gg < 1 || gg > 31 || yyyy < 1900) return null;
  const iso = `${yyyy}-${String(aa).padStart(2, '0')}-${String(gg).padStart(2, '0')}`;
  const dt = new Date(`${iso}T12:00:00Z`);
  return dt.getUTCFullYear() === yyyy &&
    dt.getUTCMonth() + 1 === aa &&
    dt.getUTCDate() === gg
    ? iso
    : null;
}

export type TamusoVerifyAkisiProps = {
  /** Başlıktaki geri oku nereye düşsün. */
  geriDonHref?: Href;
};

export function TamusoVerifyAkisi({ geriDonHref }: TamusoVerifyAkisiProps) {
  const { t } = useCeviri();
  const insets = useSafeAreaInsets();

  const [durum, setDurum] = useState<VerifyDurum | null>(null);
  const [turler, setTurler] = useState<VerifyBelgeTuruDestegi[]>([]);
  const [ulkeKodu, setUlkeKodu] = useState('TR');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hataAnahtar, setHataAnahtar] = useState<CeviriAnahtari | null>(null);

  const [asama, setAsama] = useState<Asama>('giris');
  const [onay, setOnay] = useState(false);
  const [seciliTur, setSeciliTur] = useState<VerifyBelgeTuru | null>(null);
  const [basvuruBaslatiliyor, setBasvuruBaslatiliyor] = useState(false);

  const [belgeModal, setBelgeModal] = useState<'front' | 'back' | null>(null);
  const [belgeYuklenen, setBelgeYuklenen] = useState<'front' | 'back' | null>(null);

  const [selfieAcik, setSelfieAcik] = useState(false);
  const [oturum, setOturum] = useState<VerifyOturum | null>(null);
  const [oturumYukleniyor, setOturumYukleniyor] = useState(false);
  const [selfieHata, setSelfieHata] = useState<string | null>(null);
  const [selfieGonderiliyor, setSelfieGonderiliyor] = useState(false);

  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [dogum, setDogum] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [itirazMetni, setItirazMetni] = useState('');
  const [itirazGonderiliyor, setItirazGonderiliyor] = useState(false);
  const [veriGonderiliyor, setVeriGonderiliyor] = useState(false);

  const durumKodu: VerifyDurumKodu = durum?.status ?? 'not_started';
  const uygulama = durum?.application ?? null;
  const aktifBasvuru = uygulama && DUZENLENEBILIR.includes(uygulama.status) ? uygulama : null;
  const aktifId = aktifBasvuru?.id ?? null;
  const belgeler = durum?.documents ?? {};
  const kalanDeneme = durum?.selfie_kalan_deneme ?? 0;

  const yuzSayisi = useMemo(() => {
    const kayit = turler.find((x) => x.doc_type === aktifBasvuru?.doc_type);
    if (kayit?.sides_required) return Number(kayit.sides_required);
    const yerel = BELGE_YUZ_SAYISI[aktifBasvuru?.doc_type ?? ''];
    return yerel ?? 1;
  }, [aktifBasvuru?.doc_type, turler]);

  const yenile = useCallback(async (ilkYukleme = false) => {
    if (ilkYukleme) setYukleniyor(true);
    try {
      const d = await VerifyDurumuGetir();
      setDurum(d);
      setHataAnahtar(null);
      setAd((eski) => eski || (d.application?.declared_first_name ?? ''));
      setSoyad((eski) => eski || (d.application?.declared_last_name ?? ''));
      if (d.application?.declared_birth_date) {
        const [y, a, g] = String(d.application.declared_birth_date).split('-');
        if (y && a && g) setDogum((eski) => eski || `${g}.${a}.${y}`);
      }
      if (d.application?.doc_type) setSeciliTur(d.application.doc_type);

      const ulke = (d.application?.country_code ?? '').toUpperCase();
      const cozulenUlke = /^[A-Z]{2}$/.test(ulke) ? ulke : await VerifyUlkeKoduGetir();
      setUlkeKodu(cozulenUlke);

      if (d.application && d.belge_turleri?.length) {
        setTurler(d.belge_turleri);
      } else {
        const liste = await VerifyBelgeTurleriGetir(cozulenUlke);
        const birlesik = liste.length ? liste : d.belge_turleri ?? [];
        // Sunucu listesi boşsa akış kilitlenmesin: yerel asgari liste.
        setTurler(birlesik.length ? birlesik : VARSAYILAN_TURLER);
      }
    } catch (e) {
      setHataAnahtar(hataAnahtari(e));
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    void yenile(true);
  }, [yenile]);

  // Yönetici kararı / durum değişikliği gerçek zamanlı yansısın
  useEffect(
    () =>
      VerifyDurumDinleBenim(() => {
        void yenile();
      }),
    [yenile],
  );

  /* ---------------------------------------------------------------- */
  /* Aksiyonlar                                                       */
  /* ---------------------------------------------------------------- */

  const basla = useCallback(() => {
    if (!durum) return;
    switch (durum.status) {
      case 'awaiting_document':
      case 'additional_verification':
        setAsama('belge');
        break;
      case 'awaiting_selfie':
        setAsama('selfie');
        break;
      case 'in_progress':
        setAsama(durum.documents?.selfie ? 'bilgi' : 'selfie');
        break;
      case 'not_started':
      case 'rejected':
        setSeciliTur(null);
        setAsama('belgeTuru');
        break;
      default:
        setAsama('sonuc');
    }
  }, [durum]);

  const basvuruyuBaslat = useCallback(async () => {
    if (!seciliTur) return;
    setBasvuruBaslatiliyor(true);
    try {
      const sonuc = await VerifyBasvuruBaslat({
        countryCode: ulkeKodu,
        docType: seciliTur,
        consentVersion: ONAY_SURUMU,
      });
      await yenile();
      if (sonuc.status === 'approved') {
        setAsama('sonuc');
      } else {
        setAsama('belge');
      }
    } catch (e) {
      setHataAnahtar(hataAnahtari(e));
    } finally {
      setBasvuruBaslatiliyor(false);
    }
  }, [seciliTur, ulkeKodu, yenile]);

  const belgeyiYukle = useCallback(
    async (yuz: 'front' | 'back', cekim: VerifyCekimSonucu) => {
      if (!aktifId) return;
      setBelgeModal(null);
      setBelgeYuklenen(yuz);
      setHataAnahtar(null);
      try {
        await VerifyBelgeYukle({
          applicationId: aktifId,
          side: yuz,
          uri: cekim.uri,
          mime: cekim.mime,
          width: cekim.genislik,
          height: cekim.yukseklik,
          kalite: cekim.kalite,
          kaynak: cekim.kaynak,
        });
        await yenile();
      } catch (e) {
        setHataAnahtar(hataAnahtari(e));
      } finally {
        setBelgeYuklenen(null);
      }
    },
    [aktifId, yenile],
  );

  const selfieOturumuAc = useCallback(async () => {
    if (!aktifId) return;
    setSelfieAcik(true);
    setOturum(null);
    setSelfieHata(null);
    setOturumYukleniyor(true);
    try {
      const o = await VerifySelfieOturumuBaslat(aktifId);
      setOturum(o);
    } catch (e) {
      setSelfieHata(t(hataAnahtari(e)));
    } finally {
      setOturumYukleniyor(false);
    }
  }, [aktifId, t]);

  const selfieyiGonder = useCallback(
    async (girdi: {
      uri: string;
      genislik: number;
      yukseklik: number;
      kalite: VerifyCekimSonucu['kalite'];
      tamamlanan: VerifyAdim[];
    }) => {
      if (!aktifId || !oturum) return;
      setSelfieGonderiliyor(true);
      setSelfieHata(null);
      try {
        await VerifySelfieGonder({
          applicationId: aktifId,
          sessionId: oturum.session_id,
          nonce: oturum.nonce,
          uri: girdi.uri,
          challengeSequence: oturum.challenge_sequence,
          tamamlanan: girdi.tamamlanan,
          kalite: girdi.kalite,
          width: girdi.genislik,
          height: girdi.yukseklik,
          cihazMeta: {
            platform: Platform.OS,
            adim: oturum.challenge_sequence,
            uygulama: 'tamuso-verify',
          },
        });
        setSelfieAcik(false);
        setOturum(null);
        await yenile();
        setAsama('bilgi');
      } catch (e) {
        setSelfieHata(t(hataAnahtari(e)));
      } finally {
        setSelfieGonderiliyor(false);
      }
    },
    [aktifId, oturum, t, yenile],
  );

  const basvuruyuGonder = useCallback(async () => {
    if (!aktifId) return;
    const iso = tarihIso(dogum);
    if (ad.trim().length < 2) {
      setHataAnahtar('verify.hataAd');
      return;
    }
    if (soyad.trim().length < 2) {
      setHataAnahtar('verify.hataSoyad');
      return;
    }
    if (!iso) {
      setHataAnahtar('verify.hataTarih');
      return;
    }
    setGonderiliyor(true);
    setHataAnahtar(null);
    try {
      await VerifyBasvuruGonder({
        applicationId: aktifId,
        firstName: ad,
        lastName: soyad,
        birthDate: iso,
        ocrState: 'manual',
      });
      await yenile();
      setAsama('sonuc');
    } catch (e) {
      setHataAnahtar(hataAnahtari(e));
    } finally {
      setGonderiliyor(false);
    }
  }, [ad, aktifId, dogum, soyad, yenile]);

  const itirazGonder = useCallback(async () => {
    if (!uygulama?.id) return;
    if (itirazMetni.trim().length < 10) {
      setHataAnahtar('verify.itirazKisa');
      return;
    }
    setItirazGonderiliyor(true);
    setHataAnahtar(null);
    try {
      const r = await VerifyItirazOlustur(uygulama.id, itirazMetni);
      if (!r) setHataAnahtar('verify.itirazZatenVar');
      setItirazMetni('');
      await yenile();
    } catch (e) {
      setHataAnahtar(hataAnahtari(e));
    } finally {
      setItirazGonderiliyor(false);
    }
  }, [itirazMetni, uygulama?.id, yenile]);

  const hamBelgeSil = useCallback(async () => {
    if (!uygulama?.id) return;
    Alert.alert(t('verify.veriBaslik'), t('verify.veriMetin'), [
      { text: t('verify.geri'), style: 'cancel' },
      {
        text: t('verify.veriSil'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setVeriGonderiliyor(true);
            try {
              const r = await VerifyHamBelgeSilmeTalebi(uygulama.id);
              await yenile();
              Alert.alert(
                t('verify.veriBaslik'),
                r.silinenKayit > 0 ? t('verify.veriSilindi') : t('verify.veriTalebiZaten'),
              );
            } catch (e) {
              setHataAnahtar(hataAnahtari(e));
            } finally {
              setVeriGonderiliyor(false);
            }
          })();
        },
      },
    ]);
  }, [t, uygulama?.id, yenile]);

  /* ---------------------------------------------------------------- */
  /* Görünüm                                                          */
  /* ---------------------------------------------------------------- */

  const adimNo =
    asama === 'belgeTuru' ? 1 : asama === 'belge' ? 2 : asama === 'selfie' ? 3 : asama === 'bilgi' ? 4 : 5;

  const sonucDurumu: VerifyDurumKodu[] = [
    'under_review',
    'appeal_review',
    'approved',
    'rejected',
  ];
  const durumSonucu = sonucDurumu.includes(durumKodu);

  const renderGiris = () => (
    <>
      <LinearGradient
        colors={[`${RenkTokenlari.violet}33`, `${RenkTokenlari.primarySoft}1A`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroIkon}>
          <Ionicons name="shield-checkmark" size={26} color={RenkTokenlari.accent} />
        </View>
        <Text style={styles.heroBaslik}>{t('verify.girisBaslik')}</Text>
        <Text style={styles.heroAlt}>{t('verify.girisMetin1')}</Text>
        {durum && durum.status !== 'not_started' ? (
          <View style={{ marginTop: 6 }}>
            <DurumRozeti durum={durumKodu} buyuk />
          </View>
        ) : null}
      </LinearGradient>

      <View style={styles.maddeKap}>
        {[
          { ikon: 'document-text-outline' as const, metin: t('verify.girisMetin2') },
          { ikon: 'camera-outline' as const, metin: t('verify.girisMetin3') },
          { ikon: 'lock-closed-outline' as const, metin: t('verify.girisMetin4') },
          { ikon: 'people-outline' as const, metin: t('verify.girisMetin5') },
          { ikon: 'refresh-outline' as const, metin: t('verify.girisMetin6') },
          { ikon: 'time-outline' as const, metin: t('verify.girisMetin7') },
        ].map((m) => (
          <View key={m.metin} style={styles.madde}>
            <Ionicons name={m.ikon} size={15} color={RenkTokenlari.accent} style={{ marginTop: 2 }} />
            <Text style={styles.maddeYazi}>{m.metin}</Text>
          </View>
        ))}
      </View>

      <BilgiKutusu
        ikon="shield-outline"
        baslik={t('verify.durumBaslik')}
        metin={t('verify.superAdminNot')}
        ton="notr"
      />
      <BilgiKutusu ikon="alert-circle-outline" metin={t('verify.kaliteOnNot')} ton="uyari" />

      <Pressable
        onPress={() => router.push('/politika/gizlilik' as Href)}
        style={styles.linkSatir}
        accessibilityRole="link"
      >
        <Ionicons name="document-outline" size={14} color={RenkTokenlari.textMuted} />
        <Text style={styles.linkYazi}>{t('verify.gizlilikPolitikasi')}</Text>
        <Ionicons name="chevron-forward" size={13} color={RenkTokenlari.textDim} />
      </Pressable>
      <Text style={styles.minikNot}>{t('verify.girisMetin8')}</Text>

      {durumSonucu ? (
        <BirincilDugme
          etiket={t('verify.devam')}
          ikon="arrow-forward"
          onPress={() => setAsama('sonuc')}
          stil={{ marginTop: BoslukTokenlari.md }}
        />
      ) : aktifBasvuru ? (
        <BirincilDugme
          etiket={t('verify.devamEt')}
          ikon="arrow-forward"
          onPress={basla}
          stil={{ marginTop: BoslukTokenlari.md }}
        />
      ) : (
        <>
          <OnayKutusu secili={onay} onDegistir={setOnay} metin={t('verify.onayMetni')} />
          <BirincilDugme
            etiket={durumKodu === 'rejected' ? t('verify.yenidenDogrula') : t('verify.basla')}
            ikon="shield-checkmark-outline"
            onPress={basla}
            devreDisi={!onay}
            stil={{ marginTop: BoslukTokenlari.sm }}
          />
          {!onay ? <Text style={styles.minikNot}>{t('verify.onayGerekli')}</Text> : null}
        </>
      )}
    </>
  );

  const renderBelgeTuru = () => (
    <>
      <Bolum baslik={t('verify.belgeTuruBaslik')} yan={<Text style={styles.minikNot}>{`${t('verify.ulke')}: ${ulkeKodu}`}</Text>} />
      <Text style={styles.aciklama}>{t('verify.belgeTuruAlt')}</Text>
      {turler.length === 0 ? (
        <BilgiKutusu ikon="alert-circle-outline" metin={t('verify.belgeYok')} ton="uyari" />
      ) : null}
      {turler.map((x) => {
        const secili = seciliTur === x.doc_type;
        return (
          <Pressable
            key={x.doc_type}
            onPress={() => setSeciliTur(x.doc_type)}
            accessibilityRole="radio"
            accessibilityState={{ selected: secili }}
            style={[styles.turKart, secili && styles.turKartSecili]}
          >
            <View style={[styles.turIkon, secili && styles.turIkonSecili]}>
              <Ionicons
                name={belgeIkonu(x.doc_type)}
                size={20}
                color={secili ? RenkTokenlari.accent : RenkTokenlari.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.turYazi, secili && styles.turYaziSecili]}>
                {t(belgeTuruAnahtari(x.doc_type))}
              </Text>
              <Text style={styles.turAlt}>
                {t('verify.yuzSayisi', { sayi: x.sides_required })}
                {x.mrz_supported ? ' · MRZ' : ''}
              </Text>
            </View>
            <View style={[styles.radio, secili && styles.radioSecili]}>
              {secili ? <View style={styles.radioNokta} /> : null}
            </View>
          </Pressable>
        );
      })}

      {uygulama && uygulama.doc_type !== seciliTur && uygulama.status === 'awaiting_document' ? (
        <BilgiKutusu
          ikon="information-circle-outline"
          metin={t('verify.belgeTuruKilitli', {
            tur: t(belgeTuruAnahtari(uygulama.doc_type)),
          })}
          ton="uyari"
        />
      ) : null}

      <BirincilDugme
        etiket={t('verify.devam')}
        ikon="arrow-forward"
        onPress={() => void basvuruyuBaslat()}
        yukleniyor={basvuruBaslatiliyor}
        devreDisi={!seciliTur}
        stil={{ marginTop: BoslukTokenlari.md }}
      />
    </>
  );

  const yuzKart = (yuz: 'front' | 'back') => {
    const varMi = Boolean(belgeler[yuz]);
    const yukleniyorMu = belgeYuklenen === yuz;
    return (
      <Pressable
        key={yuz}
        onPress={() => setBelgeModal(yuz)}
        disabled={yukleniyorMu}
        style={[styles.yuzKart, varMi && styles.yuzKartTamam]}
        accessibilityRole="button"
      >
        <View style={styles.yuzUst}>
          <Ionicons
            name={varMi ? 'checkmark-circle' : 'scan-outline'}
            size={22}
            color={varMi ? RenkTokenlari.mint : RenkTokenlari.accent}
          />
          <Text style={styles.yuzBaslik}>
            {yuz === 'front' ? t('verify.onYuz') : t('verify.arkaYuz')}
          </Text>
          {yukleniyorMu ? (
            <ActivityIndicator size="small" color={RenkTokenlari.accent} />
          ) : (
            <Text
              style={[
                styles.yuzDurum,
                { color: varMi ? RenkTokenlari.mint : RenkTokenlari.textDim },
              ]}
            >
              {varMi ? t('verify.belgeYuklendi') : t('verify.belgeBekliyor')}
            </Text>
          )}
        </View>
        <Text style={styles.yuzAlt}>
          {varMi
            ? t('verify.degistir')
            : yuz === 'front'
              ? t('verify.onYuzCek')
              : t('verify.arkaYuzCek')}
        </Text>
      </Pressable>
    );
  };

  const renderBelge = () => (
    <>
      <Bolum
        baslik={t(belgeTuruAnahtari(uygulama?.doc_type ?? seciliTur ?? 'id_card'))}
        yan={uygulama ? <DurumRozeti durum={uygulama.status} /> : null}
      />
      <BilgiKutusu ikon="scan-outline" metin={t('verify.cerceveIpucu')} />
      {yuzKart('front')}
      {yuzSayisi >= 2 || belgeler.back ? yuzKart('back') : null}
      <BilgiKutusu ikon="information-circle-outline" metin={t('verify.kaliteOnNot')} ton="uyari" />
      <Text style={styles.minikNot}>{t('verify.belgeOnayNot')}</Text>
      <BirincilDugme
        etiket={t('verify.devam')}
        ikon="arrow-forward"
        onPress={() => setAsama('selfie')}
        devreDisi={!belgeler.front || (yuzSayisi >= 2 && !belgeler.back) || Boolean(belgeYuklenen)}
        yukleniyor={Boolean(belgeYuklenen)}
        stil={{ marginTop: BoslukTokenlari.sm }}
      />
      {!belgeler.front ? <Text style={styles.minikNot}>{t('verify.hataBelgeGerekli')}</Text> : null}
      {belgeler.front && yuzSayisi >= 2 && !belgeler.back ? (
        <Text style={styles.minikNot}>{t('verify.hataArkaGerekli')}</Text>
      ) : null}
    </>
  );

  const renderSelfie = () => (
    <>
      <Bolum baslik={t('verify.selfieBaslik')} />
      <View style={styles.selfieKart}>
        <View style={styles.selfieOval}>
          <Ionicons name="person-circle-outline" size={58} color={RenkTokenlari.accent} />
        </View>
        <Text style={styles.selfieAlt}>{t('verify.selfieAlt')}</Text>
        <View style={styles.adimOnizleme}>
          {(['center', 'right', 'left', 'blink'] as const).map((a, i) => (
            <View key={a} style={styles.onizlemeSatir}>
              <Text style={styles.onizlemeNo}>{i + 1}</Text>
              <Text style={styles.onizlemeYazi}>{t(adimAnahtari(a))}</Text>
            </View>
          ))}
        </View>
      </View>

      <BilgiKutusu ikon="information-circle-outline" metin={t('verify.selfieNot')} ton="uyari" />
      <Text style={styles.minikNot}>{t('verify.denemeKalan', { sayi: kalanDeneme })}</Text>

      {belgeler.selfie ? (
        <>
          <BilgiKutusu ikon="checkmark-circle" metin={t('verify.selfieBasarili')} ton="basari" />
          <BirincilDugme
            etiket={t('verify.devam')}
            ikon="arrow-forward"
            onPress={() => setAsama('bilgi')}
            stil={{ marginTop: BoslukTokenlari.sm }}
          />
          <IkincilDugme
            etiket={t('verify.tekrarCek')}
            ikon="refresh"
            onPress={() => void selfieOturumuAc()}
            devreDisi={kalanDeneme <= 0}
          />
        </>
      ) : (
        <BirincilDugme
          etiket={t('verify.selfieBaslat')}
          ikon="camera-outline"
          onPress={() => void selfieOturumuAc()}
          devreDisi={kalanDeneme <= 0}
          stil={{ marginTop: BoslukTokenlari.sm }}
        />
      )}
      {kalanDeneme <= 0 ? (
        <BilgiKutusu ikon="alert-circle-outline" metin={t('verify.denemeBitti')} ton="hata" />
      ) : null}
    </>
  );

  const renderBilgi = () => (
    <>
      <Bolum baslik={t('verify.bilgiBaslik')} />
      <Text style={styles.aciklama}>{t('verify.bilgiAlt')}</Text>
      <Text style={styles.etiket}>{t('verify.ad')}</Text>
      <TextInput
        value={ad}
        onChangeText={setAd}
        placeholder={t('verify.ad')}
        placeholderTextColor={RenkTokenlari.textDim}
        style={styles.girdi}
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="givenName"
        maxLength={60}
      />
      <Text style={styles.etiket}>{t('verify.soyad')}</Text>
      <TextInput
        value={soyad}
        onChangeText={setSoyad}
        placeholder={t('verify.soyad')}
        placeholderTextColor={RenkTokenlari.textDim}
        style={styles.girdi}
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="familyName"
        maxLength={60}
      />
      <Text style={styles.etiket}>{t('verify.dogumTarihi')}</Text>
      <TextInput
        value={dogum}
        onChangeText={(v) => setDogum(tarihFormatla(v))}
        placeholder={t('verify.dogumPlaceholder')}
        placeholderTextColor={RenkTokenlari.textDim}
        style={styles.girdi}
        keyboardType="number-pad"
        maxLength={10}
      />
      <Text style={styles.minikNot}>{t('verify.bilgiIpucu')}</Text>
      <BilgiKutusu ikon="shield-outline" metin={t('verify.superAdminNot')} />
      <BirincilDugme
        etiket={t('verify.gonder')}
        ikon="send-outline"
        onPress={() => void basvuruyuGonder()}
        yukleniyor={gonderiliyor}
        stil={{ marginTop: BoslukTokenlari.sm }}
      />
    </>
  );

  const renderSonuc = () => {
    const itiraz = durum?.itiraz ?? null;
    const karar = durum?.son_karar ?? null;
    const gosterilebilirItiraz = durumKodu === 'rejected' && itiraz == null;

    return (
      <>
        <View style={styles.sonucKart}>
          <DurumRozeti durum={durumKodu} buyuk />
          <Text style={styles.sonucBaslik}>{t(durumBaslikAnahtari(durumKodu))}</Text>
          <Text style={styles.sonucAlt}>{t(durumAciklamaAnahtari(durumKodu))}</Text>
          {uygulama ? (
            <Text style={styles.sonucMeta}>
              {`${t(belgeTuruAnahtari(uygulama.doc_type))} · ${uygulama.country_code}`}
            </Text>
          ) : null}
        </View>

        {karar && (karar.reason || karar.reason_code) ? (
          <BilgiKutusu
            ikon="document-text-outline"
            baslik={t('verify.redSebep')}
            metin={karar.reason ?? karar.reason_code ?? ''}
            ton={karar.decision === 'rejected' ? 'hata' : 'notr'}
          />
        ) : null}
        {uygulama?.last_review_note ? (
          <BilgiKutusu
            ikon="chatbox-ellipses-outline"
            baslik={t('verify.incelemeNotu')}
            metin={uygulama.last_review_note}
          />
        ) : null}

        {itiraz ? (
          <View style={styles.itirazKart}>
            <View style={styles.itirazUst}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={RenkTokenlari.violet} />
              <Text style={styles.itirazBaslik}>{t('verify.itirazBaslik')}</Text>
              <Text style={styles.itirazDurum}>
                {itiraz.status === 'open'
                  ? t('verify.durum_appeal_review')
                  : itiraz.status === 'reviewing'
                    ? t('verify.durum_appeal_review')
                    : itiraz.status === 'resolved'
                      ? t('verify.durum_approved')
                      : t('verify.durum_rejected')}
              </Text>
            </View>
            <Text style={styles.itirazMetin}>{itiraz.message}</Text>
            {itiraz.resolution_note ? (
              <Text style={styles.itirazCozum}>{itiraz.resolution_note}</Text>
            ) : null}
          </View>
        ) : null}

        {gosterilebilirItiraz ? (
          <View style={styles.itirazKart}>
            <Text style={styles.itirazBaslik}>{t('verify.itirazBaslik')}</Text>
            <Text style={styles.aciklama}>{t('verify.itirazAlt')}</Text>
            <TextInput
              value={itirazMetni}
              onChangeText={setItirazMetni}
              placeholder={t('verify.itirazPlaceholder')}
              placeholderTextColor={RenkTokenlari.textDim}
              style={[styles.girdi, styles.girdiCok]}
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />
            <BirincilDugme
              etiket={t('verify.itirazGonder')}
              ikon="send-outline"
              onPress={() => void itirazGonder()}
              yukleniyor={itirazGonderiliyor}
              devreDisi={itirazMetni.trim().length < 10}
            />
          </View>
        ) : null}

        {aktifBasvuru ? (
          <BirincilDugme
            etiket={t('verify.devamEt')}
            ikon="arrow-forward"
            onPress={basla}
            stil={{ marginTop: BoslukTokenlari.sm }}
          />
        ) : durumKodu === 'rejected' ? (
          <BirincilDugme
            etiket={t('verify.yenidenDogrula')}
            ikon="refresh"
            onPress={() => {
              setSeciliTur(null);
              setAsama('belgeTuru');
            }}
            stil={{ marginTop: BoslukTokenlari.sm }}
          />
        ) : durumKodu === 'approved' ? (
          <BirincilDugme
            etiket={t('verify.durum_approved')}
            ikon="wallet-outline"
            onPress={() => router.push('/cuzdan/yayinci-kazanclari' as Href)}
            stil={{ marginTop: BoslukTokenlari.sm }}
          />
        ) : null}

        <Bolum baslik={t('verify.veriBaslik')} />
        <Text style={styles.aciklama}>{t('verify.veriMetin')}</Text>
        <Text style={styles.minikNot}>{t('verify.saklamaNot')}</Text>
        <IkincilDugme
          etiket={t('verify.veriSil')}
          ikon="trash-outline"
          onPress={() => void hamBelgeSil()}
          devreDisi={veriGonderiliyor || !uygulama?.id}
        />

        <Bolum baslik={t('verify.destekBaslik')} />
        <Text style={styles.aciklama}>{t('verify.destekMetin')}</Text>
        <IkincilDugme
          etiket={t('verify.destekGit')}
          ikon="headset-outline"
          onPress={() => router.push('/destek' as Href)}
        />
      </>
    );
  };

  const icerik = () => {
    switch (asama) {
      case 'belgeTuru':
        return renderBelgeTuru();
      case 'belge':
        return renderBelge();
      case 'selfie':
        return renderSelfie();
      case 'bilgi':
        return renderBilgi();
      case 'sonuc':
        return renderSonuc();
      default:
        return renderGiris();
    }
  };

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title={t('verify.baslik')}
        subtitle={t('verify.altBaslik')}
        fallbackHref={(geriDonHref ?? '/cuzdan/yayinci-kazanclari') as Href}
      />

      {yukleniyor ? (
        <View style={styles.merkez}>
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
          <Text style={styles.merkezYazi}>{t('verify.yukleniyor')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + BoslukTokenlari.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {asama !== 'giris' && asama !== 'sonuc' ? (
            <AdimGostergesi aktif={adimNo} />
          ) : null}

          {hataAnahtar ? (
            <View style={styles.hataKart}>
              <Ionicons name="alert-circle-outline" size={16} color={RenkTokenlari.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.hataBaslik}>{t('verify.hataBaslik')}</Text>
                <Text style={styles.hataMetin}>{t(hataAnahtar)}</Text>
                <Pressable
                  onPress={() => {
                    setHataAnahtar(null);
                    void yenile();
                  }}
                  style={styles.hataTekrar}
                  accessibilityRole="button"
                >
                  <Ionicons name="refresh" size={12} color={RenkTokenlari.accent} />
                  <Text style={styles.hataTekrarYazi}>{t('verify.tekrarDene')}</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setHataAnahtar(null)} hitSlop={8}>
                <Ionicons name="close" size={16} color={RenkTokenlari.textDim} />
              </Pressable>
            </View>
          ) : null}

          {icerik()}

          {asama !== 'giris' && asama !== 'sonuc' ? (
            <Pressable
              onPress={() => setAsama('giris')}
              style={styles.geriSatir}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={14} color={RenkTokenlari.textMuted} />
              <Text style={styles.geriYazi}>{t('verify.geri')}</Text>
            </Pressable>
          ) : null}

          {asama === 'giris' ? (
            <Pressable
              onPress={() => {
                if (Platform.OS === 'web') return;
                void Linking.openSettings();
              }}
              style={styles.geriSatir}
              accessibilityRole="button"
            >
              <Ionicons name="settings-outline" size={13} color={RenkTokenlari.textDim} />
              <Text style={styles.geriYazi}>{t('verify.izinAc')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      <BelgeCekimModal
        gorunur={belgeModal != null}
        baslik={
          belgeModal === 'back' ? t('verify.arkaYuz') : t('verify.onYuz')
        }
        onKapat={() => setBelgeModal(null)}
        onTamam={(cekim) => {
          const yuz = belgeModal ?? 'front';
          void belgeyiYukle(yuz, cekim);
        }}
      />

      <SelfieModal
        gorunur={selfieAcik}
        oturum={oturum}
        oturumYukleniyor={oturumYukleniyor}
        hata={selfieHata}
        kalanDeneme={kalanDeneme}
        gonderiliyor={selfieGonderiliyor}
        onKapat={() => {
          setSelfieAcik(false);
          setOturum(null);
        }}
        onOturumYenile={() => void selfieOturumuAc()}
        onTamam={(girdi) => void selfieyiGonder(girdi)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  merkez: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  merkezYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  scroll: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.xs,
    gap: BoslukTokenlari.sm,
  },
  hero: {
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.lg,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.violet}33`,
    gap: 6,
  },
  heroIkon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${RenkTokenlari.accent}1F`,
    marginBottom: 2,
  },
  heroBaslik: { ...TipografiTokenlari.h1, color: RenkTokenlari.text },
  heroAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 19,
  },
  maddeKap: { gap: 7, paddingVertical: 2 },
  madde: { flexDirection: 'row', gap: 8 },
  maddeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
    lineHeight: 18,
    fontSize: 12.5,
  },
  linkSatir: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  linkYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textDecorationLine: 'underline',
    fontSize: 12,
  },
  minikNot: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9.5,
    lineHeight: 13,
  },
  aciklama: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 18,
    fontSize: 12.5,
  },
  etiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  girdi: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: YaricapTokenlari.sm,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: RenkTokenlari.text,
    ...TipografiTokenlari.body,
    fontSize: 14,
  },
  girdiCok: { minHeight: 96, paddingTop: 10 },
  turKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
  turKartSecili: {
    borderColor: RenkTokenlari.accent,
    backgroundColor: `${RenkTokenlari.accent}12`,
  },
  turIkon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.bgElevated,
  },
  turIkonSecili: { backgroundColor: `${RenkTokenlari.accent}24` },
  turYazi: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '700', fontSize: 14 },
  turYaziSecili: { color: RenkTokenlari.accent },
  turAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 9.5, marginTop: 1 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSecili: { borderColor: RenkTokenlari.accent },
  radioNokta: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RenkTokenlari.accent,
  },
  yuzKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
    gap: 3,
  },
  yuzKartTamam: { borderStyle: 'solid', borderColor: `${RenkTokenlari.mint}55` },
  yuzUst: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  yuzBaslik: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '700', flex: 1 },
  yuzDurum: { ...TipografiTokenlari.micro, fontSize: 9.5, fontWeight: '800' },
  yuzAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10, marginLeft: 30 },
  selfieKart: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.violet}44`,
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
    gap: 8,
  },
  selfieOval: {
    width: 108,
    height: 142,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: `${RenkTokenlari.accent}66`,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${RenkTokenlari.accent}0F`,
  },
  selfieAlt: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, textAlign: 'center' },
  adimOnizleme: { alignSelf: 'stretch', gap: 5, marginTop: 4 },
  onizlemeSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onizlemeNo: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    width: 14,
    textAlign: 'center',
    fontSize: 10,
  },
  onizlemeYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontSize: 12 },
  sonucKart: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
    gap: 6,
  },
  sonucBaslik: { ...TipografiTokenlari.h1, color: RenkTokenlari.text, marginTop: 2 },
  sonucAlt: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, lineHeight: 19 },
  sonucMeta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 10 },
  itirazKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.violet}3D`,
    backgroundColor: `${RenkTokenlari.violet}0F`,
    gap: 7,
  },
  itirazUst: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itirazBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 12.5,
    flex: 1,
  },
  itirazDurum: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.violet,
    fontSize: 9.5,
    fontWeight: '800',
  },
  itirazMetin: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, fontSize: 12 },
  itirazCozum: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.mint,
    fontSize: 12,
    fontStyle: 'italic',
  },
  hataKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.danger}44`,
    backgroundColor: `${RenkTokenlari.danger}12`,
  },
  hataBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
    fontWeight: '800',
    fontSize: 12,
  },
  hataMetin: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
  },
  hataTekrar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: `${RenkTokenlari.accent}14`,
  },
  hataTekrarYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    fontSize: 9.5,
    fontWeight: '800',
  },
  geriSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  geriYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10.5,
  },
});
