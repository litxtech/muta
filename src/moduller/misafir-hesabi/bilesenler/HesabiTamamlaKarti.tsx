import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TextField } from '../../../components/TextField';
import { GradientButton } from '../../../components/GradientButton';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { MisafirHesabiTamamla } from '../islemler/MisafirHesabiTamamla';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCompleted: () => void;
};

/**
 * Guest state-changing islemde gosterilen modern hesap tamamlama karti.
 */
export function HesabiTamamlaKarti({ visible, onClose, onCompleted }: Props) {
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const kaydet = async () => {
    setHata(null);
    if (!ad.trim() || !soyad.trim() || !email.trim() || password.length < 6) {
      setHata('Ad, soyad, e-posta ve en az 6 karakter sifre gerekli.');
      return;
    }
    setLoading(true);
    const sonuc = await MisafirHesabiTamamla({ ad, soyad, email, password });
    setLoading(false);
    if (!sonuc.ok) {
      setHata(sonuc.hata ?? 'Tamamlama basarisiz');
      return;
    }
    onCompleted();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>Hesabini tamamla</Text>
          <Text style={styles.sub}>
            Mesaj, hediye ve mikrofon icin e-posta dogrulamali hesap gerekir. Kimligin
            korunur.
          </Text>
          <TextField label="Ad" value={ad} onChangeText={setAd} placeholder="Ad" />
          <TextField label="Soyad" value={soyad} onChangeText={setSoyad} placeholder="Soyad" />
          <TextField
            label="E-posta"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="sen@mail.com"
          />
          <TextField
            label="Sifre"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="En az 6 karakter"
          />
          {hata ? <Text style={styles.error}>{hata}</Text> : null}
          <GradientButton title="Hesabi olustur" onPress={kaydet} loading={loading} />
          <GradientButton title="Simdi degil" variant="ghost" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    backgroundColor: RenkTokenlari.bgElevated,
    borderTopLeftRadius: YaricapTokenlari.xl,
    borderTopRightRadius: YaricapTokenlari.xl,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    padding: 20,
    gap: 12,
    paddingBottom: 32,
  },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, marginBottom: 4 },
  error: { ...TipografiTokenlari.caption, color: RenkTokenlari.danger },
});
