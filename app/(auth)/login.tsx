import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { KlavyeKapatan } from '../../src/components/KlavyeKapatan';
import { KlavyeGuvenliAlan } from '../../src/bilesenler/klavye/KlavyeGuvenliAlan';
import { useAuth } from '../../src/contexts/AuthContext';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { env } from '../../src/lib/env';
import { UygulamaKimligi } from '../../src/yapilandirma/UygulamaKimligi';

/** Spotify marka yeşili — resmi giriş CTA */
const SPOTIFY_GREEN = '#1DB954';

export default function LoginScreen() {
  const { signIn, signInWithApple, signInWithSpotify, continueAsGuest } =
    useAuth();
  const [kimlik, setKimlik] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(false);

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

  return (
    <Screen>
      <KlavyeGuvenliAlan style={styles.flex}>
        <KlavyeKapatan style={styles.dismiss}>
        <View style={styles.hero}>
          <LinearGradient
            colors={[...RenkTokenlari.gradientPrimary]}
            style={styles.logoBlob}
          >
            <Text style={styles.logoMark}>M</Text>
          </LinearGradient>
          <Text style={styles.brand}>{UygulamaKimligi.APP_NAME}</Text>
          <Text style={styles.tagline}>Sesli sohbet. Hediye. Kazanç.</Text>
          {env.appEnv !== 'production' ? (
            <Text style={styles.envBadge}>{env.appEnv.toUpperCase()}</Text>
          ) : null}
        </View>

        <View style={styles.form}>
          <TextField
            label="Mail veya kullanıcı adı"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            textContentType="username"
            value={kimlik}
            onChangeText={setKimlik}
            returnKeyType="next"
          />
          <TextField
            label="Şifre"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => void onSubmit()}
          />
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable>
              <Text style={styles.forgot}>Şifremi unuttum</Text>
            </Pressable>
          </Link>
          <GradientButton title="Giriş Yap" onPress={onSubmit} loading={loading} />
          <Pressable
            onPress={() => void onSpotify()}
            disabled={spotifyLoading}
            style={[styles.spotifyBtn, spotifyLoading && styles.spotifyDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Spotify ile giriş yap"
          >
            <Ionicons name="musical-notes" size={20} color="#121212" />
            <Text style={styles.spotifyText}>
              {spotifyLoading ? 'Spotify bağlanıyor…' : 'Spotify ile devam et'}
            </Text>
          </Pressable>
          {Platform.OS === 'ios' ? (
            <View style={styles.appleWrap}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={14}
                style={styles.appleBtn}
                onPress={onApple}
              />
              {appleLoading ? (
                <Text style={styles.appleHint}>Apple ile bağlanıyor…</Text>
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
            <Pressable style={styles.switchRow}>
              <Text style={styles.switchText}>Hesabın yok mu? </Text>
              <Text style={styles.switchLink}>Kayıt ol</Text>
            </Pressable>
          </Link>
        </View>
        </KlavyeKapatan>
      </KlavyeGuvenliAlan>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    paddingHorizontal: BoslukTokenlari.xl,
    justifyContent: 'space-between',
  },
  dismiss: {
    flex: 1,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    paddingTop: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  logoBlob: {
    width: 88,
    height: 88,
    borderRadius: YaricapTokenlari.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: BoslukTokenlari.sm,
  },
  logoMark: { fontSize: 40, fontWeight: '900', color: '#12040C' },
  brand: { ...TipografiTokenlari.hero, color: RenkTokenlari.text },
  tagline: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  envBadge: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    marginTop: BoslukTokenlari.xs,
    borderWidth: 1,
    borderColor: RenkTokenlari.accent,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.xs,
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
  },
  form: { gap: BoslukTokenlari.lg, paddingBottom: BoslukTokenlari.xl },
  forgot: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    textAlign: 'right',
    marginBottom: BoslukTokenlari.xs,
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
    marginTop: BoslukTokenlari.sm,
  },
  switchText: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  switchLink: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
});
