import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
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
import { ProfilSecimAlani } from '../../../src/moduller/kullanici-profili/bilesenler/ProfilSecimAlani';
import {
  ulkeLigiKatalogBirlestir,
  type UlkeListeOgesi,
} from '../../../src/moduller/ulke-ligi/utils/UlkeListesi';
import { ulkeBayragi } from '../../../src/moduller/kisiler-kesif/utils/KisilerYardimcilar';
import { VerifyUlkeKoduGetir } from '../../../src/moduller/tamuso-verify/VerifyApi';
import {
  ODEME_BELGE_MAX_BAYT,
  OdemeBelgesiYukle,
  OdemeProfiliGetir,
  OdemeProfiliKaydet,
  type OdemeBelgeTuru,
  type OdemeProfiliBelgesi,
  type OdemeProfiliEksigi,
  type OdemeProfiliVerisi,
} from '../../../src/moduller/cuzdan/yayinci/OdemeProfiliApi';
import { OdemeBelgeleriKarti } from '../../../src/moduller/cuzdan/yayinci/bilesenler/OdemeBelgeleriKarti';

const EKSIK_ETIKET: Record<OdemeProfiliEksigi, CeviriAnahtari> = {
  profil: 'yayinciK.eksikProfil',
  ad: 'yayinciK.eksikAd',
  soyad: 'yayinciK.eksikSoyad',
  telefon: 'yayinciK.eksikTelefon',
  ulke: 'yayinciK.eksikUlke',
  vergi_no: 'yayinciK.eksikVergiNo',
  sirket_adi: 'yayinciK.eksikSirketAdi',
  sirket_vergi_no: 'yayinciK.eksikSirketVergiNo',
  vergi_belgesi: 'yayinciK.eksikVergiBelgesi',
  sirket_belgesi: 'yayinciK.eksikSirketBelgesi',
};

function hataAnahtari(kod: string | undefined): CeviriAnahtari {
  switch (kod) {
    case 'invalid_country':
      return 'yayinciK.hataUlke';
    case 'invalid_first_name':
      return 'yayinciK.profilHataAd';
    case 'invalid_last_name':
      return 'yayinciK.profilHataSoyad';
    case 'invalid_phone':
      return 'yayinciK.profilHataTelefon';
    case 'invalid_tax_number':
      return 'yayinciK.profilHataVergiNo';
    case 'company_name_required':
      return 'yayinciK.profilHataSirketAdi';
    case 'company_tax_number_required':
    case 'invalid_company_tax_number':
      return 'yayinciK.profilHataSirketVergiNo';
    case 'company_not_declared':
      return 'yayinciK.profilHataSirketYok';
    case 'profile_required':
      return 'yayinciK.profilHataOnceKaydet';
    case 'invalid_file_size':
      return 'yayinciK.profilHataDosyaBoyut';
    case 'invalid_mime':
    case 'invalid_doc_type':
      return 'yayinciK.profilHataDosyaTuru';
    case 'upload_failed':
      return 'yayinciK.profilHataYukleme';
    case 'invalid_storage_path':
      return 'yayinciK.profilHataYukleme';
    default:
      return 'yayinciK.hata';
  }
}

function profilDurumRengi(veri: OdemeProfiliVerisi | null): string {
  switch (veri?.status) {
    case 'verified':
      return RenkTokenlari.mint;
    case 'submitted':
      return RenkTokenlari.violet;
    case 'rejected':
      return RenkTokenlari.danger;
    default:
      return RenkTokenlari.accent;
  }
}

function durumAnahtari(veri: OdemeProfiliVerisi | null): CeviriAnahtari {
  switch (veri?.status) {
    case 'verified':
      return 'yayinciK.profilDurumDogrulandi';
    case 'submitted':
      return 'yayinciK.profilDurumIncelemede';
    case 'rejected':
      return 'yayinciK.profilDurumReddedildi';
    default:
      return 'yayinciK.profilDurumEksik';
  }
}

/** Sabit boş dizi — memo karşılaştırmasında her karede yeni referans üretmesin. */
const BOS_BELGELER: OdemeProfiliBelgesi[] = [];

export default function OdemeProfiliEkrani() {
  const { t } = useCeviri();
  const [veri, setVeri] = useState<OdemeProfiliVerisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [yuklenenTur, setYuklenenTur] = useState<OdemeBelgeTuru | null>(null);
  const [kaydetHata, setKaydetHata] = useState<string | null>(null);
  const [yuklemeNotu, setYuklemeNotu] = useState<string | null>(null);

  const [ulke, setUlke] = useState('TR');
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [telefon, setTelefon] = useState('');
  const [vergiNo, setVergiNo] = useState('');
  const [vergiDairesi, setVergiDairesi] = useState('');
  const [sirketYok, setSirketYok] = useState(true);
  const [sirketAdi, setSirketAdi] = useState('');
  const [sirketVergiNo, setSirketVergiNo] = useState('');
  /** Aynı anda iki kaydet/yükleme isteği gitmesin. */
  const mesgulRef = useRef(false);
  mesgulRef.current = kaydediyor || yuklenenTur != null;
  /** Belge seçim akışı (kaydet → dosya seç → yükle) tek seferde çalışsın. */
  const secimRef = useRef(false);
  /** Belge akışının anlık form/kaydet erişimi — callback kimliği sabit kalsın. */
  const akisRef = useRef<{
    kaydet: (sessiz?: boolean) => Promise<boolean>;
    formDegisti: boolean;
    exists: boolean;
  }>({ kaydet: async () => false, formDegisti: false, exists: false });

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
    const secili = ulkeler.find((u) => u.code === ulke);
    return `${ulkeBayragi(ulke)} ${secili?.name ?? ''}`.trim();
  }, [ulkeler, ulke]);

  const formuDoldur = useCallback((v: OdemeProfiliVerisi, varsayilanUlke: string) => {
    const p = v.profile;
    if (!p) {
      setUlke(varsayilanUlke || 'TR');
      return;
    }
    setUlke(p.country_code || varsayilanUlke || 'TR');
    setAd(p.legal_first_name ?? '');
    setSoyad(p.legal_last_name ?? '');
    setTelefon(p.phone ?? '');
    setVergiNo(p.tax_number ?? '');
    setVergiDairesi(p.tax_office ?? '');
    setSirketYok(!p.has_company);
    setSirketAdi(p.company_name ?? '');
    setSirketVergiNo(p.company_tax_number ?? '');
  }, []);

  /** Formda kaydedilmemiş değişiklik var mı — belge yüklemeden önce otomatik kayıt için. */
  const formDegisti = useMemo(() => {
    const p = veri?.profile;
    if (!p) {
      return Boolean(
        ad.trim() || soyad.trim() || telefon.trim() || vergiNo.trim(),
      );
    }
    return (
      (p.country_code ?? '') !== ulke ||
      (p.legal_first_name ?? '') !== ad.trim() ||
      (p.legal_last_name ?? '') !== soyad.trim() ||
      (p.phone ?? '') !== telefon.trim() ||
      (p.tax_number ?? '') !== vergiNo.trim() ||
      (p.tax_office ?? '') !== vergiDairesi.trim() ||
      p.has_company === sirketYok ||
      (p.company_name ?? '') !== sirketAdi.trim() ||
      (p.company_tax_number ?? '') !== sirketVergiNo.trim()
    );
  }, [
    veri?.profile,
    ulke,
    ad,
    soyad,
    telefon,
    vergiNo,
    vergiDairesi,
    sirketYok,
    sirketAdi,
    sirketVergiNo,
  ]);

  const yukle = useCallback(async () => {
    try {
      const varsayilanUlke = await VerifyUlkeKoduGetir().catch(() => 'TR');
      const v = await OdemeProfiliGetir();
      setVeri(v);
      formuDoldur(v, varsayilanUlke);
      setKaydetHata(null);
    } catch {
      // Ağ hatasında eldeki veriyi silme; kart boşalıp yanlış yönlendirmesin.
      setKaydetHata((onceki) => onceki ?? t('yayinciK.yuklenemedi'));
    } finally {
      setYukleniyor(false);
    }
  }, [formuDoldur, t]);

  /** Odak dönüşünde tazele — kaydetme/yükleme sürerken üstüne yazma. */
  useFocusEffect(
    useCallback(() => {
      if (mesgulRef.current) return;
      void yukle();
    }, [yukle]),
  );

  /**
   * Profil kaydı. `sessiz` → belge yüklemeden önceki otomatik kayıt:
   * başarı bildirimi gösterilmez, hata satır içi kalır.
   */
  const kaydet = useCallback(
    async (sessiz = false): Promise<boolean> => {
      if (mesgulRef.current) return false;
      mesgulRef.current = true;
      setKaydediyor(true);
      setKaydetHata(null);
      try {
        const r = await OdemeProfiliKaydet({
          countryCode: ulke,
          firstName: ad,
          lastName: soyad,
          phone: telefon,
          taxNumber: vergiNo,
          taxOffice: vergiDairesi,
          hasCompany: !sirketYok,
          companyName: sirketAdi,
          companyTaxNumber: sirketVergiNo,
          companyCountryCode: sirketYok ? null : ulke,
        });
        if (!r.ok) {
          const mesaj = t(hataAnahtari(r.kod));
          setKaydetHata(mesaj);
          if (!sessiz) Alert.alert(t('yayinciK.hata'), mesaj);
          return false;
        }
        setVeri(r.veri);
        formuDoldur(r.veri, r.veri.profile?.country_code ?? ulke);
        if (sessiz) {
          setYuklemeNotu(t('yayinciK.belgeOtoKaydedildi'));
        } else {
          Alert.alert(t('yayinciK.profilKaydedildi'), t('yayinciK.profilKaydedildiAlt'));
        }
        return true;
      } catch {
        const mesaj = t('yayinciK.hata');
        setKaydetHata(mesaj);
        if (!sessiz) Alert.alert(t('yayinciK.hata'), mesaj);
        return false;
      } finally {
        mesgulRef.current = false;
        setKaydediyor(false);
      }
    },
    [
      ad,
      soyad,
      telefon,
      vergiNo,
      vergiDairesi,
      sirketYok,
      sirketAdi,
      sirketVergiNo,
      ulke,
      t,
      formuDoldur,
    ],
  );

  /**
   * Belge seçimi — buton hiçbir zaman "ölü" değil:
   * profilsiz veya kaydedilmemiş değişiklik varsa dosya seçmeden önce
   * form sessizce kaydedilir, sonra sunucu `profile_required` dönmez.
   *
   * Güncel form değerleri ref'ten okunur → callback kimliği sabit kalır ve
   * doküman kartı her tuş vuruşunda yeniden çizilmez.
   */
  akisRef.current = { kaydet, formDegisti, exists: Boolean(veri?.exists) };
  const belgeSec = useCallback(
    async (tur: OdemeBelgeTuru) => {
      if (secimRef.current || mesgulRef.current) return;
      secimRef.current = true;
      setKaydetHata(null);
      setYuklemeNotu(null);
      try {
        const anlik = akisRef.current;
        if (!anlik.exists || anlik.formDegisti) {
          const kaydedildi = await anlik.kaydet(true);
          if (!kaydedildi) return;
        }

        let secilen: DocumentPicker.DocumentPickerAsset;
        try {
          const sonuc = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'image/*'],
            copyToCacheDirectory: true,
            multiple: false,
          });
          if (sonuc.canceled || !sonuc.assets?.length) return;
          secilen = sonuc.assets[0]!;
        } catch {
          Alert.alert(t('yayinciK.hata'), t('yayinciK.profilHataYukleme'));
          return;
        }

        if (secilen.size != null && secilen.size > ODEME_BELGE_MAX_BAYT) {
          Alert.alert(t('yayinciK.hata'), t('yayinciK.profilHataDosyaBoyut'));
          return;
        }

        setYuklenenTur(tur);
        try {
          const r = await OdemeBelgesiYukle({
            tur,
            uri: secilen.uri,
            dosyaAdi: secilen.name ?? `${tur}.pdf`,
            mime: secilen.mimeType ?? null,
            byteSize: secilen.size ?? null,
          });
          if (!r.ok) {
            Alert.alert(t('yayinciK.hata'), t(hataAnahtari(r.kod)));
            return;
          }

          // Tam profil çekmeyi beklemeden satırı yerinde güncelle.
          const yeni: OdemeProfiliBelgesi = {
            id: r.veri.id,
            doc_type: r.veri.doc_type,
            version: r.veri.version,
            status: 'submitted',
            file_name: secilen.name ?? null,
            mime: secilen.mimeType ?? '',
            byte_size: secilen.size ?? null,
            created_at: new Date().toISOString(),
            review_note: null,
            reviewed_at: null,
          };
          setVeri((v) =>
            v ? { ...v, documents: [yeni, ...v.documents] } : v,
          );
          setYuklemeNotu(
            t('yayinciK.belgeYuklendiAlt', { surum: r.veri.version }),
          );

          // Durum/eksikler sunucuda değişti; arka planda sessiz tazele.
          void OdemeProfiliGetir()
            .then((taze) => setVeri(taze))
            .catch(() => undefined);
        } catch {
          Alert.alert(t('yayinciK.hata'), t('yayinciK.profilHataYukleme'));
        }
      } finally {
        secimRef.current = false;
        setYuklenenTur(null);
      }
    },
    [t],
  );

  const belgeSecCb = useCallback(
    (tur: OdemeBelgeTuru) => {
      void belgeSec(tur);
    },
    [belgeSec],
  );

  const durumRenk = profilDurumRengi(veri);
  const gerekli = useMemo<OdemeBelgeTuru[]>(() => {
    if (veri?.belge_gerekli?.length) return veri.belge_gerekli;
    return sirketYok
      ? ['tax_certificate']
      : ['tax_certificate', 'company_registration'];
  }, [veri?.belge_gerekli, sirketYok]);

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title={t('yayinciK.profilBaslik')}
        subtitle={t('yayinciK.profilAlt')}
        fallbackHref={'/cuzdan/yayinci-kazanclari' as any}
      />
      {yukleniyor ? (
        <View style={styles.merkez}>
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.durumKart, { borderColor: `${durumRenk}44` }]}>
            <View style={[styles.durumIkon, { backgroundColor: `${durumRenk}1F` }]}>
              <Ionicons
                name={veri?.status === 'verified' ? 'shield-checkmark' : 'id-card-outline'}
                size={18}
                color={durumRenk}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.durumBaslik}>{t('yayinciK.profilBaslik')}</Text>
              <Text style={styles.durumMetin} numberOfLines={2}>
                {t('yayinciK.profilTekYerNotu')}
              </Text>
            </View>
            <View style={[styles.durumCip, { backgroundColor: `${durumRenk}1F` }]}>
              <Text style={[styles.durumCipYazi, { color: durumRenk }]}>
                {t(durumAnahtari(veri))}
              </Text>
            </View>
          </View>

          {veri?.status === 'rejected' && veri.profile?.rejection_reason ? (
            <View style={styles.redKart}>
              <Ionicons name="alert-circle-outline" size={14} color={RenkTokenlari.danger} />
              <Text style={styles.redYazi}>{veri.profile.rejection_reason}</Text>
            </View>
          ) : null}

          {veri?.eksikler.length ? (
            <View style={styles.eksikKart}>
              <Text style={styles.eksikBaslik}>{t('yayinciK.profilEksikBaslik')}</Text>
              <View style={styles.eksikCiplar}>
                {veri.eksikler
                  .filter((e) => e !== 'profil')
                  .map((e) => (
                    <View key={e} style={styles.eksikCip}>
                      <Text style={styles.eksikCipYazi}>{t(EKSIK_ETIKET[e])}</Text>
                    </View>
                  ))}
              </View>
            </View>
          ) : null}

          <Bolum baslik={t('yayinciK.profilKisiselBaslik')} ikon="person-outline">
            <Alan label={t('yayinciK.hesapUlke')}>
              <ProfilSecimAlani
                label=""
                valueLabel={ulkeEtiketi || ulke}
                placeholder={t('ortak.ara')}
                searchable
                options={ulkeSecenekleri}
                onSelect={(kod) => setUlke(kod.toUpperCase())}
              />
              <Text style={styles.ipucu}>{t('yayinciK.profilUlkeIpucu')}</Text>
            </Alan>

            <View style={styles.ikili}>
              <View style={{ flex: 1 }}>
                <Alan label={t('yayinciK.profilAd')}>
                  <TextInput
                    value={ad}
                    onChangeText={setAd}
                    placeholder={t('yayinciK.profilAdPh')}
                    placeholderTextColor={RenkTokenlari.textDim}
                    autoCapitalize="words"
                    style={styles.girdi}
                  />
                </Alan>
              </View>
              <View style={{ flex: 1 }}>
                <Alan label={t('yayinciK.profilSoyad')}>
                  <TextInput
                    value={soyad}
                    onChangeText={setSoyad}
                    placeholder={t('yayinciK.profilSoyadPh')}
                    placeholderTextColor={RenkTokenlari.textDim}
                    autoCapitalize="words"
                    style={styles.girdi}
                  />
                </Alan>
              </View>
            </View>

            <Alan label={t('yayinciK.profilTelefon')}>
              <TextInput
                value={telefon}
                onChangeText={setTelefon}
                placeholder="+90 5xx xxx xx xx"
                placeholderTextColor={RenkTokenlari.textDim}
                keyboardType="phone-pad"
                style={styles.girdi}
              />
            </Alan>

            <Text style={styles.ipucu}>{t('yayinciK.profilAdNotu')}</Text>
          </Bolum>

          <Bolum baslik={t('yayinciK.profilVergiBaslik')} ikon="receipt-outline">
            <Alan label={t('yayinciK.profilVergiNo')}>
              <TextInput
                value={vergiNo}
                onChangeText={(v) => setVergiNo(v.toUpperCase())}
                placeholder={t('yayinciK.profilVergiNoPh')}
                placeholderTextColor={RenkTokenlari.textDim}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={24}
                style={styles.girdi}
              />
            </Alan>
            <Alan label={t('yayinciK.profilVergiDairesi')}>
              <TextInput
                value={vergiDairesi}
                onChangeText={setVergiDairesi}
                placeholder={t('yayinciK.profilVergiDairesiPh')}
                placeholderTextColor={RenkTokenlari.textDim}
                style={styles.girdi}
              />
            </Alan>
            <Text style={styles.ipucu}>{t('yayinciK.profilVergiIpucu')}</Text>
          </Bolum>

          <Bolum baslik={t('yayinciK.profilSirketBaslik')} ikon="business-outline">
            <Pressable
              onPress={() => setSirketYok(!sirketYok)}
              style={styles.onaySatir}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: sirketYok }}
            >
              <View style={[styles.onayKutu, sirketYok && styles.onayKutuAktif]}>
                {sirketYok ? (
                  <Ionicons name="checkmark" size={13} color={RenkTokenlari.textOnPrimary} />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.onayYazi}>{t('yayinciK.profilSirketYok')}</Text>
                <Text style={styles.ipucu}>{t('yayinciK.profilSirketYokAlt')}</Text>
              </View>
            </Pressable>

            {sirketYok ? (
              <View style={styles.sirketYokKart}>
                <Ionicons name="person-outline" size={14} color={RenkTokenlari.mint} />
                <Text style={styles.sirketYokYazi}>{t('yayinciK.profilSirketYokBeyan')}</Text>
              </View>
            ) : (
              <>
                <Alan label={t('yayinciK.profilSirketAdi')}>
                  <TextInput
                    value={sirketAdi}
                    onChangeText={setSirketAdi}
                    placeholder={t('yayinciK.profilSirketAdiPh')}
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.girdi}
                  />
                </Alan>
                <Alan label={t('yayinciK.profilSirketVergiNo')}>
                  <TextInput
                    value={sirketVergiNo}
                    onChangeText={(v) => setSirketVergiNo(v.toUpperCase())}
                    placeholder={t('yayinciK.profilSirketVergiNoPh')}
                    placeholderTextColor={RenkTokenlari.textDim}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={24}
                    style={styles.girdi}
                  />
                </Alan>
              </>
            )}
          </Bolum>

          <Bolum baslik={t('yayinciK.profilBankaBaslik')} ikon="card-outline">
            <View style={styles.bankaKart}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.bankaBaslik} numberOfLines={1}>
                  {veri?.banka.exists
                    ? (veri.banka.account_holder ?? t('yayinciK.hesapSahibi'))
                    : t('yayinciK.hesapYok')}
                </Text>
                <Text style={styles.bankaAlt} numberOfLines={1}>
                  {veri?.banka.exists
                    ? `${veri.banka.bank_name ?? '—'} · ${Object.values(veri.banka.masked)
                        .filter(Boolean)
                        .join(' · ')}`
                    : t('yayinciK.profilBankaYokAlt')}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/cuzdan/yayinci-kazanclari/odeme-hesabi' as any)}
                style={styles.bankaBtn}
              >
                <Text style={styles.bankaBtnYazi}>
                  {t(veri?.banka.exists ? 'yayinciK.profilBankaDuzenle' : 'yayinciK.profilBankaEkle')}
                </Text>
                <Ionicons name="chevron-forward" size={12} color={RenkTokenlari.primarySoft} />
              </Pressable>
            </View>
            <Text style={styles.ipucu}>{t('yayinciK.profilBankaIpucu')}</Text>
          </Bolum>

          <OdemeBelgeleriKarti
            belgeler={veri?.documents ?? BOS_BELGELER}
            gerekli={gerekli}
            sirketVar={!sirketYok}
            profilKayitli={Boolean(veri?.exists)}
            yuklenenTur={yuklenenTur}
            onYukle={belgeSecCb}
          />

          {yuklemeNotu ? (
            <View style={styles.basariKart}>
              <Ionicons name="checkmark-circle" size={14} color={RenkTokenlari.mint} />
              <Text style={styles.basariYazi}>{yuklemeNotu}</Text>
            </View>
          ) : null}

          {!veri?.exists ? (
            <View style={styles.bilgiKart}>
              <Ionicons name="information-circle-outline" size={14} color={RenkTokenlari.accent} />
              <Text style={styles.bilgiYazi}>{t('yayinciK.belgeOtoKayit')}</Text>
            </View>
          ) : null}

          {kaydetHata ? (
            <View style={styles.hataKart}>
              <Ionicons name="alert-circle-outline" size={14} color={RenkTokenlari.danger} />
              <Text style={styles.hataYazi} numberOfLines={3}>
                {kaydetHata}
              </Text>
            </View>
          ) : null}

          {!kaydetHata && formDegisti ? (
            <View style={styles.bekleyenKart}>
              <Ionicons name="ellipse" size={7} color={RenkTokenlari.accent} />
              <Text style={styles.bekleyenYazi}>{t('yayinciK.kaydedilmemisDegisiklik')}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => void kaydet()}
            disabled={kaydediyor}
            accessibilityRole="button"
            accessibilityState={{ disabled: kaydediyor, busy: kaydediyor }}
            style={({ pressed }) => [
              styles.kaydetDugme,
              (pressed || kaydediyor) && { opacity: 0.75 },
            ]}
          >
            {kaydediyor ? (
              <ActivityIndicator color={RenkTokenlari.textOnPrimary} size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color={RenkTokenlari.textOnPrimary} />
                <Text style={styles.kaydetYazi}>{t('yayinciK.profilKaydet')}</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.not}>{t('yayinciK.profilGizlilikNotu')}</Text>
        </ScrollView>
      )}
    </Screen>
  );
}

function Bolum({
  baslik,
  ikon,
  children,
}: {
  baslik: string;
  ikon: React.ComponentProps<typeof Ionicons>['name'];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.bolum}>
      <View style={styles.bolumUst}>
        <Ionicons name={ikon} size={16} color={RenkTokenlari.accent} />
        <Text style={styles.bolumBaslik}>{baslik}</Text>
      </View>
      {children}
    </View>
  );
}

function Alan({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.alan}>
      {label ? <Text style={styles.alanEtiket}>{label}</Text> : null}
      {children}
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
  durumKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
  },
  durumIkon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durumBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 13,
  },
  durumMetin: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 9.5,
    lineHeight: 13,
    marginTop: 1,
  },
  durumCip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: YaricapTokenlari.pill },
  durumCipYazi: { ...TipografiTokenlari.micro, fontSize: 8.5, fontWeight: '800' },
  redKart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    padding: 10,
    borderRadius: 12,
    backgroundColor: `${RenkTokenlari.danger}12`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${RenkTokenlari.danger}40`,
  },
  redYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.danger, fontSize: 9.5, flex: 1 },
  eksikKart: { gap: 6 },
  eksikBaslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  eksikCiplar: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  eksikCip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: `${RenkTokenlari.accent}14`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${RenkTokenlari.accent}40`,
  },
  eksikCipYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.accent, fontSize: 8.5, fontWeight: '700' },
  bolum: {
    gap: 10,
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  bolumUst: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bolumBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 13,
  },
  alan: { gap: 5 },
  alanEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10,
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
  ikili: { flexDirection: 'row', gap: 9 },
  ipucu: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 8.5,
    lineHeight: 12,
  },
  onaySatir: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  onayKutu: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  onayKutuAktif: { backgroundColor: RenkTokenlari.primary, borderColor: RenkTokenlari.primary },
  onayYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.text, fontSize: 10.5, fontWeight: '700' },
  sirketYokKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 9,
    borderRadius: 10,
    backgroundColor: `${RenkTokenlari.mint}12`,
  },
  sirketYokYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 9.5, flex: 1 },
  bankaKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.surface,
  },
  bankaBaslik: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '700', fontSize: 11.5 },
  bankaAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 9, marginTop: 1 },
  bankaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: `${RenkTokenlari.primarySoft}1A`,
  },
  bankaBtnYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 9.5,
    fontWeight: '800',
  },
  bilgiKart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    padding: 10,
    borderRadius: 12,
    backgroundColor: `${RenkTokenlari.accent}12`,
  },
  basariKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 10,
    borderRadius: 12,
    backgroundColor: `${RenkTokenlari.mint}14`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${RenkTokenlari.mint}40`,
  },
  basariYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontSize: 9.5,
    lineHeight: 13,
    flex: 1,
    fontWeight: '700',
  },
  hataKart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    padding: 10,
    borderRadius: 12,
    backgroundColor: `${RenkTokenlari.danger}12`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${RenkTokenlari.danger}40`,
  },
  hataYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.danger,
    fontSize: 9.5,
    lineHeight: 13,
    flex: 1,
  },
  bekleyenKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 4,
  },
  bekleyenYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    fontSize: 9.5,
    fontWeight: '700',
  },
  bilgiYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 9.5,
    lineHeight: 13,
    flex: 1,
  },
  kaydetDugme: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.primary,
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
