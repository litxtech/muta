import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { KlavyeScrollView, KlavyeFocusKaydir, type KlavyeScrollHandle } from '../../src/bilesenler/klavye/KlavyeScrollView';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { ProfilMedyaBuyutucu } from '../../src/moduller/kullanici-profili/bilesenler/ProfilMedyaBuyutucu';
import { ProfilMedyaSecenekleri } from '../../src/moduller/kullanici-profili/bilesenler/ProfilMedyaSecenekleri';
import { ProfilSecimAlani } from '../../src/moduller/kullanici-profili/bilesenler/ProfilSecimAlani';
import {
  EpostaGuncelle,
  ProfilGuncelle,
} from '../../src/moduller/kullanici-profili/islemler/ProfilGuncelle';
import {
  BankaHesabiGetir,
  BankaHesabiKaydet,
} from '../../src/moduller/kullanici-profili/islemler/BankaHesabi';
import { ProfilMedyasiSil } from '../../src/moduller/kullanici-profili/islemler/ProfilMedyasiSil';
import {
  ProfilMedyasiYukle,
  type ProfilMedyaTuru,
} from '../../src/moduller/kullanici-profili/islemler/ProfilMedyasiYukle';
import { ImagePickerOnIsit } from '../../src/ortak/medya/ImagePickerHazirMi';
import { MedyaUriGuvenli } from '../../src/moduller/mesajlasma/yardimcilar/MedyaUriGecerliMi';
import {
  BolgeleriUlkeyeGore,
  ProfilKonumKatalogunuGetir,
  type ProfilBolge,
  type ProfilUlke,
} from '../../src/moduller/kullanici-profili/okuma/ProfilKonumKatalogu';
import type { Gender } from '../../src/types/models';
import { UlkeKodunaNormalizeEt } from '../../src/ortak/ulke/UlkeKodunaNormalizeEt';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const CINSIYETLER: { id: Gender; label: string }[] = [
  { id: 'female', label: 'Kadın' },
  { id: 'male', label: 'Erkek' },
  { id: 'other', label: 'Diğer' },
  { id: 'prefer_not', label: 'Belirtmek istemiyorum' },
];

function dogumYillar(): { id: string; label: string }[] {
  const max = new Date().getFullYear() - 18;
  const min = 1925;
  const out: { id: string; label: string }[] = [];
  for (let y = max; y >= min; y -= 1) out.push({ id: String(y), label: String(y) });
  return out;
}

const AYLAR = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12',
].map((m) => ({ id: m, label: m }));

function gunler(yil: string, ay: string): { id: string; label: string }[] {
  const dim = new Date(Number(yil) || 2000, Number(ay) || 1, 0).getDate();
  return Array.from({ length: dim }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    return { id: d, label: d };
  });
}

function adSoyadAyir(displayName: string | null | undefined): {
  ad: string;
  soyad: string;
} {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { ad: '', soyad: '' };
  if (parts.length === 1) return { ad: parts[0], soyad: '' };
  return { ad: parts[0], soyad: parts.slice(1).join(' ') };
}

/** Profil: medya, kimlik, iletişim, şifre, banka/IBAN */
export default function ProfilDuzenleEkrani() {
  const { profile, user, isGuest, refreshProfile, refreshWallet, updatePassword } =
    useAuth();
  const scrollRef = useRef<KlavyeScrollHandle>(null);
  const [upgradeAcik, setUpgradeAcik] = useState(false);
  const [medyaBusy, setMedyaBusy] = useState<ProfilMedyaTuru | null>(null);
  const [buyut, setBuyut] = useState<{ uri: string; tur: ProfilMedyaTuru } | null>(
    null,
  );
  const [medyaMenuTur, setMedyaMenuTur] = useState<ProfilMedyaTuru | null>(null);
  const dirtyRef = useRef(false);
  const lastProfileId = useRef<string | null>(null);

  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [telefon, setTelefon] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [dogumYil, setDogumYil] = useState('');
  const [dogumAy, setDogumAy] = useState('');
  const [dogumGun, setDogumGun] = useState('');
  const [countryCode, setCountryCode] = useState('TR');
  const [regionId, setRegionId] = useState<string>('');
  const [ulkeler, setUlkeler] = useState<ProfilUlke[]>([]);
  const [bolgeler, setBolgeler] = useState<ProfilBolge[]>([]);
  const [profilBusy, setProfilBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const [yeniSifre, setYeniSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [sifreBusy, setSifreBusy] = useState(false);

  const [hesapSahibi, setHesapSahibi] = useState('');
  const [bankaAdi, setBankaAdi] = useState('');
  const [iban, setIban] = useState('');
  const [bankaBusy, setBankaBusy] = useState(false);
  const [bankaYukleniyor, setBankaYukleniyor] = useState(true);

  const formuDoldur = useCallback(
    (zorla = false) => {
      if (!profile) return;
      if (!zorla && dirtyRef.current && lastProfileId.current === profile.id) {
        return;
      }
      const a = adSoyadAyir(profile.display_name);
      setAd(a.ad);
      setSoyad(a.soyad);
      setUsername(profile.username ?? '');
      setBio(profile.bio ?? '');
      setTelefon(profile.phone_e164 ?? '');
      setGender((profile.gender as Gender) ?? '');
      const bd = profile.birth_date?.slice(0, 10) ?? '';
      if (bd && /^\d{4}-\d{2}-\d{2}$/.test(bd)) {
        const [y, m, d] = bd.split('-');
        setDogumYil(y);
        setDogumAy(m);
        setDogumGun(d);
      } else {
        setDogumYil('');
        setDogumAy('');
        setDogumGun('');
      }
      // country_code ISO olmalı; profiles.country görünen ad (Türkiye) olabilir — asla kod yerine kullanma
      setCountryCode(
        UlkeKodunaNormalizeEt(profile.country_code) ??
          UlkeKodunaNormalizeEt(profile.country) ??
          'TR',
      );
      setRegionId(profile.region_id ?? '');
      setEmail(user?.email ?? '');
      lastProfileId.current = profile.id;
      dirtyRef.current = false;
    },
    [profile, user?.email],
  );

  useEffect(() => {
    let iptal = false;
    void ProfilKonumKatalogunuGetir()
      .then((k) => {
        if (iptal) return;
        setUlkeler(k.countries);
        setBolgeler(k.regions);
        if (k.countries.length === 1) {
          setCountryCode((prev) => prev || k.countries[0].code);
        }
      })
      .catch(() => {
        /* migration once */
      });
    return () => {
      iptal = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      dirtyRef.current = false;
      void refreshProfile();
    }, [refreshProfile]),
  );

  useEffect(() => {
    formuDoldur(false);
  }, [formuDoldur]);

  useEffect(() => {
    ImagePickerOnIsit({ izinIste: false });
  }, []);

  useEffect(() => {
    let iptal = false;
    (async () => {
      setBankaYukleniyor(true);
      try {
        const b = await BankaHesabiGetir();
        if (iptal || !b) return;
        setHesapSahibi(b.account_holder);
        setBankaAdi(b.bank_name);
        setIban(b.iban);
      } catch {
        /* migration yoksa sessiz */
      } finally {
        if (!iptal) setBankaYukleniyor(false);
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  const setDirty = <T,>(setter: (v: T) => void) => (v: T) => {
    dirtyRef.current = true;
    setter(v);
  };

  const misafirEngel = () => {
    if (!isGuest) return false;
    setUpgradeAcik(true);
    return true;
  };

  const medyaUrl = (tur: ProfilMedyaTuru) =>
    tur === 'cover' ? profile?.cover_url ?? null : profile?.avatar_url ?? null;

  const medyaAc = (tur: ProfilMedyaTuru) => {
    if (misafirEngel()) return;
    ImagePickerOnIsit({ izinIste: false });
    setMedyaMenuTur(tur);
  };

  const medyaTikla = (tur: ProfilMedyaTuru) => {
    const url = medyaUrl(tur);
    if (url) {
      setBuyut({ uri: url, tur });
      return;
    }
    medyaAc(tur);
  };

  const medyaSec = async (tur: ProfilMedyaTuru) => {
    if (misafirEngel()) return;
    setMedyaBusy(tur);
    // Galeriyi sheet kapanmasını beklemeden başlat (gesture + native açılış)
    const sonucPromise = ProfilMedyasiYukle(tur);
    setMedyaMenuTur(null);
    const sonuc = await sonucPromise;
    setMedyaBusy(null);
    if (!sonuc.ok) {
      if (sonuc.iptal) return;
      Alert.alert('Medya', sonuc.hata);
      return;
    }
    dirtyRef.current = false;
    await refreshProfile();
  };

  const medyaSil = (tur: ProfilMedyaTuru) => {
    if (misafirEngel()) return;
    const baslik = tur === 'cover' ? 'Kapak fotoğrafı' : 'Profil fotoğrafı';
    Alert.alert(baslik, 'Bu fotoğraf silinsin mi?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setMedyaMenuTur(null);
            setMedyaBusy(tur);
            const sonuc = await ProfilMedyasiSil(tur);
            setMedyaBusy(null);
            if (!sonuc.ok) {
              Alert.alert('Medya', sonuc.hata);
              return;
            }
            dirtyRef.current = false;
            await refreshProfile();
          })();
        },
      },
    ]);
  };

  const profilKaydet = async () => {
    if (misafirEngel()) return;
    const display_name = `${ad.trim()} ${soyad.trim()}`.trim();
    if (display_name.length < 2) {
      Alert.alert('Profil', 'Ad veya soyad gir.');
      return;
    }
    let birth_date: string | null = null;
    if (dogumYil && dogumAy && dogumGun) {
      birth_date = `${dogumYil}-${dogumAy}-${dogumGun}`;
    } else if (dogumYil || dogumAy || dogumGun) {
      Alert.alert('Doğum tarihi', 'Yıl, ay ve günü birlikte seç.');
      return;
    }
    if (!regionId) {
      Alert.alert('Konum', 'İl seçimi gerekli.');
      return;
    }
    setProfilBusy(true);
    try {
      const sonuc = await ProfilGuncelle({
        display_name,
        username: username.trim() || undefined,
        bio,
        phone_e164: telefon.trim() || null,
        gender: gender || null,
        birth_date,
        country_code: UlkeKodunaNormalizeEt(countryCode) || 'TR',
        region_id: regionId,
      });
      if (!sonuc.ok) {
        Alert.alert('Profil', sonuc.hata);
        return;
      }
      dirtyRef.current = false;
      await refreshProfile();
      Alert.alert('Kaydedildi', 'Profil bilgilerin güncellendi.');
    } catch (e) {
      Alert.alert('Profil', e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setProfilBusy(false);
    }
  };

  const ilListesi = BolgeleriUlkeyeGore(bolgeler, countryCode || 'TR');
  const seciliIl = ilListesi.find((i) => i.id === regionId);
  const cinsiyetLabel =
    CINSIYETLER.find((c) => c.id === gender)?.label ?? '';
  const dogumGunOpts = gunler(dogumYil || '2000', dogumAy || '01');
  const yilOpts = dogumYillar();
  const ulkeTek = ulkeler.length <= 1;

  const emailKaydet = async () => {
    if (misafirEngel()) return;
    if (email.trim().toLowerCase() === (user?.email ?? '').toLowerCase()) {
      Alert.alert('E-posta', 'Zaten bu adresi kullanıyorsun.');
      return;
    }
    setEmailBusy(true);
    const sonuc = await EpostaGuncelle(email);
    setEmailBusy(false);
    if (!sonuc.ok) {
      Alert.alert('E-posta', sonuc.hata);
      return;
    }
    Alert.alert('E-posta', sonuc.mesaj);
  };

  const sifreKaydet = async () => {
    if (misafirEngel()) return;
    if (yeniSifre.length < 6) {
      Alert.alert('Şifre', 'En az 6 karakter olmalı.');
      return;
    }
    if (yeniSifre !== sifreTekrar) {
      Alert.alert('Şifre', 'Şifreler eşleşmiyor.');
      return;
    }
    setSifreBusy(true);
    const { error } = await updatePassword(yeniSifre);
    setSifreBusy(false);
    if (error) {
      Alert.alert('Şifre', error);
      return;
    }
    setYeniSifre('');
    setSifreTekrar('');
    Alert.alert('Şifre', 'Yeni şifren kaydedildi.');
  };

  const bankaKaydet = async () => {
    if (misafirEngel()) return;
    setBankaBusy(true);
    const sonuc = await BankaHesabiKaydet({
      account_holder: hesapSahibi,
      bank_name: bankaAdi,
      iban,
    });
    setBankaBusy(false);
    if (!sonuc.ok) {
      Alert.alert('Banka', sonuc.hata);
      return;
    }
    Alert.alert('Banka', 'IBAN ve banka bilgilerin kaydedildi.');
  };

  const klavyeKaydir = useCallback(
    (e?: Parameters<typeof KlavyeFocusKaydir>[1]) => {
      KlavyeFocusKaydir(scrollRef.current, e, { ustBosluk: 56, delayMs: 80 });
    },
    [],
  );

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Profili düzenle"
        subtitle="Kimlik · Konum · Medya · Banka"
        fallbackHref="/(tabs)/profile"
      />
      <KlavyeScrollView
        ref={scrollRef}
        style={styles.scrollFlex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        ekstraPad={56}
      >
        <Text style={styles.section}>Fotoğraflar</Text>
        <View style={styles.coverWrap}>
          <Pressable
            onPress={() => medyaTikla('cover')}
            onLongPress={() => medyaAc('cover')}
            style={styles.coverPress}
            disabled={medyaBusy !== null}
            accessibilityLabel="Kapak fotoğrafı"
          >
            {MedyaUriGuvenli(profile?.cover_url) ? (
              <Image
                source={{ uri: MedyaUriGuvenli(profile?.cover_url)! }}
                style={styles.cover}
              />
            ) : (
              <LinearGradient colors={[...RenkTokenlari.gradientPlaceholder]} style={styles.cover} />
            )}
            <View style={styles.coverOverlay} pointerEvents="none">
              {!MedyaUriGuvenli(profile?.cover_url) ? (
                <>
                  <Ionicons name="image-outline" size={18} color="#fff" />
                  <Text style={styles.coverHint}>Kapak eklemek için dokun</Text>
                </>
              ) : null}
            </View>
          </Pressable>
          <Pressable
            style={styles.coverEditBtn}
            onPress={() => medyaAc('cover')}
            disabled={medyaBusy !== null}
            accessibilityLabel="Kapak fotoğrafı düzenle"
          >
            {medyaBusy === 'cover' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={16} color="#fff" />
                <Text style={styles.coverEditText}>Düzenle</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.avatarRow}>
          <View style={styles.avatarHit}>
            <Pressable
              onPress={() => medyaTikla('avatar')}
              onLongPress={() => medyaAc('avatar')}
              style={styles.avatarWrap}
              disabled={medyaBusy !== null}
              accessibilityLabel="Profil fotoğrafı"
            >
              {MedyaUriGuvenli(profile?.avatar_url) ? (
                <Image
                  source={{ uri: MedyaUriGuvenli(profile?.avatar_url)! }}
                  style={styles.avatar}
                />
              ) : (
                <LinearGradient
                  colors={[...RenkTokenlari.gradientPrimary]}
                  style={styles.avatar}
                >
                  <Ionicons name="person" size={32} color="#12040C" />
                </LinearGradient>
              )}
            </Pressable>
            <Pressable
              style={styles.avatarCam}
              onPress={() => medyaAc('avatar')}
              disabled={medyaBusy !== null}
              hitSlop={8}
              accessibilityLabel="Profil fotoğrafı düzenle"
            >
              {medyaBusy === 'avatar' ? (
                <ActivityIndicator color="#12040C" size="small" />
              ) : (
                <Ionicons name="camera" size={12} color="#12040C" />
              )}
            </Pressable>
          </View>
          <Text style={styles.avatarHint}>
            Fotoğrafa dokunarak büyüt · kameraya dokunarak ekle, değiştir veya sil
          </Text>
        </View>

        <Text style={styles.section}>Kimlik</Text>
        <TextField
          label="Ad"
          value={ad}
          onChangeText={setDirty(setAd)}
          placeholder="Adın"
          onFocus={klavyeKaydir}
        />
        <TextField
          label="Soyad"
          value={soyad}
          onChangeText={setDirty(setSoyad)}
          placeholder="Soyadın"
          onFocus={klavyeKaydir}
        />
        <TextField
          label="Kullanıcı adı"
          value={username}
          onChangeText={setDirty(setUsername)}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="kullanici_adi"
          onFocus={klavyeKaydir}
        />
        <TextField
          label="Hakkında"
          value={bio}
          onChangeText={setDirty(setBio)}
          placeholder="Kendinden kısaca bahset"
          multiline
          style={styles.bioInput}
          onFocus={klavyeKaydir}
        />

        <Text style={styles.section}>Cinsiyet & doğum</Text>
        <ProfilSecimAlani
          label="Cinsiyet"
          valueLabel={cinsiyetLabel}
          placeholder="Seç"
          options={CINSIYETLER.map((c) => ({ id: c.id, label: c.label }))}
          onSelect={(id) => {
            dirtyRef.current = true;
            setGender(id as Gender);
          }}
        />
        <Text style={styles.fieldHint}>Platform 18 yaş ve üzeridir.</Text>
        <View style={styles.dogumSatir}>
          <View style={{ flex: 1.1 }}>
            <ProfilSecimAlani
              label="Yıl"
              valueLabel={dogumYil}
              placeholder="Yıl"
              options={yilOpts}
              onSelect={(id) => {
                dirtyRef.current = true;
                setDogumYil(id);
              }}
              searchable
            />
          </View>
          <View style={{ flex: 0.85 }}>
            <ProfilSecimAlani
              label="Ay"
              valueLabel={dogumAy}
              placeholder="Ay"
              options={AYLAR}
              onSelect={(id) => {
                dirtyRef.current = true;
                setDogumAy(id);
                if (dogumGun && Number(dogumGun) > gunler(dogumYil || '2000', id).length) {
                  setDogumGun('');
                }
              }}
            />
          </View>
          <View style={{ flex: 0.85 }}>
            <ProfilSecimAlani
              label="Gün"
              valueLabel={dogumGun}
              placeholder="Gün"
              options={dogumGunOpts}
              onSelect={(id) => {
                dirtyRef.current = true;
                setDogumGun(id);
              }}
            />
          </View>
        </View>

        <Text style={styles.section}>Konum</Text>
        <Text style={styles.sectionSub}>
          Şimdilik yalnızca Türkiye illeri. Sistem dünya geneline hazır.
        </Text>
        {!ulkeTek ? (
          <ProfilSecimAlani
            label="Ülke"
            valueLabel={
              ulkeler.find((u) => u.code === countryCode)?.name ?? countryCode
            }
            options={ulkeler.map((u) => ({ id: u.code, label: u.name }))}
            onSelect={(id) => {
              dirtyRef.current = true;
              setCountryCode(id);
              setRegionId('');
            }}
          />
        ) : (
          <View style={styles.ulkeKilit}>
            <Text style={styles.ulkeKilitLabel}>Ülke</Text>
            <Text style={styles.ulkeKilitDeger}>
              {ulkeler[0]?.name ?? 'Türkiye'}
            </Text>
          </View>
        )}
        <ProfilSecimAlani
          label="İl"
          valueLabel={seciliIl ? `${seciliIl.code} · ${seciliIl.name}` : ''}
          placeholder="81 ilden seç"
          searchable
          options={ilListesi.map((i) => ({
            id: i.id,
            label: i.name,
            alt: `Plaka ${i.code}`,
          }))}
          onSelect={(id) => {
            dirtyRef.current = true;
            setRegionId(id);
          }}
        />

        <TextField
          label="Telefon"
          value={telefon}
          onChangeText={setDirty(setTelefon)}
          keyboardType="phone-pad"
          placeholder="05xx xxx xx xx"
          onFocus={klavyeKaydir}
        />
        <GradientButton
          title="Profili kaydet"
          onPress={() => void profilKaydet()}
          loading={profilBusy}
        />

        <Text style={styles.section}>E-posta</Text>
        <TextField
          label="E-posta adresi"
          value={email}
          onChangeText={setDirty(setEmail)}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="sen@mail.com"
          onFocus={klavyeKaydir}
        />
        <GradientButton
          title="E-postayı güncelle"
          onPress={() => void emailKaydet()}
          loading={emailBusy}
          variant="ghost"
        />

        <Text style={styles.section}>Şifre</Text>
        <TextField
          label="Yeni şifre"
          value={yeniSifre}
          onChangeText={setYeniSifre}
          secureTextEntry
          placeholder="En az 6 karakter"
          onFocus={klavyeKaydir}
        />
        <TextField
          label="Şifre tekrar"
          value={sifreTekrar}
          onChangeText={setSifreTekrar}
          secureTextEntry
          placeholder="Tekrar"
          onFocus={klavyeKaydir}
        />
        <GradientButton
          title="Şifreyi değiştir"
          onPress={() => void sifreKaydet()}
          loading={sifreBusy}
          variant="ghost"
        />

        <Text style={styles.section}>Banka / IBAN</Text>
        <Text style={styles.sectionSub}>
          Elmas çekiminde kullanılır. Hesap sahibi adın kimlikle uyumlu olmalı.
        </Text>
        {bankaYukleniyor ? (
          <ActivityIndicator
            color={RenkTokenlari.primary}
            style={{ marginVertical: 12 }}
          />
        ) : (
          <>
            <TextField
              label="Hesap sahibi"
              value={hesapSahibi}
              onChangeText={setHesapSahibi}
              placeholder="Ad Soyad"
              onFocus={klavyeKaydir}
            />
            <TextField
              label="Banka adı"
              value={bankaAdi}
              onChangeText={setBankaAdi}
              placeholder="Örn. Ziraat Bankası"
              onFocus={klavyeKaydir}
            />
            <TextField
              label="IBAN"
              value={iban}
              onChangeText={setIban}
              autoCapitalize="characters"
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              onFocus={klavyeKaydir}
            />
            <GradientButton
              title="Banka bilgisini kaydet"
              onPress={() => void bankaKaydet()}
              loading={bankaBusy}
            />
          </>
        )}
      </KlavyeScrollView>

      <HesabiTamamlaKarti
        visible={upgradeAcik}
        onClose={() => setUpgradeAcik(false)}
        onCompleted={() => {
          void refreshProfile();
          void refreshWallet();
        }}
      />

      <ProfilMedyaBuyutucu
        uri={buyut?.uri ?? null}
        tur={buyut?.tur}
        onKapat={() => setBuyut(null)}
      />

      <ProfilMedyaSecenekleri
        visible={medyaMenuTur !== null}
        tur={medyaMenuTur}
        varMi={medyaMenuTur ? Boolean(medyaUrl(medyaMenuTur)) : false}
        busy={medyaBusy !== null}
        onKapat={() => setMedyaMenuTur(null)}
        onGoruntule={() => {
          if (!medyaMenuTur) return;
          const url = medyaUrl(medyaMenuTur);
          const tur = medyaMenuTur;
          setMedyaMenuTur(null);
          if (url) setBuyut({ uri: url, tur });
        }}
        onEkleVeyaDegistir={() => {
          if (medyaMenuTur) void medyaSec(medyaMenuTur);
        }}
        onSil={() => {
          if (medyaMenuTur) medyaSil(medyaMenuTur);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollFlex: { flex: 1 },
  scroll: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  section: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    marginTop: BoslukTokenlari.lg,
  },
  sectionSub: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginTop: -4,
  },
  coverWrap: {
    position: 'relative',
  },
  coverPress: {
    height: 120,
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  cover: { width: '100%', height: '100%' },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coverHint: { ...TipografiTokenlari.caption, color: '#fff', fontWeight: '600' },
  coverEditBtn: {
    position: 'absolute',
    right: BoslukTokenlari.sm,
    bottom: BoslukTokenlari.sm,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(18,4,12,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  coverEditText: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontWeight: '700',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    marginTop: -28,
    paddingLeft: BoslukTokenlari.sm,
  },
  avatarHit: {
    width: 72,
    height: 72,
    position: 'relative',
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: RenkTokenlari.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCam: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: RenkTokenlari.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: RenkTokenlari.bg,
    zIndex: 2,
  },
  avatarHint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
    marginTop: 20,
  },
  bioInput: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  dogumSatir: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
  },
  fieldHint: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginTop: -4,
  },
  ulkeKilit: {
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: 12,
    gap: 4,
  },
  ulkeKilitLabel: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  ulkeKilitDeger: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
});
