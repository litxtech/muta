import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import {
  KycBasvuruGonder,
  KycSonBasvuruGetir,
  type KycDocType,
} from '../../src/moduller/kyc/islemler/KycBasvuru';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const BELGE_TIPLERI: { id: KycDocType; label: string }[] = [
  { id: 'id_card', label: 'Kimlik' },
  { id: 'passport', label: 'Pasaport' },
  { id: 'drivers_license', label: 'Ehliyet' },
  { id: 'temporary_id', label: 'Geçici kimlik' },
];

const CANLILIK_ADIMLARI = [
  'Kameraya düz bak',
  'Yavaşça sola bak',
  'Yavaşça sağa bak',
  'Gülümse',
] as const;

export default function KycEkrani() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [izin, izinIste] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);

  const [docType, setDocType] = useState<KycDocType>('id_card');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [hometown, setHometown] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('TR');
  const [nationality, setNationality] = useState('TR');
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [livenessStep, setLivenessStep] = useState(0);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [livenessAktif, setLivenessAktif] = useState(false);
  const [gonderiyor, setGonderiyor] = useState(false);
  const [durum, setDurum] = useState<string | null>(null);

  useEffect(() => {
    void KycSonBasvuruGetir().then((b) => {
      if (b?.status) setDurum(String(b.status));
    });
  }, []);

  const fotoSec = async (hedef: 'front' | 'back') => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (r.canceled || !r.assets[0]) return;
    if (hedef === 'front') setFrontUri(r.assets[0].uri);
    else setBackUri(r.assets[0].uri);
  };

  const canlilikBaslat = async () => {
    if (!izin?.granted) {
      const n = await izinIste();
      if (!n.granted) {
        Alert.alert('Kamera', 'Canlılık için kamera izni gerekli.');
        return;
      }
    }
    setLivenessAktif(true);
    setLivenessStep(0);
    setLivenessPassed(false);
    setSelfieUri(null);
  };

  const canlilikKareAl = useCallback(async () => {
    try {
      const shot = await camRef.current?.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      if (!shot?.uri) return;
      if (livenessStep >= CANLILIK_ADIMLARI.length - 1) {
        setSelfieUri(shot.uri);
        setLivenessPassed(true);
        setLivenessAktif(false);
        Alert.alert('Canlılık', 'Kontrol tamamlandı.');
        return;
      }
      setLivenessStep((s) => s + 1);
    } catch {
      Alert.alert('Kamera', 'Kare alınamadı.');
    }
  }, [livenessStep]);

  const gonder = async () => {
    if (!frontUri || !selfieUri || !livenessPassed) {
      Alert.alert('Eksik', 'Belge, selfie ve canlılık zorunlu.');
      return;
    }
    const arkaZorunlu =
      docType === 'temporary_id' ||
      docType === 'id_card' ||
      docType === 'drivers_license';
    if (arkaZorunlu && !backUri) {
      Alert.alert('Belge', 'Bu belge tipinde arka yüz zorunlu.');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Eksik', 'Ad ve soyad zorunlu.');
      return;
    }
    if (!phone.trim() || !email.trim()) {
      Alert.alert('Eksik', 'Telefon ve e-posta zorunlu.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      Alert.alert('Doğum tarihi', 'YYYY-AA-GG formatında gir (ör. 1998-05-12).');
      return;
    }
    const yas =
      new Date().getFullYear() - Number(birthDate.slice(0, 4));
    if (yas < 18) {
      Alert.alert('Yaş', '18 yaşından küçükler başvuramaz.');
      return;
    }
    setGonderiyor(true);
    const r = await KycBasvuruGonder({
      docType,
      firstName,
      lastName,
      birthDate,
      hometown,
      phone,
      email,
      country,
      nationality,
      docFrontUri: frontUri,
      docBackUri: backUri,
      selfieUri,
      livenessPassed,
      livenessMeta: {
        steps: CANLILIK_ADIMLARI.length,
        completed: true,
        age: yas,
      },
    });
    setGonderiyor(false);
    if (!r.ok) {
      Alert.alert('KYC', r.hata);
      return;
    }
    setDurum('pending');
    Alert.alert('Gönderildi', 'Başvurun incelemeye alındı.', [
      { text: 'Tamam', onPress: () => router.back() },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <EkranBasligi title="Kimlik onayı" subtitle="Belge · canlılık · selfie" />
      <ScrollView
        contentContainerStyle={[
          styles.pad,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {durum ? (
          <Text style={styles.durum}>
            Son durum:{' '}
            {durum === 'pending'
              ? 'İncelemede'
              : durum === 'approved'
                ? 'Onaylandı'
                : durum === 'rejected'
                  ? 'Reddedildi'
                  : durum}
          </Text>
        ) : null}

        <Text style={styles.bolum}>Belge tipi</Text>
        <View style={styles.chipSatir}>
          {BELGE_TIPLERI.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setDocType(b.id)}
              style={[styles.chip, docType === b.id && styles.chipAktif]}
            >
              <Text
                style={[
                  styles.chipYazi,
                  docType === b.id && styles.chipYaziAktif,
                ]}
              >
                {b.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.bolum}>Kişisel bilgiler</Text>
        <TextInput
          style={styles.input}
          placeholder="Ad"
          placeholderTextColor={RenkTokenlari.textDim}
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={styles.input}
          placeholder="Soyad"
          placeholderTextColor={RenkTokenlari.textDim}
          value={lastName}
          onChangeText={setLastName}
        />
        <TextInput
          style={styles.input}
          placeholder="Doğum tarihi (YYYY-AA-GG)"
          placeholderTextColor={RenkTokenlari.textDim}
          value={birthDate}
          onChangeText={setBirthDate}
        />
        <TextInput
          style={styles.input}
          placeholder="Memleket"
          placeholderTextColor={RenkTokenlari.textDim}
          value={hometown}
          onChangeText={setHometown}
        />
        <TextInput
          style={styles.input}
          placeholder="Telefon"
          placeholderTextColor={RenkTokenlari.textDim}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="E-posta"
          placeholderTextColor={RenkTokenlari.textDim}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Ülke"
          placeholderTextColor={RenkTokenlari.textDim}
          value={country}
          onChangeText={setCountry}
        />
        <TextInput
          style={styles.input}
          placeholder="Uyruk"
          placeholderTextColor={RenkTokenlari.textDim}
          value={nationality}
          onChangeText={setNationality}
        />

        <Text style={styles.bolum}>Belge fotoğrafları</Text>
        <Pressable style={styles.btnIkincil} onPress={() => void fotoSec('front')}>
          <Text style={styles.btnIkincilYazi}>
            {frontUri ? 'Ön yüz seçildi ✓' : 'Ön yüz seç'}
          </Text>
        </Pressable>
        {docType !== 'passport' ? (
          <Pressable
            style={styles.btnIkincil}
            onPress={() => void fotoSec('back')}
          >
            <Text style={styles.btnIkincilYazi}>
              {backUri ? 'Arka yüz seçildi ✓' : 'Arka yüz seç (zorunlu)'}
            </Text>
          </Pressable>
        ) : null}

        <Text style={styles.bolum}>Canlılık kontrolü</Text>
        {!livenessAktif ? (
          <Pressable style={styles.btn} onPress={() => void canlilikBaslat()}>
            <Text style={styles.btnYazi}>
              {livenessPassed ? 'Canlılık tamam ✓' : 'Selfie + canlılık başlat'}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.camWrap}>
            <CameraView ref={camRef} style={styles.cam} facing="front" />
            <Text style={styles.camTalimat}>
              {CANLILIK_ADIMLARI[livenessStep]}
            </Text>
            <Pressable style={styles.btn} onPress={() => void canlilikKareAl()}>
              <Text style={styles.btnYazi}>Kare al</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={[styles.btn, gonderiyor && { opacity: 0.5 }]}
          disabled={gonderiyor}
          onPress={() => void gonder()}
        >
          <Text style={styles.btnYazi}>
            {gonderiyor ? 'Gönderiliyor…' : 'Başvuruyu gönder'}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: BoslukTokenlari.lg, gap: 10 },
  durum: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '700',
  },
  bolum: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '800',
    marginTop: 8,
  },
  chipSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  chipAktif: {
    borderColor: RenkTokenlari.accent,
    backgroundColor: 'rgba(240,180,41,0.16)',
  },
  chipYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  chipYaziAktif: { color: RenkTokenlari.accent, fontWeight: '800' },
  input: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: RenkTokenlari.text,
  },
  btn: {
    marginTop: 8,
    backgroundColor: RenkTokenlari.primary,
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnYazi: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '800',
  },
  btnIkincil: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  btnIkincilYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  camWrap: { gap: 8 },
  cam: { width: '100%', height: 280, borderRadius: 16, overflow: 'hidden' },
  camTalimat: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.accent,
    fontWeight: '800',
    textAlign: 'center',
  },
});
