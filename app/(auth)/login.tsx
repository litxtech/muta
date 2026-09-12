import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, typography } from '../../src/theme/colors';
import { env } from '../../src/lib/env';
import { UygulamaKimligi } from '../../src/yapilandirma/UygulamaKimligi';

export default function LoginScreen() {
  const { signIn, signInWithApple, continueAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Eksik bilgi', 'E-posta ve şifre gerekli.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <LinearGradient colors={[...colors.gradientPrimary]} style={styles.logoBlob}>
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
            label="E-posta"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="sen@mail.com"
          />
          <TextField
            label="Şifre"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
          />
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable>
              <Text style={styles.forgot}>Şifremi unuttum</Text>
            </Pressable>
          </Link>
          <GradientButton title="Giriş Yap" onPress={onSubmit} loading={loading} />
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
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  hero: { alignItems: 'center', paddingTop: 48, gap: 10 },
  logoBlob: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoMark: { fontSize: 40, fontWeight: '900', color: '#12040C' },
  brand: { ...typography.hero, color: colors.text },
  tagline: { ...typography.body, color: colors.textMuted },
  envBadge: {
    ...typography.micro,
    color: colors.accent,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  form: { gap: 14, paddingBottom: 28 },
  forgot: {
    ...typography.caption,
    color: colors.primarySoft,
    textAlign: 'right',
    marginBottom: 4,
  },
  appleWrap: { gap: 6 },
  appleBtn: { width: '100%', height: 48 },
  appleHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  switchText: { ...typography.body, color: colors.textMuted },
  switchLink: { ...typography.body, color: colors.primarySoft, fontWeight: '700' },
});
