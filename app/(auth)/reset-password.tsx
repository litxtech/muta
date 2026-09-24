import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { KlavyeGuvenliAlan } from '../../src/bilesenler/klavye/KlavyeGuvenliAlan';
import { useAuth } from '../../src/contexts/AuthContext';
import { useCeviri } from '../../src/i18n/useCeviri';
import { colors, typography } from '../../src/theme/colors';

export default function ResetPasswordScreen() {
  const { t } = useCeviri();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (password.length < 6) {
      Alert.alert(t('auth.sifreMinKarakter'));
      return;
    }
    if (password !== confirm) {
      Alert.alert(t('auth.sifrelerEslesmiyor'));
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      Alert.alert(t('ortak.hata'), error);
      return;
    }
    Alert.alert(t('auth.sifreGuncellendi'), t('auth.sifreGuncellendiMesaj'), [
      { text: t('ortak.tamam'), onPress: () => router.replace('/(tabs)') },
    ]);
  };

  return (
    <Screen>
      <KlavyeGuvenliAlan style={styles.flex}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('auth.yeniSifre')}</Text>
          <Text style={styles.sub}>{t('auth.yeniSifreAlt')}</Text>
          <TextField
            label={t('auth.yeniSifre')}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextField
            label={t('auth.sifreTekrar')}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />
          <GradientButton
            title={t('auth.sifreyiGuncelle')}
            onPress={onSubmit}
            loading={loading}
          />
        </View>
      </KlavyeGuvenliAlan>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, padding: 24, gap: 14, justifyContent: 'center' },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.body, color: colors.textMuted, marginBottom: 8 },
});
