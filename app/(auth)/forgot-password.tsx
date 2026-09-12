import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, typography } from '../../src/theme/colors';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email) {
      Alert.alert('E-posta gerekli');
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      Alert.alert('Hata', error);
      return;
    }
    Alert.alert(
      'Mail gönderildi',
      'SMTP ayarlıysa şifre sıfırlama bağlantısı e-postana geldi.',
      [{ text: 'Tamam', onPress: () => router.back() }],
    );
  };

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>Şifre sıfırla</Text>
        <Text style={styles.sub}>
          Kayıtlı e-postanı yaz. Supabase SMTP üzerinden reset linki gönderilir.
        </Text>
        <TextField
          label="E-posta"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="sen@mail.com"
        />
        <GradientButton title="Reset linki gönder" onPress={onSubmit} loading={loading} />
        <GradientButton title="Geri" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 24, gap: 14, justifyContent: 'center' },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.body, color: colors.textMuted, marginBottom: 8 },
});
