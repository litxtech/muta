import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { TextField } from '../../../components/TextField';
import { GradientButton } from '../../../components/GradientButton';
import { KlavyeKapatan } from '../../../components/KlavyeKapatan';
import { KlavyeGuvenliAlan } from '../../../bilesenler/klavye/KlavyeGuvenliAlan';
import { TamusoModal } from '../../../bilesenler/yuzey/TamusoModal';
import { useAuth } from '../../../contexts/AuthContext';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { MisafirHesabiTamamla } from '../islemler/MisafirHesabiTamamla';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCompleted: () => void | Promise<void>;
};

/**
 * Guest state-changing islemde gosterilen modern hesap tamamlama karti.
 */
export function HesabiTamamlaKarti({ visible, onClose, onCompleted }: Props) {
  const { misafirBayraginiKaldir, refreshProfile, refreshWallet } = useAuth();
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const kaydet = async () => {
    setHata(null);
    if (!ad.trim() || !soyad.trim() || !email.trim() || password.length < 6) {
      setHata('Ad, soyad, e-posta ve en az 6 karakter şifre gerekli.');
      return;
    }
    setLoading(true);
    const sonuc = await MisafirHesabiTamamla({ ad, soyad, email, password });
    if (!sonuc.ok) {
      setLoading(false);
      setHata(sonuc.hata ?? 'Tamamlama başarısız');
      return;
    }

    const mail = email.trim().toLowerCase();
    if (sonuc.needsConfirm) {
      setLoading(false);
      onClose();
      router.push({
        pathname: '/(auth)/dogrula-kod',
        params: { email: mail, amac: 'email_change' },
      });
      return;
    }

    // UI anında misafir kilidini kaldır; sonra profil/cüzdanı tazele
    misafirBayraginiKaldir();
    await Promise.all([refreshProfile(), refreshWallet()]);
    setLoading(false);
    await onCompleted();
    onClose();
  };

  return (
    <TamusoModal
      visible={visible}
      onClose={onClose}
      animationType="slide"
      placement="bottom"
    >
      <KlavyeGuvenliAlan
        style={styles.sheetWrap}
        offset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.scroll}
          bounces={false}
        >
          <KlavyeKapatan>
            <View style={styles.card}>
              <Text style={styles.title}>Hesabını tamamla</Text>
              <Text style={styles.sub}>
                Mesaj, hediye ve mikrofon için e-posta doğrulamalı hesap gerekir.
                Kimliğin korunur.
              </Text>
              <TextField label="Ad" value={ad} onChangeText={setAd} placeholder="Ad" />
              <TextField
                label="Soyad"
                value={soyad}
                onChangeText={setSoyad}
                placeholder="Soyad"
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
                blurOnSubmit
              />
              {hata ? <Text style={styles.error}>{hata}</Text> : null}
              <GradientButton title="Hesabı oluştur" onPress={kaydet} loading={loading} />
              <GradientButton title="Şimdi değil" variant="ghost" onPress={onClose} />
            </View>
          </KlavyeKapatan>
        </ScrollView>
      </KlavyeGuvenliAlan>
    </TamusoModal>
  );
}

const styles = StyleSheet.create({
  /** flexGrow:0 → KlavyeGuvenliAlan varsayılan flex:1 uygulamamalı (Android height:0 bug) */
  sheetWrap: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: '88%',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  card: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 18,
    borderRadius: YaricapTokenlari.xl,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 12,
    zIndex: 3,
    elevation: 28,
  },
  title: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
  },
  sub: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 18,
  },
  error: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
  },
});
