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
import { useCeviri } from '../../src/i18n/useCeviri';
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
  const { t } = useCeviri();
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
    const timer = setTimeout(() => setGeriSayim((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [geriSayim]);

  const baslik =
    amac === 'recovery'
      ? t('auth.sifreKodu')
      : amac === 'email_change'
        ? t('auth.epostaDogrula')
        : t('auth.kayitDogrulama');

  const emailEtiket = email || t('auth.epostana');
  const alt =
    amac === 'recovery'
      ? t('auth.kodAltRecovery', { email: emailEtiket })
      : t('auth.kodAlt', { email: emailEtiket });

  const dogrula = useCallback(async () => {
    if (!email) {
      Alert.alert(t('auth.epostaEksik'), t('auth.epostaEksikMesaj'));
      return;
    }
    if (kod.replace(/\D/g, '').length < 6) {
      setHata(t('auth.kodEksik'));
      return;
    }
    setHata(null);
    setLoading(true);
    const r = await verifyEmailOtp(email, kod, amac);
    if (!r.ok) {
      setLoading(false);
      setHata(r.hata ?? t('auth.dogrulamaBasarisiz'));
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
  }, [
    amac,
    email,
    kod,
    misafirBayraginiKaldir,
    refreshProfile,
    t,
    verifyEmailOtp,
  ]);

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
      Alert.alert(
        t('auth.kodGonderilemedi'),
        r.hata ?? t('ortak.tekrarDene'),
      );
      return;
    }
    setGeriSayim(60);
    setKod('');
    Alert.alert(t('auth.kodGonderildi'), t('auth.kodGonderildiMesaj'));
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
            title={t('auth.dogrula')}
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
                ? t('auth.yenidenGonderSayac', { saniye: geriSayim })
                : t('auth.koduYenidenGonder')}
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
