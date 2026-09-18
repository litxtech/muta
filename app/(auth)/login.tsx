import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { KlavyeKapatan } from '../../src/components/KlavyeKapatan';
import { KlavyeGuvenliAlan } from '../../src/bilesenler/klavye/KlavyeGuvenliAlan';
import { GirisLobiArkaPlan } from '../../src/moduller/giris-lobisi/bilesenler/GirisLobiArkaPlan';
import { GirisLobisiPublicGet } from '../../src/moduller/giris-lobisi/islemler/GirisLobisiPublicGet';
import {
  GirisLobisiOnbellekDisktenYukle,
  GirisLobisiOnbellektenAl,
} from '../../src/moduller/giris-lobisi/onbellek/GirisLobisiOnbellek';
import {
  VARSAYILAN_GIRIS_LOBISI_AYAR,
  type GirisLobisiAyar,
  type GirisLobisiMedya,
} from '../../src/moduller/giris-lobisi/tipler';
import { useAuth } from '../../src/contexts/AuthContext';
import { GirisLobiOturumGecmisi } from '../../src/moduller/kimlik-dogrulama/oturum-gecmisi/bilesenler/GirisLobiOturumGecmisi';
import type { OturumGecmisiKaydi } from '../../src/moduller/kimlik-dogrulama/oturum-gecmisi/tipler';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { useTema } from '../../src/tasarim-sistemi/tema/TemaSaglayici';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { env } from '../../src/lib/env';
import { PolitikaOkumaPaneli } from '../../src/moduller/politikalar/bilesenler/PolitikaOkumaPaneli';
import { PolitikalariListele } from '../../src/moduller/politikalar/islemler/PolitikaIslemleri';
import type { PolitikaGorunum } from '../../src/moduller/politikalar/tipler/PolitikaTipleri';

const SPOTIFY_GREEN = '#1DB954';

/**
 * Giriş lobisi — metin/logo/medya admin panelinden gelir.
 * Medya yoksa modern gradient. Form Modal üstünde (VideoView z-order).
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { palet } = useTema();
  const {
    signIn,
    signInWithApple,
    signInWithSpotify,
    continueAsGuest,
    signInFromHistory,
  } = useAuth();
  const [kimlik, setKimlik] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [gecmisBusyId, setGecmisBusyId] = useState<string | null>(null);
  const onbellekBaslangic = GirisLobisiOnbellektenAl();
  const [ayar, setAyar] = useState<GirisLobisiAyar>(
    () => onbellekBaslangic?.ayar ?? VARSAYILAN_GIRIS_LOBISI_AYAR,
  );
  const [medya, setMedya] = useState<GirisLobisiMedya[]>(
    () => onbellekBaslangic?.medya ?? [],
  );
  /** Modal native katmanda stack üstünde kalır; blur'da kapatılmazsa kayıt formunu engeller. */
  const [lobiOdakli, setLobiOdakli] = useState(true);
  const [girisPolitikalari, setGirisPolitikalari] = useState<PolitikaGorunum[]>(
    [],
  );
  const [okunanPolitika, setOkunanPolitika] = useState<PolitikaGorunum | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      let iptal = false;
      setLobiOdakli(true);

      void (async () => {
        const disk =
          GirisLobisiOnbellektenAl() ??
          (await GirisLobisiOnbellekDisktenYukle());
        if (!iptal && disk) {
          setAyar(disk.ayar);
          setMedya(disk.medya);
        }
        const [d, pol] = await Promise.all([
          GirisLobisiPublicGet(),
          PolitikalariListele('login').catch(() => [] as PolitikaGorunum[]),
        ]);
        if (iptal) return;
        setAyar(d.ayar);
        setMedya(d.medya);
        setGirisPolitikalari(pol);
      })();

      return () => {
        iptal = true;
        setLobiOdakli(false);
      };
    }, []),
  );

  const onSubmit = async () => {
    if (!kimlik.trim() || !password) {
      Alert.alert(
        'Eksik bilgi',
        'E-posta / kullanıcı adı ve şifre gerekli.',
      );
      return;
    }
    setLoading(true);
    const { error } = await signIn(kimlik.trim(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Giriş başarısız', error);
      return;
    }
    router.replace('/(tabs)');
  };

  const onApple = async () => {
    setAppleLoading(true);
    const { error, cancelled } = await signInWithApple();
    setAppleLoading(false);
    if (cancelled) return;
    if (error) {
      Alert.alert('Apple girişi', error);
      return;
    }
    router.replace('/(tabs)');
  };

  const onSpotify = async () => {
    setSpotifyLoading(true);
    const { error, cancelled } = await signInWithSpotify();
    setSpotifyLoading(false);
    if (cancelled) return;
    if (error) {
      Alert.alert('Spotify girişi', error);
      return;
    }
    router.replace('/(tabs)');
  };

  const onGuest = async () => {
    setGuestLoading(true);
    const { error } = await continueAsGuest();
    setGuestLoading(false);
    if (error) {
      Alert.alert('Misafir girişi', error);
      return;
    }
    router.replace('/(tabs)');
  };

  const onGecmisSec = async (kayit: OturumGecmisiKaydi) => {
    setGecmisBusyId(kayit.userId);
    const sonuc = await signInFromHistory(kayit);
    setGecmisBusyId(null);
    if (sonuc.ok) {
      router.replace('/(tabs)');
      return;
    }
    if (sonuc.needsPassword) {
      const k = (sonuc.kimlik ?? kayit.kimlik ?? kayit.username ?? '').trim();
      if (k) setKimlik(k);
      setPassword('');
      Alert.alert('Tekrar giriş', sonuc.hata);
      return;
    }
    Alert.alert('Giriş başarısız', sonuc.hata);
  };

  const heroVar =
    ayar.logo_goster ||
    ayar.marka_goster ||
    ayar.slogan_goster ||
    Boolean(ayar.ust_metin?.trim());

  return (
    <View style={styles.root}>
      <GirisLobiArkaPlan medya={medya} aktif={lobiOdakli} />

      {lobiOdakli ? (
        <View style={styles.modalRoot} pointerEvents="box-none">
          <KlavyeGuvenliAlan
            style={[
              styles.flex,
              {
                paddingTop: insets.top + 12,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <KlavyeKapatan style={styles.dismiss}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scroll}
              >
                {heroVar ? (
                  <View style={styles.hero}>
                    {ayar.logo_goster ? (
                      ayar.logo_url ? (
                        <Image
                          source={{ uri: ayar.logo_url }}
                          style={styles.logoImg}
                          resizeMode="contain"
                        />
                      ) : (
                        <LinearGradient
                          colors={[...RenkTokenlari.gradientPrimary]}
                          style={styles.logoBlob}
                        >
                          <Text style={styles.logoMark}>
                            {(ayar.logo_harf || 'M').slice(0, 2)}
                          </Text>
                        </LinearGradient>
                      )
                    ) : null}
                    {ayar.marka_goster && ayar.marka_adi ? (
                      <Text style={styles.brand}>{ayar.marka_adi}</Text>
                    ) : null}
                    {ayar.slogan_goster && ayar.slogan ? (
                      <Text style={styles.tagline}>{ayar.slogan}</Text>
                    ) : null}
                    {ayar.ust_metin ? (
                      <Text style={styles.ustMetin}>{ayar.ust_metin}</Text>
                    ) : null}
                    {env.appEnv !== 'production' ? (
                      <Text style={styles.envBadge}>
                        {env.appEnv.toUpperCase()}
                      </Text>
                    ) : null}
                  </View>
                ) : env.appEnv !== 'production' ? (
                  <View style={styles.hero}>
                    <Text style={styles.envBadge}>
                      {env.appEnv.toUpperCase()}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.heroBos} />
                )}

                <GirisLobiOturumGecmisi
                  onSec={onGecmisSec}
                  busyUserId={gecmisBusyId}
                />

                <View style={styles.formKart}>
                  <Text style={styles.formBaslik}>{ayar.form_baslik}</Text>
                  {ayar.form_alt ? (
                    <Text style={styles.formAlt}>{ayar.form_alt}</Text>
                  ) : null}

                  <TextField
                    label="Mail veya kullanıcı adı"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="default"
                    textContentType="username"
                    value={kimlik}
                    onChangeText={setKimlik}
                    returnKeyType="next"
                    style={styles.inputCam}
                  />
                  <TextField
                    label="Şifre"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={() => void onSubmit()}
                    style={styles.inputCam}
                  />
                  <Link href="/(auth)/forgot-password" asChild>
                    <Pressable>
                      <Text style={styles.forgot}>Şifremi unuttum</Text>
                    </Pressable>
                  </Link>
                  <GradientButton
                    title="Giriş Yap"
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
                    accessibilityLabel="Spotify ile giriş yap"
                  >
                    <Ionicons name="musical-notes" size={20} color="#121212" />
                    <Text style={styles.spotifyText}>
                      {spotifyLoading
                        ? 'Spotify bağlanıyor…'
                        : 'Spotify ile devam et'}
                    </Text>
                  </Pressable>
                  {Platform.OS === 'ios' ? (
                    <View style={styles.appleWrap}>
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={
                          AppleAuthentication.AppleAuthenticationButtonType
                            .SIGN_IN
                        }
                        buttonStyle={
                          palet.statusBar === 'dark'
                            ? AppleAuthentication.AppleAuthenticationButtonStyle
                                .BLACK
                            : AppleAuthentication.AppleAuthenticationButtonStyle
                                .WHITE
                        }
                        cornerRadius={14}
                        style={styles.appleBtn}
                        onPress={onApple}
                      />
                      {appleLoading ? (
                        <Text style={styles.appleHint}>
                          Apple ile bağlanıyor…
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  <GradientButton
                    title="Misafir olarak devam et"
                    variant="ghost"
                    onPress={onGuest}
                    loading={guestLoading}
                  />
                  <Link href="/(auth)/register" asChild>
                    <Pressable
                      style={styles.switchRow}
                      onPress={() => setLobiOdakli(false)}
                    >
                      <Text style={styles.switchText}>Hesabın yok mu? </Text>
                      <Text style={styles.switchLink}>Kayıt ol</Text>
                    </Pressable>
                  </Link>
                </View>

                <View style={styles.politikaAlt}>
                  {girisPolitikalari.map((p, i) => (
                    <React.Fragment key={p.kod}>
                      {i > 0 ? (
                        <Text style={styles.politikaAyir}>·</Text>
                      ) : null}
                      <Pressable
                        onPress={() => setOkunanPolitika(p)}
                        hitSlop={6}
                        accessibilityRole="link"
                        accessibilityLabel={p.linkEtiketi}
                      >
                        <Text
                          style={[
                            styles.politikaLink,
                            p.kod === 'child_safety' &&
                              styles.politikaLinkCocuk,
                          ]}
                        >
                          {p.linkEtiketi}
                        </Text>
                      </Pressable>
                    </React.Fragment>
                  ))}
                </View>
              </ScrollView>
            </KlavyeKapatan>
          </KlavyeGuvenliAlan>
        </View>
      ) : null}

      <PolitikaOkumaPaneli
        politika={okunanPolitika}
        onKapat={() => setOkunanPolitika(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: RenkTokenlari.bg,
  },
  modalRoot: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
    paddingHorizontal: BoslukTokenlari.xl,
  },
  dismiss: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.lg,
  },
  hero: {
    alignItems: 'center',
    paddingTop: BoslukTokenlari.lg,
    gap: BoslukTokenlari.sm,
  },
  heroBos: { height: 24 },
  logoBlob: {
    width: 76,
    height: 76,
    borderRadius: YaricapTokenlari.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoImg: {
    width: 88,
    height: 88,
    marginBottom: 4,
  },
  logoMark: { fontSize: 36, fontWeight: '900', color: '#12040C' },
  brand: {
    ...TipografiTokenlari.hero,
    color: RenkTokenlari.text,
  },
  tagline: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
  ustMetin: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  envBadge: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    marginTop: 4,
    borderWidth: 1,
    borderColor: RenkTokenlari.accent,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.xs,
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
    backgroundColor: RenkTokenlari.surface,
  },
  formKart: {
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.lg,
    borderRadius: 22,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  formBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  formAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    marginTop: -6,
    marginBottom: 4,
  },
  inputCam: {
    backgroundColor: RenkTokenlari.surface,
    borderColor: RenkTokenlari.border,
  },
  forgot: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    textAlign: 'right',
  },
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
  appleWrap: { gap: BoslukTokenlari.sm },
  appleBtn: { width: '100%', height: 48 },
  appleHint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  switchText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
  },
  switchLink: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  politikaAlt: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.sm,
  },
  politikaAyir: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
  },
  politikaLink: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textDecorationLine: 'underline',
  },
  politikaLinkCocuk: {
    color: RenkTokenlari.primarySoft,
    fontWeight: '600',
  },
});
