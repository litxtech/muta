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
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail.includes('@')) {
      Alert.alert('E-posta gerekli', 'Kayıtlı e-posta adresini yaz.');
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(mail);
    setLoading(false);
    if (error) {
      Alert.alert('Hata', error);
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
          title="Şifre sıfırla"
          subtitle="Kayıtlı e-postana 6 haneli kod gönderilir"
          onBack={() => router.back()}
        />
        <View style={styles.content}>
          <KlavyeKapatan style={styles.flex}>
            <TextField
              label="E-posta"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="sen@mail.com"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => void onSubmit()}
            />
            <GradientButton
              title="Doğrulama kodu gönder"
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
