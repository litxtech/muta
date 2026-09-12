import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, radii, typography } from '../../src/theme/colors';

const GENDERS = [
  { id: 'female', label: 'Kadın' },
  { id: 'male', label: 'Erkek' },
  { id: 'other', label: 'Diğer' },
] as const;

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<string>('female');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password || !username || !displayName) {
      Alert.alert('Eksik bilgi', 'Tüm alanları doldur.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Zayıf şifre', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    setLoading(true);
    const result = await signUp({ email, password, username, displayName, gender });
    setLoading(false);
    if (result.error) {
      Alert.alert('Kayıt başarısız', result.error);
      return;
    }
    if (result.needsConfirm) {
      Alert.alert(
        'E-postanı doğrula',
        'SMTP ayarlıysa doğrulama maili geldi. Onayladıktan sonra giriş yap.',
        [{ text: 'Tamam', onPress: () => router.replace('/(auth)/login') }],
      );
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Hesap oluştur</Text>
          <Text style={styles.sub}>Saniyeler içinde canlı odalara katıl.</Text>

          <View style={styles.genderRow}>
            {GENDERS.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => setGender(g.id)}
                style={[styles.genderChip, gender === g.id && styles.genderActive]}
              >
                <Text style={[styles.genderText, gender === g.id && styles.genderTextActive]}>
                  {g.label}
                </Text>
              </Pressable>
            ))}
          </View>

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
            placeholder="Muta Star"
          />
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
            placeholder="En az 6 karakter"
          />

          <GradientButton title="Kayıt Ol" onPress={onSubmit} loading={loading} />

          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.switchRow}>
              <Text style={styles.switchText}>Zaten hesabın var mı? </Text>
              <Text style={styles.switchLink}>Giriş yap</Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 14, paddingBottom: 40 },
  title: { ...typography.title, color: colors.text, marginTop: 12 },
  sub: { ...typography.body, color: colors.textMuted, marginBottom: 8 },
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  genderChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  genderActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 61, 129, 0.16)',
  },
  genderText: { ...typography.caption, color: colors.textMuted },
  genderTextActive: { color: colors.primarySoft, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  switchText: { ...typography.body, color: colors.textMuted },
  switchLink: { ...typography.body, color: colors.primarySoft, fontWeight: '700' },
});
