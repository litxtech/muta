import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, typography } from '../../src/theme/colors';

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (password.length < 6) {
      Alert.alert('Şifre en az 6 karakter olmalı');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Şifreler eşleşmiyor');
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      Alert.alert('Hata', error);
      return;
    }
    Alert.alert('Şifre güncellendi', 'Yeni şifrenle giriş yapabilirsin.', [
      { text: 'Tamam', onPress: () => router.replace('/(tabs)') },
    ]);
  };

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>Yeni şifre</Text>
        <Text style={styles.sub}>Maildeki link ile buraya geldiysen yeni şifreni belirle.</Text>
        <TextField
          label="Yeni şifre"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextField
          label="Şifre tekrar"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />
        <GradientButton title="Şifreyi güncelle" onPress={onSubmit} loading={loading} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 24, gap: 14, justifyContent: 'center' },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.body, color: colors.textMuted, marginBottom: 8 },
});
