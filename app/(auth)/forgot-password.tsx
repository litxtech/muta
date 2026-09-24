import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { KlavyeKapatan } from '../../src/components/KlavyeKapatan';
import { KlavyeGuvenliAlan } from '../../src/bilesenler/klavye/KlavyeGuvenliAlan';
import { useAuth } from '../../src/contexts/AuthContext';
import { useCeviri } from '../../src/i18n/useCeviri';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function ForgotPasswordScreen() {
  const { t } = useCeviri();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail.includes('@')) {
      Alert.alert(t('auth.epostaGerekli'), t('auth.epostaGerekliSifirla'));
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(mail);
    setLoading(false);
    if (error) {
      Alert.alert(t('ortak.hata'), error);
      return;
    }
    router.push({
      pathname: '/(auth)/dogrula-kod',
      params: { email: mail, amac: 'recovery' },
    });
  };

  return (
    <Screen edges={['top']}>
      <KlavyeGuvenliAlan>
        <EkranBasligi
          title={t('auth.sifreSifirla')}
          subtitle={t('auth.sifreSifirlaAlt')}
          onBack={() => router.back()}
        />
        <View style={styles.content}>
          <KlavyeKapatan style={styles.flex}>
            <TextField
              label={t('auth.eposta')}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.epostaPlaceholder')}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => void onSubmit()}
            />
            <GradientButton
              title={t('auth.dogrulamaKoduGonder')}
              onPress={onSubmit}
              loading={loading}
            />
          </KlavyeKapatan>
        </View>
      </KlavyeGuvenliAlan>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: BoslukTokenlari.xl,
    gap: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.lg,
  },
  flex: { flex: 1, gap: BoslukTokenlari.lg },
});
