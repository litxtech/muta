import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { KlavyeKapatan } from '../../src/components/KlavyeKapatan';
import { KlavyeGuvenliAlan } from '../../src/bilesenler/klavye/KlavyeGuvenliAlan';
import { useAuth } from '../../src/contexts/AuthContext';
import { ImagePickerOnIsit } from '../../src/ortak/medya/ImagePickerHazirMi';
import { KayitBekleyenAvatarAyarla } from '../../src/moduller/kimlik-dogrulama/depolama/KayitBekleyenAvatar';
import {
  ProfilMedyasiSec,
  ProfilMedyasiUriIleYukle,
  type SecilenProfilMedya,
} from '../../src/moduller/kullanici-profili/islemler/ProfilMedyasiYukle';
import {
  PolitikaOnayKutulari,
  TumPolitikaOnaylariVerildi,
} from '../../src/moduller/politikalar/bilesenler/PolitikaOnayKutulari';
import { PolitikaOkumaPaneli } from '../../src/moduller/politikalar/bilesenler/PolitikaOkumaPaneli';
import {
  POLITIKA_METINLERI,
  type PolitikaKodu,
} from '../../src/moduller/politikalar/icerik/PolitikaMetinleri';
import { KayitPolitikaKabulKaydet } from '../../src/moduller/politikalar/islemler/PolitikaIslemleri';
import { ProfilSecimAlani } from '../../src/moduller/kullanici-profili/bilesenler/ProfilSecimAlani';
import {
  DOGUM_AYLARI,
  DogumGunSecenekleri,
  DogumYilSecenekleri,
} from '../../src/moduller/kimlik-dogrulama/yas/YasKapisi';
import {
  KayitAlanAyarlariOnbellektenAl,
  KayitAlanAyarlariPublicGet,
} from '../../src/moduller/kimlik-dogrulama/kayit-alanlari/KayitAlanAyarlariPublicGet';
import {
  KayitAlanEtiketi,
  KayitFormunuDogrula,
} from '../../src/moduller/kimlik-dogrulama/kayit-alanlari/KayitFormunuDogrula';
import {
  AlanGorunurMu,
  AlanZorunluMu,
  VARSAYILAN_KAYIT_ALAN_AYARLARI,
  type KayitAlanAyarlari,
} from '../../src/moduller/kimlik-dogrulama/kayit-alanlari/tipler';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const GENDERS = [
  { id: 'female', label: 'Kadın' },
  { id: 'male', label: 'Erkek' },
  { id: 'other', label: 'Diğer' },
] as const;

const BOS_ONAY: Record<PolitikaKodu, boolean> = {
  tos: false,
  privacy: false,
  child_safety: false,
};

const YIL_OPTS = DogumYilSecenekleri(18);
const SPOTIFY_GREEN = '#1DB954';

export default function RegisterScreen() {
  const { signUp, signInWithSpotify, refreshProfile } = useAuth();
  const [ayar, setAyar] = useState<KayitAlanAyarlari>(
    () => KayitAlanAyarlariOnbellektenAl() ?? VARSAYILAN_KAYIT_ALAN_AYARLARI,
  );
  const [ayarYukleniyor, setAyarYukleniyor] = useState(
    !KayitAlanAyarlariOnbellektenAl(),
  );
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<string>('');
  const [dogumYil, setDogumYil] = useState('');
  const [dogumAy, setDogumAy] = useState('');
  const [dogumGun, setDogumGun] = useState('');
  const [ozelDegerler, setOzelDegerler] = useState<Record<string, string>>({});
  const [avatar, setAvatar] = useState<SecilenProfilMedya | null>(null);
  const [loading, setLoading] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [onaylar, setOnaylar] = useState(BOS_ONAY);
  const [okunan, setOkunan] = useState<PolitikaKodu | null>(null);

  const ayarlariYukle = useCallback(async () => {
    setAyarYukleniyor(true);
    const d = await KayitAlanAyarlariPublicGet();
    setAyar(d);
    setAyarYukleniyor(false);
  }, []);

  useEffect(() => {
    ImagePickerOnIsit({ izinIste: false });
    void ayarlariYukle();
  }, [ayarlariYukle]);

  const avatarSec = async () => {
    const secim = await ProfilMedyasiSec('avatar');
    if (!secim.ok) {
      if (!secim.iptal) Alert.alert('Fotoğraf', secim.hata);
      return;
    }
    setAvatar(secim.medya);
  };

  const onSpotify = async () => {
    if (!TumPolitikaOnaylariVerildi(onaylar)) {
      Alert.alert(
        'Yasal onay',
        'Spotify ile kayıt için Kullanım Şartları, Gizlilik ve Çocuk Koruma politikalarını okuyup onaylamalısın.',
      );
      return;
    }
    setSpotifyLoading(true);
    const { error, cancelled } = await signInWithSpotify();
    setSpotifyLoading(false);
    if (cancelled) return;
    if (error) {
      Alert.alert('Spotify kaydı', error);
      return;
    }
    void KayitPolitikaKabulKaydet();
    router.replace('/(tabs)');
  };

  const onSubmit = async () => {
    const dogrulama = KayitFormunuDogrula(ayar, {
      username,
      displayName,
      password,
      phone,
      email,
      gender,
      dogumYil,
      dogumAy,
      dogumGun,
      avatarVar: !!avatar,
      ozelDegerler,
    });
    if (!dogrulama.ok) {
      Alert.alert('Eksik bilgi', dogrulama.hata);
      return;
    }
    if (!TumPolitikaOnaylariVerildi(onaylar)) {
      Alert.alert(
        'Yasal onay',
        'Kayıt olmak için Kullanım Şartları, Gizlilik ve Çocuk Koruma politikalarını okuyup onaylamalısın.',
      );
      return;
    }
    setLoading(true);
    const result = await signUp({
      phone: dogrulama.phone,
      email: dogrulama.email,
      password,
      username,
      displayName,
      gender: dogrulama.gender,
      birthDate: dogrulama.birthDate,
      customFields: dogrulama.customFields,
    });
    if (!result.error) {
      void KayitPolitikaKabulKaydet();
    }
    if (result.error) {
      setLoading(false);
      Alert.alert('Kayıt başarısız', result.error);
      return;
    }
    if (result.needsConfirm) {
      setLoading(false);
      const mail = (dogrulama.email ?? '').toLowerCase();
      if (!mail.includes('@')) {
        Alert.alert(
          'E-posta gerekli',
          'Doğrulama kodu için geçerli bir e-posta yazmalısın.',
        );
        return;
      }
      KayitBekleyenAvatarAyarla(avatar);
      router.replace({
        pathname: '/(auth)/dogrula-kod',
        params: { email: mail, amac: 'signup' },
      });
      return;
    }
    if (avatar) {
      await ProfilMedyasiUriIleYukle('avatar', avatar.uri, avatar.mimeType);
      await refreshProfile();
    }
    setLoading(false);
    router.replace('/(tabs)');
  };

  const phoneGorunur = AlanGorunurMu(ayar.alanlar.phone);
  const emailGorunur = AlanGorunurMu(ayar.alanlar.email);
  const genderGorunur = AlanGorunurMu(ayar.alanlar.gender);
  const birthGorunur = AlanGorunurMu(ayar.alanlar.birth_date);
  const avatarGorunur = AlanGorunurMu(ayar.alanlar.avatar);

  return (
    <Screen edges={['top']}>
      <KlavyeGuvenliAlan style={styles.flex}>
        <EkranBasligi
          title="Hesap oluştur"
          subtitle="Saniyeler içinde canlı odalara katıl"
          onBack={() => router.back()}
        />
        {ayarYukleniyor ? (
          <View style={styles.yukleniyor}>
            <ActivityIndicator color={RenkTokenlari.primarySoft} />
          </View>
        ) : null}
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <KlavyeKapatan style={styles.formWrap}>
            {avatarGorunur ? (
              <View style={styles.avatarBlok}>
                <Pressable
                  onPress={() => void avatarSec()}
                  style={styles.avatarWrap}
                  accessibilityRole="button"
                  accessibilityLabel="Profil fotoğrafı seç"
                >
                  {avatar ? (
                    <Image source={{ uri: avatar.uri }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarBos]}>
                      <Ionicons
                        name="person"
                        size={36}
                        color={RenkTokenlari.textDim}
                      />
                    </View>
                  )}
                  <View style={styles.avatarCam}>
                    <Ionicons name="camera" size={14} color="#12040C" />
                  </View>
                </Pressable>
                <Text style={styles.avatarHint}>
                  {KayitAlanEtiketi(
                    'Profil fotoğrafı ekle',
                    AlanZorunluMu(ayar.alanlar.avatar),
                  )}
                </Text>
                {avatar ? (
                  <Pressable onPress={() => setAvatar(null)} hitSlop={8}>
                    <Text style={styles.avatarKaldir}>Kaldır</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {genderGorunur ? (
              <View style={styles.genderRow}>
                {GENDERS.map((g) => (
                  <Pressable
                    key={g.id}
                    onPress={() =>
                      setGender((prev) => (prev === g.id ? '' : g.id))
                    }
                    style={[
                      styles.genderChip,
                      gender === g.id && styles.genderActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.genderText,
                        gender === g.id && styles.genderTextActive,
                      ]}
                    >
                      {g.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {genderGorunur && !AlanZorunluMu(ayar.alanlar.gender) ? (
              <Text style={styles.istegeBagliHint}>Cinsiyet (isteğe bağlı)</Text>
            ) : null}

            <TextField
              label="Kullanıcı adı"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              placeholder="muta_star"
            />
            <TextField
              label="Görünen ad"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Tamuso Yıldızı"
            />

            {birthGorunur ? (
              <View>
                <Text style={styles.yasEtiket}>
                  {KayitAlanEtiketi(
                    'Doğum tarihi',
                    AlanZorunluMu(ayar.alanlar.birth_date),
                  )}
                </Text>
                <Text style={styles.yasHint}>
                  {AlanZorunluMu(ayar.alanlar.birth_date)
                    ? 'Platform yalnızca 18 yaş ve üzeri içindir. Yanlış beyan hesap kapatılmasına yol açar.'
                    : 'Doldurursan 18+ doğrulanır. Boş bırakabilirsin.'}
                </Text>
                <View style={styles.dogumSatir}>
                  <View style={styles.dogumKol}>
                    <ProfilSecimAlani
                      label="Yıl"
                      valueLabel={dogumYil}
                      placeholder="Yıl"
                      options={YIL_OPTS}
                      onSelect={(id) => {
                        setDogumYil(id);
                        const maxGun = DogumGunSecenekleri(
                          id,
                          dogumAy || '01',
                        ).length;
                        if (dogumGun && Number(dogumGun) > maxGun) {
                          setDogumGun('');
                        }
                      }}
                      searchable
                    />
                  </View>
                  <View style={styles.dogumKolKisa}>
                    <ProfilSecimAlani
                      label="Ay"
                      valueLabel={dogumAy}
                      placeholder="Ay"
                      options={DOGUM_AYLARI}
                      onSelect={(id) => {
                        setDogumAy(id);
                        const maxGun = DogumGunSecenekleri(
                          dogumYil || '2000',
                          id,
                        ).length;
                        if (dogumGun && Number(dogumGun) > maxGun) {
                          setDogumGun('');
                        }
                      }}
                    />
                  </View>
                  <View style={styles.dogumKolKisa}>
                    <ProfilSecimAlani
                      label="Gün"
                      valueLabel={dogumGun}
                      placeholder="Gün"
                      options={DogumGunSecenekleri(
                        dogumYil || '2000',
                        dogumAy || '01',
                      )}
                      onSelect={setDogumGun}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {phoneGorunur ? (
              <TextField
                label={KayitAlanEtiketi(
                  'Telefon',
                  AlanZorunluMu(ayar.alanlar.phone),
                )}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                value={phone}
                onChangeText={setPhone}
                placeholder="05xx xxx xx xx"
              />
            ) : null}
            {emailGorunur ? (
              <TextField
                label={KayitAlanEtiketi(
                  'E-posta',
                  AlanZorunluMu(ayar.alanlar.email) || !phone.trim(),
                )}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="sen@mail.com"
              />
            ) : null}
            <TextField
              label="Şifre"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="En az 6 karakter"
            />

            {ayar.ozel_alanlar.map((alan) => {
              if (alan.alan_turu === 'select' && alan.secenekler.length > 0) {
                return (
                  <View key={alan.id}>
                    <Text style={styles.yasEtiket}>
                      {KayitAlanEtiketi(alan.etiket, alan.mod === 'required')}
                    </Text>
                    <View style={styles.genderRow}>
                      {alan.secenekler.map((sec) => {
                        const aktif = ozelDegerler[alan.anahtar] === sec;
                        return (
                          <Pressable
                            key={sec}
                            onPress={() =>
                              setOzelDegerler((prev) => ({
                                ...prev,
                                [alan.anahtar]: aktif ? '' : sec,
                              }))
                            }
                            style={[
                              styles.genderChip,
                              aktif && styles.genderActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.genderText,
                                aktif && styles.genderTextActive,
                              ]}
                            >
                              {sec}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              }
              return (
                <TextField
                  key={alan.id}
                  label={KayitAlanEtiketi(
                    alan.etiket,
                    alan.mod === 'required',
                  )}
                  keyboardType={
                    alan.alan_turu === 'number' ? 'numeric' : 'default'
                  }
                  value={ozelDegerler[alan.anahtar] ?? ''}
                  onChangeText={(t) =>
                    setOzelDegerler((prev) => ({
                      ...prev,
                      [alan.anahtar]: t,
                    }))
                  }
                  placeholder={alan.etiket}
                />
              );
            })}

            <PolitikaOnayKutulari
              onaylar={onaylar}
              onDegisti={(kod, deger) =>
                setOnaylar((prev) => ({ ...prev, [kod]: deger }))
              }
              onOku={setOkunan}
            />

            <GradientButton
              title="Kayıt Ol"
              onPress={onSubmit}
              loading={loading}
            />

            <Pressable
              onPress={() => void onSpotify()}
              disabled={spotifyLoading}
              style={[
                styles.spotifyBtn,
                spotifyLoading && styles.spotifyDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Spotify ile kayıt ol"
            >
              <Ionicons name="musical-notes" size={20} color="#121212" />
              <Text style={styles.spotifyText}>
                {spotifyLoading
                  ? 'Spotify bağlanıyor…'
                  : 'Spotify ile kayıt ol'}
              </Text>
            </Pressable>

            <Link href="/(auth)/login" asChild>
              <Pressable style={styles.switchRow}>
                <Text style={styles.switchText}>Zaten hesabın var mı? </Text>
                <Text style={styles.switchLink}>Giriş yap</Text>
              </Pressable>
            </Link>
          </KlavyeKapatan>
        </ScrollView>
      </KlavyeGuvenliAlan>

      <PolitikaOkumaPaneli
        politika={okunan ? POLITIKA_METINLERI[okunan] : null}
        onKapat={() => setOkunan(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  yukleniyor: {
    paddingVertical: BoslukTokenlari.sm,
    alignItems: 'center',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxxl,
  },
  formWrap: {
    flexGrow: 1,
    gap: BoslukTokenlari.lg,
  },
  avatarBlok: {
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    marginBottom: BoslukTokenlari.xs,
  },
  avatarWrap: {
    width: 96,
    height: 96,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: RenkTokenlari.border,
  },
  avatarBos: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  avatarCam: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.primarySoft,
    borderWidth: 2,
    borderColor: RenkTokenlari.bg,
  },
  avatarHint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  avatarKaldir: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '600',
  },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: BoslukTokenlari.sm },
  genderChip: {
    flexGrow: 1,
    minWidth: '28%',
    minHeight: 44,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
    paddingHorizontal: BoslukTokenlari.sm,
  },
  genderActive: {
    borderColor: RenkTokenlari.primary,
    backgroundColor: 'rgba(232, 64, 145, 0.16)',
  },
  genderText: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  genderTextActive: { color: RenkTokenlari.primarySoft, fontWeight: '700' },
  istegeBagliHint: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginTop: -BoslukTokenlari.sm,
  },
  yasEtiket: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    marginBottom: 4,
  },
  yasHint: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginBottom: BoslukTokenlari.sm,
    lineHeight: 16,
  },
  dogumSatir: { flexDirection: 'row', gap: BoslukTokenlari.sm },
  dogumKol: { flex: 1.4 },
  dogumKolKisa: { flex: 1 },
  spotifyBtn: {
    minHeight: 48,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: SPOTIFY_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.lg,
  },
  spotifyDisabled: { opacity: 0.7 },
  spotifyText: {
    ...TipografiTokenlari.body,
    color: '#121212',
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: BoslukTokenlari.sm,
  },
  switchText: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  switchLink: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
});
