import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
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
import {
  YayinciOdemeHesabiGetir,
  YayinciOdemeHesabiKaydet,
  YayinciOdemeUlkeCoz,
  YayinciUlkeOdemeDurumuGetir,
  type YayinciBanka,
  type YayinciOdemeAlani,
  type YayinciOdemeHesabi,
  type YayinciUlkeOdemeDurumu,
} from '../../../src/moduller/cuzdan/yayinci/YayinciKazancApi';
import { ProfilSecimAlani } from '../../../src/moduller/kullanici-profili/bilesenler/ProfilSecimAlani';
import {
  ulkeLigiKatalogBirlestir,
  type UlkeListeOgesi,
} from '../../../src/moduller/ulke-ligi/utils/UlkeListesi';
import { ulkeBayragi } from '../../../src/moduller/kisiler-kesif/utils/KisilerYardimcilar';

/** Ülke şemasındaki alan anahtarı → çeviri anahtarı. */
const ALAN_ETIKET: Record<string, CeviriAnahtari> = {
  iban: 'yayinciK.iban',
  account_number: 'yayinciK.alanHesapNo',
  routing_number: 'yayinciK.alanYonlendirmeNo',
  account_type: 'yayinciK.alanHesapTuru',
  swift_bic: 'yayinciK.alanSwift',
  bic: 'yayinciK.alanBic',
  wallet_provider: 'yayinciK.alanCuzdanSaglayici',
  wallet_number: 'yayinciK.alanCuzdanNo',
  document_id: 'yayinciK.alanBelgeNo',
  sort_code: 'yayinciK.alanSortCode',
  bank_code: 'yayinciK.alanBankaKodu',
  branch_code: 'yayinciK.alanSubeKodu',
  agency: 'yayinciK.alanAcente',
  clabe: 'yayinciK.alanClabe',
  cbu: 'yayinciK.alanCbu',
  cci: 'yayinciK.alanCci',
  pix_key: 'yayinciK.alanPix',
  ifsc: 'yayinciK.alanIfsc',
  bsb: 'yayinciK.alanBsb',
  transit_number: 'yayinciK.alanTransitNo',
  institution_number: 'yayinciK.alanKurumNo',
  rib: 'yayinciK.alanRib',
  corr_account: 'yayinciK.alanMuhabirHesap',
  account_id: 'yayinciK.alanHesapNo',
};

/** Sunucu `odeme_detay_normallestir` ile birebir: boşluk silinen alanlar. */
const BOSLUK_SILINEN = new Set([
  'iban',
  'account_number',
  'routing_number',
  'swift_bic',
  'wallet_number',
  'clabe',
  'document_id',
]);

/** Sunucu ile birebir: boşluk ve tire silinen (sayısal) alanlar. */
const AYIRICI_SILINEN = new Set([
  'sort_code',
  'ifsc',
  'bic',
  'bsb',
  'transit_number',
  'institution_number',
  'branch_code',
  'bank_code',
  'agency',
  'cbu',
  'cci',
  'rib',
  'corr_account',
  'account_id',
]);

/** Sayısal klavye isteyen alanlar. */
const NUMARA_ALANLARI = new Set([
  'account_number',
  'routing_number',
  'wallet_number',
  'clabe',
  'sort_code',
  'transit_number',
  'institution_number',
  'branch_code',
  'bank_code',
  'bsb',
  'cbu',
  'cci',
  'rib',
  'agency',
  'corr_account',
  'account_id',
]);

/** Büyük harfe zorlanan alanlar. */
const BUYUK_HARF_ALANLARI = new Set(['iban', 'swift_bic', 'bic', 'ifsc', 'document_id']);

const ENUM_ETIKET: Record<string, CeviriAnahtari> = {
  checking: 'yayinciK.hesapTuruChecking',
  savings: 'yayinciK.hesapTuruSavings',
  ahorros: 'yayinciK.hesapTuruAhorro',
  ahorro: 'yayinciK.hesapTuruAhorro',
  corriente: 'yayinciK.hesapTuruCorriente',
  gcash: 'yayinciK.cuzdanGcash',
  maya: 'yayinciK.cuzdanMaya',
  other: 'yayinciK.cuzdanDiger',
  paynow: 'yayinciK.cuzdanPaynow',
  grabpay: 'yayinciK.cuzdanGrabpay',
  alipay: 'yayinciK.cuzdanAlipay',
  wechat: 'yayinciK.cuzdanWechat',
  wise: 'yayinciK.cuzdanWise',
  revolut: 'yayinciK.cuzdanRevolut',
  paypal: 'yayinciK.cuzdanPaypal',
  orange: 'yayinciK.cuzdanOrange',
  mtn: 'yayinciK.cuzdanMtn',
  wave: 'yayinciK.cuzdanWave',
  mpesa: 'yayinciK.cuzdanMpesa',
  tigopesa: 'yayinciK.cuzdanTigopesa',
  airtel: 'yayinciK.cuzdanAirtel',
  telebirr: 'yayinciK.cuzdanTelebirr',
  halopesa: 'yayinciK.cuzdanHalopesa',
  free: 'yayinciK.cuzdanFree',
};

const SEMA_ETIKET: Record<string, CeviriAnahtari> = {
  iban: 'yayinciK.semaIban',
  us_ach: 'yayinciK.semaUsAch',
  local_account: 'yayinciK.semaYerel',
  wallet: 'yayinciK.semaCuzdan',
  uk_sort_code: 'yayinciK.semaUkSort',
  clabe: 'yayinciK.semaClabe',
  fast: 'yayinciK.semaYerel',
  cnaps: 'yayinciK.semaYerel',
  fps: 'yayinciK.semaCuzdan',
};

const ELLE_GIR = '__elle__';

/** Alan anahtarını (varsa) çeviriyle, yoksa okunur biçimde döndürür. */
function alanEtiketi(alan: YayinciOdemeAlani, t: (k: CeviriAnahtari) => string): string {
  const anahtar = ALAN_ETIKET[alan.key.toLowerCase()];
  return anahtar ? t(anahtar) : alan.key.replace(/_/g, ' ');
}

function hataAnahtari(kod: string | undefined): CeviriAnahtari {
  if (!kod) return 'yayinciK.hata';
  if (kod.startsWith('field_') || kod === 'invalid_details') return 'yayinciK.hataAlan';
  switch (kod) {
    case 'invalid_iban':
      return 'yayinciK.hataIban';
    case 'invalid_iban_length':
      return 'yayinciK.hataIbanUzunluk';
    case 'iban_country_mismatch':
      return 'yayinciK.hataIbanUlke';
    case 'invalid_bank':
      return 'yayinciK.hataBankaKodu';
    case 'account_holder_required':
      return 'yayinciK.hataHesapSahibi';
    case 'bank_name_required':
      return 'yayinciK.hataBankaAdi';
    case 'invalid_method':
      return 'yayinciK.hataYontem';
    case 'invalid_country':
      return 'yayinciK.hataUlke';
    default:
      return 'yayinciK.hata';
  }
}

/** Sunucudaki normalizasyonun aynısı — doğrulama ve kayıt aynı değeri kullanır. */
export function alanNormalize(anahtar: string, deger: string): string {
  const k = anahtar.toLowerCase();
  const ham = (deger ?? '').trim();
  if (BOSLUK_SILINEN.has(k)) return ham.replace(/\s/g, '').toUpperCase();
  if (AYIRICI_SILINEN.has(k)) return ham.replace(/[\s-]/g, '').toUpperCase();
  return ham;
}

/** Alan değerini yerelde doğrular; hata varsa çeviri anahtarı döner. */
function alanDogrula(
  alan: YayinciOdemeAlani,
  hamDeger: string,
  ulke: string,
  ibanUzunlugu: number | null | undefined,
): CeviriAnahtari | null {
  const k = alan.key.toLowerCase();
  const deger = alanNormalize(k, hamDeger);
  if (!deger) return alan.required !== false ? 'yayinciK.hataAlanZorunlu' : null;
  if (alan.pattern) {
    try {
      if (!new RegExp(alan.pattern).test(deger)) return 'yayinciK.hataAlanBicim';
    } catch {
      /* bozuk desen sunucuda doğrulanır */
    }
  }
  if (alan.enum?.length && !alan.enum.some((e) => e.toLowerCase() === deger.toLowerCase())) {
    return 'yayinciK.hataAlanBicim';
  }
  if (alan.max_length != null && deger.length > alan.max_length) {
    return 'yayinciK.hataAlanBicim';
  }
  if (alan.min_length != null && deger.length < alan.min_length) {
    return 'yayinciK.hataAlanBicim';
  }
  if (alan.numeric === true && !/^[0-9]+$/.test(deger)) {
    return 'yayinciK.hataAlanBicim';
  }
  if (k === 'iban') {
    if (ulke && !deger.startsWith(ulke)) return 'yayinciK.hataIbanUlke';
    if (ibanUzunlugu && deger.length !== ibanUzunlugu) return 'yayinciK.hataIbanUzunluk';
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(deger)) return 'yayinciK.hataIban';
  }
  return null;
}

/** Sunucudan gelen alan şeması yoksa IBAN varsayılanına düş. */
const VARSAYILAN_ALANLAR: YayinciOdemeAlani[] = [{ key: 'iban', required: true }];

/** Kanal bazlı liste + genel liste birleşimi (tekrarlar atılır). */
function bankaListesiBirlestir(
  durum: YayinciUlkeOdemeDurumu | null,
  yontem: string,
  kanalBankalari: YayinciBanka[] | undefined,
): YayinciBanka[] {
  const topla: YayinciBanka[] = [];
  const ekle = (liste: YayinciBanka[] | undefined) => {
    (liste ?? []).forEach((b) => {
      if (!topla.some((x) => x.code === b.code)) topla.push(b);
    });
  };
  ekle(kanalBankalari);
  const genel = durum?.banks;
  if (Array.isArray(genel)) {
    ekle(genel);
  } else if (genel) {
    // Cüzdan kanalında banka listesine düşmeyiz: sunucu banka kodunu cüzdan
    // rehberinde arar ve banka kodu gönderilirse invalid_bank döner.
    ekle(yontem === 'wallet_transfer' ? genel.wallet : genel.bank);
  }
  return topla;
}

export default function OdemeHesabiEkrani() {
  const { t } = useCeviri();
  const [hesap, setHesap] = useState<YayinciOdemeHesabi | null>(null);
  const [ulkeDurum, setUlkeDurum] = useState<YayinciUlkeOdemeDurumu | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [semaYukleniyor, setSemaYukleniyor] = useState(false);

  const [sahip, setSahip] = useState('');
  const [banka, setBanka] = useState('');
  const [bankaKodu, setBankaKodu] = useState<string | null>(null);
  const [bankaElle, setBankaElle] = useState(false);
  const [ulke, setUlke] = useState('TR');
  const [paraBirimi, setParaBirimi] = useState('USD');
  const [yontem, setYontem] = useState('bank_transfer');
  const [alanDegerleri, setAlanDegerleri] = useState<Record<string, string>>({});
  const [alanHatalari, setAlanHatalari] = useState<Record<string, CeviriAnahtari>>({});

  const ulkeler = useMemo<UlkeListeOgesi[]>(() => ulkeLigiKatalogBirlestir([]), []);
  const ulkeSecenekleri = useMemo(
    () =>
      ulkeler.map((u) => ({
        id: u.code,
        label: `${ulkeBayragi(u.code)} ${u.name}`.trim(),
      })),
    [ulkeler],
  );
  const ulkeEtiketi = useMemo(() => {
    const ad = ulkeler.find((u) => u.code === ulke)?.name ?? '';
    return `${ulkeBayragi(ulke)} ${ad}`.trim();
  }, [ulkeler, ulke]);

  const yukle = useCallback(async () => {
    try {
      const h = await YayinciOdemeHesabiGetir();
      setHesap(h);
      if (h.exists) {
        setSahip(h.account_holder ?? '');
        setBanka(h.bank_name ?? '');
        setBankaKodu(h.bank_code ?? null);
        setBankaElle(!h.bank_code);
        setUlke((h.country_code ?? 'TR').toUpperCase());
        setParaBirimi(h.currency ?? 'USD');
        if (h.method) setYontem(h.method);
      } else {
        // Kayıtlı hesap yoksa kullanıcının ülkesi sunucudan çözülür:
        // profil/kimlik/program kaydı hangisinde varsa o ülkenin banka
        // rehberi ve alan şeması ilk açılışta gelsin.
        const cozulen = await YayinciOdemeUlkeCoz();
        if (cozulen) setUlke(cozulen);
      }
    } catch {
      setHesap(null);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  useEffect(() => {
    const kod = ulke.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(kod)) {
      setUlkeDurum(null);
      return;
    }
    let iptal = false;
    setSemaYukleniyor(true);
    YayinciUlkeOdemeDurumuGetir(kod)
      .then((d) => {
        if (iptal) return;
        setUlkeDurum(d);
        const uygun = (d.methods ?? []).filter((m) => m.is_enabled);
        const varsayilan = (uygun[0] ?? d.methods?.[0])?.method;
        setYontem((mevcut) => {
          const gecerli = (d.methods ?? []).some(
            (m) => m.method === mevcut && m.is_enabled,
          );
          return gecerli ? mevcut : varsayilan ?? mevcut;
        });
        const otomatikPara = d.rules?.currency;
        if (otomatikPara) setParaBirimi(otomatikPara.toUpperCase());
      })
      .catch(() => {
        if (!iptal) setUlkeDurum(null);
      })
      .finally(() => {
        if (!iptal) setSemaYukleniyor(false);
      });
    return () => {
      iptal = true;
    };
  }, [ulke]);

  const seciliYontem = useMemo(() => {
    const liste = ulkeDurum?.methods ?? [];
    return liste.find((m) => m.method === yontem) ?? liste[0] ?? null;
  }, [ulkeDurum, yontem]);

  const alanlar = useMemo<YayinciOdemeAlani[]>(() => {
    const f = seciliYontem?.fields ?? seciliYontem?.requirements?.fields;
    return f && f.length > 0 ? f : VARSAYILAN_ALANLAR;
  }, [seciliYontem]);

  const kurallar = ulkeDurum?.rules ?? null;
  const ibanUzunlugu = kurallar?.iban_length ?? null;

  const bankaListesi = useMemo(
    () => bankaListesiBirlestir(ulkeDurum, yontem, seciliYontem?.banks),
    [ulkeDurum, yontem, seciliYontem],
  );

  const seciliBanka = useMemo(
    () => bankaListesi.find((b) => b.code === bankaKodu) ?? null,
    [bankaListesi, bankaKodu],
  );

  const bankaZorunlu = Boolean(seciliYontem?.requirements?.bank_name_required);
  const bankaEtiketi = seciliBanka?.name ?? banka;
  const kanalKapali = ulkeDurum != null && !ulkeDurum.supported;
  const elleGoster = bankaElle || bankaListesi.length === 0;

  const bankaSecenekleri = useMemo(
    () => [
      ...bankaListesi.map((b) => ({
        id: b.code,
        label: b.name,
        alt: b.short_name && b.short_name !== b.name ? b.short_name : undefined,
      })),
      { id: ELLE_GIR, label: t('yayinciK.bankaListedeYok') },
    ],
    [bankaListesi, t],
  );

  const degerAyarla = (anahtar: string, deger: string) => {
    setAlanDegerleri((o) => ({ ...o, [anahtar]: deger }));
    setAlanHatalari((o) => {
      if (!o[anahtar]) return o;
      const kopya = { ...o };
      delete kopya[anahtar];
      return kopya;
    });
  };

  const ulkeDegistir = (kod: string) => {
    setUlke(kod.toUpperCase());
    setAlanDegerleri({});
    setAlanHatalari({});
    setBankaKodu(null);
    setBankaElle(false);
    setBanka('');
  };

  const yontemDegistir = (yeni: string) => {
    setYontem(yeni);
    setAlanDegerleri({});
    setAlanHatalari({});
    setBankaKodu(null);
    setBankaElle(false);
    setBanka('');
  };

  const bankaSecildi = (kod: string) => {
    if (kod === ELLE_GIR) {
      setBankaKodu(null);
      setBankaElle(true);
      return;
    }
    const secili = bankaListesi.find((b) => b.code === kod);
    setBankaKodu(kod);
    setBankaElle(false);
    setBanka(secili?.name ?? '');
  };

  const kaydet = async () => {
    if (!sahip.trim()) {
      Alert.alert(t('yayinciK.hata'), t('yayinciK.hataHesapSahibi'));
      return;
    }
    if (bankaKodu == null && bankaZorunlu && !banka.trim()) {
      Alert.alert(t('yayinciK.hata'), t('yayinciK.hataBankaAdi'));
      return;
    }
    if (bankaKodu == null && !elleGoster && bankaZorunlu) {
      Alert.alert(t('yayinciK.hata'), t('yayinciK.hataBankaSec'));
      return;
    }
    if (!/^[A-Za-z]{2}$/.test(ulke.trim())) {
      Alert.alert(t('yayinciK.hata'), t('yayinciK.hataUlke'));
      return;
    }

    // Tüm alanları yerelde doğrula; ilk hataları alan altında göster.
    const hatalar: Record<string, CeviriAnahtari> = {};
    alanlar.forEach((alan) => {
      const hata = alanDogrula(alan, alanDegerleri[alan.key] ?? '', ulke.toUpperCase(), ibanUzunlugu);
      if (hata) hatalar[alan.key] = hata;
    });
    if (Object.keys(hatalar).length > 0) {
      setAlanHatalari(hatalar);
      Alert.alert(t('yayinciK.hata'), t(Object.values(hatalar)[0]));
      return;
    }
    setAlanHatalari({});

    const detaylar: Record<string, string> = {};
    alanlar.forEach((alan) => {
      const deger = alanNormalize(alan.key, alanDegerleri[alan.key] ?? '');
      if (deger) detaylar[alan.key] = deger;
    });

    setKaydediyor(true);
    const r = await YayinciOdemeHesabiKaydet({
      accountHolder: sahip.trim(),
      bankName: (seciliBanka?.name ?? banka).trim(),
      bankCode: bankaKodu,
      countryCode: ulke.trim().toUpperCase(),
      currency: paraBirimi.trim().toUpperCase() || kurallar?.currency || 'USD',
      method: (seciliYontem?.method ?? 'bank_transfer') as
        | 'bank_transfer'
        | 'local_transfer'
        | 'wallet_transfer',
      scheme: seciliYontem?.scheme ?? seciliYontem?.requirements?.scheme ?? 'iban',
      details: detaylar,
    });
    setKaydediyor(false);
    if (!r.ok) {
      Alert.alert(t('yayinciK.hata'), t(hataAnahtari(r.kod)));
      return;
    }
    setAlanDegerleri({});
    await yukle();
    Alert.alert(t('yayinciK.hesapKaydedildi'), t('yayinciK.hesapDogrulamaNotu'));
  };

  const durumRenk =
    hesap?.status === 'verified'
      ? RenkTokenlari.mint
      : hesap?.status === 'pending_verification'
        ? RenkTokenlari.accent
        : RenkTokenlari.textDim;

  const hesapOzeti = useMemo(() => {
    const maskeli = hesap?.details_masked ?? {};
    const parcalar = Object.values(maskeli).filter(Boolean);
    if (parcalar.length > 0) return parcalar.join(' · ');
    return hesap?.iban_masked ?? '****';
  }, [hesap]);

  const semaEtiketi = hesap?.scheme
    ? t(SEMA_ETIKET[hesap.scheme] ?? 'yayinciK.semaDiger')
    : null;

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title={t('yayinciK.hesapYonet')}
        subtitle={t('yayinciK.hesapAlt')}
        fallbackHref={'/cuzdan/yayinci-kazanclari/odeme-profili' as any}
      />
      {yukleniyor ? (
        <View style={styles.merkez}>
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {hesap?.exists ? (
            <View style={styles.mevcutKart}>
              <View style={styles.mevcutUst}>
                <View style={styles.mevcutIkon}>
                  <Ionicons name="business" size={16} color={RenkTokenlari.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.mevcutBaslik} numberOfLines={1}>
                    {hesap.account_holder ?? '—'}
                  </Text>
                  <Text style={styles.mevcutAlt} numberOfLines={1}>
                    {hesap.bank_name || '—'} · {hesapOzeti}
                  </Text>
                </View>
                <View style={[styles.durumCip, { backgroundColor: `${durumRenk}1F` }]}>
                  <Text style={[styles.durumCipYazi, { color: durumRenk }]}>
                    {hesap.status === 'verified'
                      ? t('yayinciK.hesapDogrulandi')
                      : hesap.status === 'pending_verification'
                        ? t('yayinciK.hesapBekliyor')
                        : t('yayinciK.uygunlukEksik')}
                  </Text>
                </View>
              </View>
              <Text style={styles.mevcutMeta}>
                {t('yayinciK.hesapUlke')}: {hesap.country_code ?? '—'} ·{' '}
                {t('yayinciK.paraBirimi')}: {hesap.currency ?? 'USD'}
                {semaEtiketi ? ` · ${semaEtiketi}` : ''}
              </Text>
            </View>
          ) : (
            <View style={styles.bosKart}>
              <Ionicons name="business-outline" size={20} color={RenkTokenlari.textDim} />
              <Text style={styles.bosYazi}>{t('yayinciK.hesapYok')}</Text>
            </View>
          )}

          <View style={styles.uyariKart}>
            <Ionicons name="shield-checkmark-outline" size={15} color={RenkTokenlari.accent} />
            <Text style={styles.uyariYazi}>{t('yayinciK.guncellemeUyari')}</Text>
          </View>

          <View style={styles.form}>
            <ProfilSecimAlani
              label={t('yayinciK.hesapUlke')}
              valueLabel={ulkeEtiketi || ulke}
              placeholder={t('ortak.ara')}
              searchable
              options={ulkeSecenekleri}
              onSelect={ulkeDegistir}
            />

            {(ulkeDurum?.methods ?? []).length > 1 ? (
              <Alan label={t('yayinciK.odemeYontemi')}>
                <View style={styles.yontemSatir}>
                  {(ulkeDurum?.methods ?? []).map((m) => {
                    const secili = (seciliYontem?.method ?? '') === m.method;
                    return (
                      <Pressable
                        key={m.method}
                        onPress={() => yontemDegistir(m.method)}
                        style={[styles.yontemCip, secili && styles.yontemCipSecili]}
                      >
                        <Text
                          style={[styles.yontemYazi, secili && styles.yontemYaziSecili]}
                        >
                          {t(
                            m.method === 'wallet_transfer'
                              ? 'yayinciK.yontemCuzdan'
                              : m.method === 'local_transfer'
                                ? 'yayinciK.yontemYerel'
                                : 'yayinciK.yontemBanka',
                          )}
                        </Text>
                        {!m.is_enabled ? (
                          <Text style={styles.yontemKapali}>{t('yayinciK.uygunlukEksik')}</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </Alan>
            ) : null}

            <Alan label={t('yayinciK.hesapSahibi')}>
              <TextInput
                value={sahip}
                onChangeText={setSahip}
                placeholder={t('yayinciK.hesapSahibiPh')}
                placeholderTextColor={RenkTokenlari.textDim}
                autoCapitalize="words"
                style={styles.girdi}
              />
            </Alan>

            {bankaListesi.length > 0 ? (
              <>
                <ProfilSecimAlani
                  label={t('yayinciK.bankaSec')}
                  valueLabel={
                    seciliBanka?.name ??
                    (bankaElle ? t('yayinciK.bankaListedeYok') : bankaEtiketi)
                  }
                  placeholder={t('yayinciK.bankaSecPh')}
                  searchable
                  options={bankaSecenekleri}
                  onSelect={bankaSecildi}
                />
                <Text style={styles.alanIpucu}>
                  {t('yayinciK.bankaListeIpucu', { sayi: bankaListesi.length })}
                </Text>
              </>
            ) : null}

            {elleGoster ? (
              <Alan
                label={
                  bankaZorunlu ? t('yayinciK.bankaAdi') : t('yayinciK.bankaAdiOpsiyonel')
                }
                ipucu={bankaListesi.length > 0 ? t('yayinciK.bankaElleIpucu') : undefined}
              >
                <TextInput
                  value={banka}
                  onChangeText={setBanka}
                  placeholder={t('yayinciK.bankaAdiPh')}
                  placeholderTextColor={RenkTokenlari.textDim}
                  style={styles.girdi}
                />
              </Alan>
            ) : null}

            {kurallar && (kurallar.iban_length || kurallar.note) ? (
              <View style={styles.kuralKart}>
                <Ionicons name="information-circle-outline" size={14} color={RenkTokenlari.accent} />
                <Text style={styles.kuralYazi}>
                  {kurallar.iban_length
                    ? t('yayinciK.ibanKural', { uzunluk: kurallar.iban_length })
                    : kurallar.note}
                </Text>
              </View>
            ) : null}

            {semaYukleniyor ? (
              <ActivityIndicator color={RenkTokenlari.textDim} size="small" />
            ) : null}

            {alanlar.map((alan) => (
              <DinamikAlan
                key={alan.key}
                alan={alan}
                deger={alanDegerleri[alan.key] ?? ''}
                hata={alanHatalari[alan.key] ?? null}
                onChange={(v) => degerAyarla(alan.key, v)}
              />
            ))}

            {kurallar?.currency ? (
              <View style={styles.alan}>
                <Text style={styles.alanEtiket}>{t('yayinciK.paraBirimi')}</Text>
                <View style={[styles.girdi, styles.girdiSaltOkunur]}>
                  <Text style={styles.girdiYazi}>{paraBirimi}</Text>
                </View>
                <Text style={styles.alanIpucu}>{t('yayinciK.paraBirimiOtomatik')}</Text>
              </View>
            ) : (
              <Alan label={t('yayinciK.paraBirimi')}>
                <TextInput
                  value={paraBirimi}
                  onChangeText={(v) => setParaBirimi(v.toUpperCase().slice(0, 3))}
                  placeholder="USD"
                  placeholderTextColor={RenkTokenlari.textDim}
                  autoCapitalize="characters"
                  maxLength={3}
                  style={styles.girdi}
                />
              </Alan>
            )}

            {kanalKapali ? (
              <View style={[styles.ulkeKart, styles.ulkeKartKapali]}>
                <Ionicons name="warning-outline" size={15} color={RenkTokenlari.accent} />
                <Text style={styles.ulkeYazi}>{t('yayinciK.ulkeKanalKapali')}</Text>
              </View>
            ) : null}

            <View
              style={[
                styles.ulkeKart,
                !ulkeDurum && { backgroundColor: `${RenkTokenlari.textDim}12` },
              ]}
            >
              <Ionicons
                name={ulkeDurum?.supported ? 'checkmark-circle-outline' : 'information-circle-outline'}
                size={15}
                color={ulkeDurum?.supported ? RenkTokenlari.mint : RenkTokenlari.textMuted}
              />
              <Text style={styles.ulkeYazi}>
                {ulkeDurum
                  ? ulkeDurum.supported
                    ? t('yayinciK.ulkeDestekli')
                    : t('yayinciK.ulkeDesteklenmiyor')
                  : t('yayinciK.ulkeSecin')}
              </Text>
            </View>

            <Text style={styles.manuelNot}>{t('yayinciK.manuelOdemeNotu')}</Text>

            <Pressable
              onPress={kaydet}
              disabled={kaydediyor || kanalKapali}
              style={({ pressed }) => [
                styles.kaydetDugme,
                (pressed || kaydediyor || kanalKapali) && { opacity: 0.75 },
              ]}
            >
              {kaydediyor ? (
                <ActivityIndicator color={RenkTokenlari.textOnPrimary} size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={16} color={RenkTokenlari.textOnPrimary} />
                  <Text style={styles.kaydetYazi}>{t('yayinciK.hesapKaydet')}</Text>
                </>
              )}
            </Pressable>
            <Text style={styles.not}>{t('yayinciK.hesapGizlilikNotu')}</Text>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function DinamikAlan({
  alan,
  deger,
  hata,
  onChange,
}: {
  alan: YayinciOdemeAlani;
  deger: string;
  hata: CeviriAnahtari | null;
  onChange: (v: string) => void;
}) {
  const { t } = useCeviri();
  const etiket = ALAN_ETIKET[alan.key.toLowerCase()]
    ? t(ALAN_ETIKET[alan.key.toLowerCase()]!)
    : alan.key.replace(/_/g, ' ');
  const zorunlu = alan.required !== false;
  const baslik = zorunlu ? etiket : `${etiket} (${t('yayinciK.opsiyonel')})`;
  const ipucu = alan.example ? t('yayinciK.alanOrnek', { ornek: alan.example }) : undefined;

  if (alan.enum && alan.enum.length > 0) {
    const secili =
      alan.enum.find((e) => e.toLowerCase() === deger.toLowerCase()) ?? '';
    const seciliEtiket = secili
      ? t(ENUM_ETIKET[secili.toLowerCase()] ?? 'yayinciK.alanDiger')
      : '';
    return (
      <ProfilSecimAlani
        label={baslik}
        valueLabel={seciliEtiket}
        options={alan.enum.map((e) => ({
          id: e,
          label: t(ENUM_ETIKET[e.toLowerCase()] ?? 'yayinciK.alanDiger'),
        }))}
        onSelect={onChange}
      />
    );
  }

  const buyuk = BUYUK_HARF_ALANLARI.has(alan.key.toLowerCase());
  const numara = NUMARA_ALANLARI.has(alan.key.toLowerCase()) || alan.numeric === true;

  return (
    <Alan label={baslik} ipucu={ipucu} hata={hata ? t(hata) : null}>
      <TextInput
        value={deger}
        onChangeText={(v) => onChange(buyuk ? v.toUpperCase() : v)}
        placeholder={alan.example ?? etiket}
        placeholderTextColor={RenkTokenlari.textDim}
        autoCapitalize={buyuk ? 'characters' : 'none'}
        autoCorrect={false}
        keyboardType={numara ? 'number-pad' : 'default'}
        maxLength={alan.max_length}
        style={[styles.girdi, hata ? styles.girdiHatali : null]}
      />
    </Alan>
  );
}

function Alan({
  label,
  ipucu,
  hata,
  children,
}: {
  label: string;
  ipucu?: string;
  hata?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.alan}>
      <Text style={styles.alanEtiket}>{label}</Text>
      {children}
      {hata ? (
        <Text style={styles.alanHata}>{hata}</Text>
      ) : ipucu ? (
        <Text style={styles.alanIpucu}>{ipucu}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  merkez: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mevcutKart: {
    gap: 8,
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  mevcutUst: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mevcutIkon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${RenkTokenlari.accent}1F`,
  },
  mevcutBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 13,
  },
  mevcutAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  mevcutMeta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 9.5 },
  durumCip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: YaricapTokenlari.pill },
  durumCipYazi: { ...TipografiTokenlari.micro, fontSize: 9, fontWeight: '800' },
  bosKart: {
    alignItems: 'center',
    gap: 8,
    padding: 22,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  bosYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, fontSize: 12 },
  uyariKart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: 12,
    backgroundColor: `${RenkTokenlari.accent}12`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${RenkTokenlari.accent}33`,
  },
  uyariYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10,
    lineHeight: 15,
    flex: 1,
  },
  form: {
    gap: 12,
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  alan: { gap: 5 },
  alanEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  alanIpucu: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
    lineHeight: 13,
  },
  alanHata: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.danger,
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: '700',
  },
  girdi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontSize: 13.5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  girdiHatali: { borderColor: `${RenkTokenlari.danger}88` },
  girdiSaltOkunur: { backgroundColor: `${RenkTokenlari.textDim}12` },
  girdiYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    fontSize: 13.5,
    fontWeight: '700',
  },
  yontemSatir: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  yontemCip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
  yontemCipSecili: {
    borderColor: RenkTokenlari.primarySoft,
    backgroundColor: `${RenkTokenlari.primarySoft}1F`,
  },
  yontemYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10.5,
    fontWeight: '700',
  },
  yontemYaziSecili: { color: RenkTokenlari.text },
  yontemKapali: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 8,
    marginTop: 1,
  },
  kuralKart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    padding: 9,
    borderRadius: 10,
    backgroundColor: `${RenkTokenlari.accent}10`,
  },
  kuralYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 9.5,
    lineHeight: 14,
    flex: 1,
  },
  ulkeKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 9,
    borderRadius: 10,
    backgroundColor: `${RenkTokenlari.mint}12`,
  },
  ulkeKartKapali: { backgroundColor: `${RenkTokenlari.accent}14` },
  ulkeYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 9.5,
    flex: 1,
  },
  manuelNot: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
    lineHeight: 13,
  },
  kaydetDugme: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.primary,
    marginTop: 2,
  },
  kaydetYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '900',
    fontSize: 13,
  },
  not: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 8.5,
    textAlign: 'center',
    lineHeight: 12,
  },
});
