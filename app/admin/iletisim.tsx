import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useAuth } from '../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import {
  AdminPlatformIletisimAyarla,
  PlatformIletisimAyariniGetir,
  VARSAYILAN_PLATFORM_ILETISIM,
  type PlatformIletisimAyar,
} from '../../src/moduller/platform-iletisim/islemler/PlatformIletisimIslemleri';
import { AdminStil } from '../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function AdminIletisimEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [ayar, setAyar] = useState<PlatformIletisimAyar>(
    VARSAYILAN_PLATFORM_ILETISIM,
  );
  const [email, setEmail] = useState(VARSAYILAN_PLATFORM_ILETISIM.support_email);
  const [wa, setWa] = useState(VARSAYILAN_PLATFORM_ILETISIM.whatsapp_e164);
  const [waG, setWaG] = useState(VARSAYILAN_PLATFORM_ILETISIM.whatsapp_gorunen);
  const [baslik, setBaslik] = useState(VARSAYILAN_PLATFORM_ILETISIM.baslik);
  const [alt, setAlt] = useState(VARSAYILAN_PLATFORM_ILETISIM.alt_metin);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const a = await PlatformIletisimAyariniGetir(true);
    setAyar(a);
    setEmail(a.support_email);
    setWa(a.whatsapp_e164);
    setWaG(a.whatsapp_gorunen);
    setBaslik(a.baslik);
    setAlt(a.alt_metin);
    setYukleniyor(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!admin) {
        router.replace('/(tabs)/profile');
        return;
      }
      void yukle();
    }, [admin, yukle]),
  );

  if (!admin) return null;

  const kaydet = async () => {
    setBusy(true);
    const r = await AdminPlatformIletisimAyarla({
      support_email: email.trim(),
      whatsapp_e164: wa.trim(),
      whatsapp_gorunen: waG.trim(),
      baslik: baslik.trim(),
      alt_metin: alt.trim(),
    });
    setBusy(false);
    if (!r.ok) {
      Alert.alert('Hata', r.hata);
      return;
    }
    setAyar(r.veri);
    Alert.alert('Kaydedildi', 'Hamburger menüdeki iletişim güncellendi.');
  };

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Kurumsal iletişim"
        subtitle="Hamburger · şikayet · destek"
        fallbackHref="/admin"
      />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={AdminStil.kartAlt}>
          Ana sayfa hamburger menüsünde görünür. Değişiklik anında yayına
          alınır (build gerekmez).
        </Text>

        {yukleniyor ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Başlık</Text>
            <TextInput
              style={AdminStil.input}
              value={baslik}
              onChangeText={setBaslik}
              placeholder="Kurumsal iletişim"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <Text style={styles.label}>Alt metin</Text>
            <TextInput
              style={AdminStil.input}
              value={alt}
              onChangeText={setAlt}
              placeholder="Şikayet · destek · uygunsuz içerik"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <Text style={styles.label}>Destek e-posta</Text>
            <TextInput
              style={AdminStil.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="support@litxtech.com"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <Text style={styles.label}>WhatsApp (ülke koduyla, sadece rakam)</Text>
            <TextInput
              style={AdminStil.input}
              value={wa}
              onChangeText={setWa}
              keyboardType="phone-pad"
              placeholder="905330483061"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <Text style={styles.label}>WhatsApp görünen</Text>
            <TextInput
              style={AdminStil.input}
              value={waG}
              onChangeText={setWaG}
              placeholder="0533 048 30 61"
              placeholderTextColor={RenkTokenlari.textDim}
            />

            <Pressable
              style={[AdminStil.aksiyon, styles.kaydet, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={() => void kaydet()}
            >
              {busy ? (
                <ActivityIndicator color={RenkTokenlari.primarySoft} />
              ) : (
                <Text style={AdminStil.aksiyonYazi}>Kaydet</Text>
              )}
            </Pressable>

            <Text style={styles.onizleme}>
              Önizleme: {ayar.support_email} · {ayar.whatsapp_gorunen}
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8 },
  label: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginTop: 6,
  },
  kaydet: {
    marginTop: BoslukTokenlari.md,
    alignItems: 'center',
    borderColor: RenkTokenlari.primarySoft,
  },
  onizleme: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    marginTop: 8,
  },
});
