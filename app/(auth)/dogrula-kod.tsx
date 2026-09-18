/**
 * E-posta 6 haneli kod doğrulama ekranı.
 * params: email, amac=signup|recovery|email_change
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { KlavyeGuvenliAlan } from '../../src/bilesenler/klavye/KlavyeGuvenliAlan';
import { useAuth } from '../../src/contexts/AuthContext';
import { AltiHaneliKodAlani } from '../../src/moduller/kimlik-dogrulama/bilesenler/AltiHaneliKodAlani';
import { KayitBekleyenAvatarAlVeTemizle } from '../../src/moduller/kimlik-dogrulama/depolama/KayitBekleyenAvatar';
import type { EmailOtpAmaci } from '../../src/moduller/kimlik-dogrulama/dogrulama/EmailOtpDogrula';
import { ProfilMedyasiUriIleYukle } from '../../src/moduller/kullanici-profili/islemler/ProfilMedyasiYukle';
import { MisafirCihazUpgradeOnayla } from '../../src/moduller/misafir-hesabi/islemler/MisafirCihazUpgradeOnayla';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const AMACLAR: EmailOtpAmaci[] = ['signup', 'recovery', 'email_change'];

function amacCoz(ham: string | string[] | undefined): EmailOtpAmaci {
  const v = Array.isArray(ham) ? ham[0] : ham;
  if (v && AMACLAR.includes(v as EmailOtpAmaci)) return v as EmailOtpAmaci;
  return 'signup';
}

export default function DogrulaKodEkrani() {
  const { email: emailParam, amac: amacParam } = useLocalSearchParams<{
    email?: string;
    amac?: string;
  }>();
  const { verifyEmailOtp, resendEmailOtp, refreshProfile, misafirBayraginiKaldir } =
    useAuth();
  const email = (emailParam ?? '').trim().toLowerCase();
  const amac = amacCoz(amacParam);

  const [kod, setKod] = useState('');
  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [geriSayim, setGeriSayim] = useState(60);

  useEffect(() => {
    if (geriSayim <= 0) return;
    const t = setTimeout(() => setGeriSayim((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [geriSayim]);

  const baslik =
    amac === 'recovery'
      ? 'Şifre kodu'
      : amac === 'email_change'
        ? 'E-posta doğrula'
        : 'Kayıt doğrulama';

  const alt =
    amac === 'recovery'
      ? `${email || 'E-postana'} gelen 6 haneli kodu yaz, sonra yeni şifreni belirle. Gelen kutusu ve spam klasörünü kontrol et.`
      : `${email || 'E-postana'} gelen 6 haneli doğrulama kodunu yaz. Gelen kutusu ve spam klasörünü kontrol et.`;

  const dogrula = useCallback(async () => {
    if (!email) {
      Alert.alert('E-posta eksik', 'Doğrulama için e-posta gerekli.');
      return;
    }
    if (kod.replace(/\D/g, '').length < 6) {
      setHata('6 haneli kodu eksiksiz gir.');
      return;
    }
    setHata(null);
    setLoading(true);
    const r = await verifyEmailOtp(email, kod, amac);
    if (!r.ok) {
      setLoading(false);
      setHata(r.hata ?? 'Doğrulama başarısız');
      return;
    }
    if (amac === 'signup') {
      const bekleyen = KayitBekleyenAvatarAlVeTemizle();
      if (bekleyen) {
        await ProfilMedyasiUriIleYukle(
          'avatar',
          bekleyen.uri,
          bekleyen.mimeType,
        );
      }
    }
    await refreshProfile();
    setLoading(false);
    if (amac === 'recovery') {
      router.replace('/(auth)/reset-password');
      return;
    }
    if (amac === 'email_change') {
      misafirBayraginiKaldir();
      await MisafirCihazUpgradeOnayla();
    }
    router.replace('/(tabs)');
  }, [amac, email, kod, misafirBayraginiKaldir, refreshProfile, verifyEmailOtp]);

  useEffect(() => {
    if (kod.replace(/\D/g, '').length === 6 && !loading) {
      void dogrula();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kod]);

  const yeniden = async () => {
    if (!email || geriSayim > 0) return;
    setHata(null);
    setLoading(true);
    const r = await resendEmailOtp(email, amac);
    setLoading(false);
    if (!r.ok) {
      Alert.alert('Kod gönderilemedi', r.hata ?? 'Tekrar dene');
      return;
    }
    setGeriSayim(60);
    setKod('');
    Alert.alert('Kod gönderildi', 'Yeni 6 haneli kod e-postana iletildi.');
  };

  return (
    <Screen edges={['top']}>
      <KlavyeGuvenliAlan style={styles.flex}>
        <EkranBasligi
          title={baslik}
          subtitle={alt}
          onBack={() => router.back()}
        />
        <View style={styles.body}>
          <AltiHaneliKodAlani
            value={kod}
            onChange={(v) => {
              setKod(v);
              setHata(null);
            }}
            hataMi={!!hata}
          />
          {hata ? <Text style={styles.hata}>{hata}</Text> : null}

          <GradientButton
            title="Doğrula"
            onPress={() => void dogrula()}
            loading={loading}
          />

          <Pressable
            onPress={() => void yeniden()}
            disabled={geriSayim > 0 || loading}
            style={styles.yeniden}
          >
            <Text
              style={[
                styles.yenidenYazi,
                geriSayim > 0 && styles.yenidenPasif,
              ]}
            >
              {geriSayim > 0
                ? `Yeniden gönder (${geriSayim}s)`
                : 'Kodu yeniden gönder'}
            </Text>
          </Pressable>
        </View>
      </KlavyeGuvenliAlan>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: BoslukTokenlari.xl,
    paddingTop: BoslukTokenlari.xl,
    gap: BoslukTokenlari.lg,
  },
  hata: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
    textAlign: 'center',
  },
  yeniden: {
    alignItems: 'center',
    paddingVertical: BoslukTokenlari.md,
  },
  yenidenYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  yenidenPasif: {
    color: RenkTokenlari.textDim,
    fontWeight: '500',
  },
});
