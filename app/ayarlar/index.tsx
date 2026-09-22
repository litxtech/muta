import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ListeGrubu, ListeSatiri } from '../../src/components/ListeSatiri';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  DilAyariniKaydet,
  KullaniciAyarlariniGetir,
  PushBildirimAyariniKaydet,
} from '../../src/moduller/ayarlar/islemler/KullaniciAyarlariniYonet';
import {
  SesOdasiPipAcikMi,
  SesOdasiPipKaydet,
} from '../../src/moduller/ses-odalari/depolama/SesOdasiPipTercihi';
import { SesOdasiPipParamsKapat } from '../../src/moduller/ses-odalari/pip/useSesOdasiPip';
import { UygulamaKimligi } from '../../src/yapilandirma/UygulamaKimligi';
import { GorunumSecimKartlari } from '../../src/moduller/gorunum/bilesenler/GorunumSecimKartlari';
import { useTema } from '../../src/tasarim-sistemi/tema/TemaSaglayici';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

/** Uygulama tercihleri — kısa hub; gizlilik ayrı ekranda */
export default function AyarlarEkrani() {
  const [push, setPush] = useState(true);
  const [dil, setDil] = useState('tr');
  const [pipAcik, setPipAcik] = useState(true);
  const { palet } = useTema();
  const androidMu = Platform.OS === 'android';

  useFocusEffect(
    useCallback(() => {
      void KullaniciAyarlariniGetir().then((a) => {
        setPush(a.pushEnabled);
        setDil(a.dil);
      });
      if (Platform.OS === 'android') {
        void SesOdasiPipAcikMi().then(setPipAcik);
      }
    }, []),
  );

  const pushDegistir = async (v: boolean) => {
    setPush(v);
    await PushBildirimAyariniKaydet(v);
    try {
      const { PushTercihiniKaydet } = await import(
        '../../src/moduller/bildirimler/tercihler/PushTercihleriniYonet'
      );
      await PushTercihiniKaydet('all_enabled', v);
    } catch {
      /* migration yoksa yerel ayar yeterli */
    }
  };

  const pipDegistir = async (v: boolean) => {
    setPipAcik(v);
    await SesOdasiPipKaydet(v);
    if (!v) SesOdasiPipParamsKapat();
  };

  const dilSec = () => {
    Alert.alert('Dil', 'Arayüz dili', [
      {
        text: 'Türkçe',
        onPress: async () => {
          setDil('tr');
          await DilAyariniKaydet('tr');
        },
      },
      {
        text: 'English',
        onPress: async () => {
          setDil('en');
          await DilAyariniKaydet('en');
        },
      },
      { text: 'İptal', style: 'cancel' },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="ayarlar">
        <EkranBasligi
          title="Tercihler"
          subtitle="Görünüm · bildirim · dil"
          fallbackHref="/profil-ayarlar"
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <Text style={[styles.sectionLabel, { color: palet.textDim }]}>
            Görünüm
          </Text>
          <GorunumSecimKartlari />
          <View style={{ height: BoslukTokenlari.lg }} />

          <ListeGrubu title="Bildirimler">
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchLabel}>Push bildirimleri</Text>
                <Text style={styles.switchHint}>Ana anahtar</Text>
              </View>
              <Switch
                value={push}
                onValueChange={(v) => void pushDegistir(v)}
                trackColor={{
                  true: RenkTokenlari.primary,
                  false: RenkTokenlari.border,
                }}
                thumbColor={palet.bgElevated}
              />
            </View>
            <ListeSatiri
              icon="notifications-outline"
              label="Kategori ayarları"
              onPress={() => router.push('/bildirim-ayarlari' as any)}
              last
            />
          </ListeGrubu>

          <ListeGrubu title="Uygulama">
            <ListeSatiri
              icon="language-outline"
              label="Dil"
              value={dil === 'tr' ? 'Türkçe' : 'English'}
              onPress={dilSec}
              last={!androidMu}
            />
            {androidMu ? (
              <View style={[styles.switchRow, styles.switchRowLast]}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchLabel}>Küçük ekran (PiP)</Text>
                  <Text style={styles.switchHint}>
                    Ses odasından çıkınca köşe penceresi
                  </Text>
                </View>
                <Switch
                  value={pipAcik}
                  onValueChange={(v) => void pipDegistir(v)}
                  trackColor={{
                    true: RenkTokenlari.primary,
                    false: RenkTokenlari.border,
                  }}
                  thumbColor={palet.bgElevated}
                />
              </View>
            ) : null}
          </ListeGrubu>

          <ListeGrubu title="Gizlilik ve güvenlik">
            <ListeSatiri
              icon="eye-off-outline"
              label="Gizlilik ayarları"
              value="Kim ne görür"
              onPress={() => router.push('/ayarlar/gizlilik' as any)}
            />
            <ListeSatiri
              icon="shield-checkmark-outline"
              label="Güvenlik merkezi"
              onPress={() => router.push('/guvenlik' as any)}
            />
            <ListeSatiri
              icon="ban-outline"
              label="Engellenen hesaplar"
              onPress={() => router.push('/engellenen-kullanicilar' as any)}
              last
            />
          </ListeGrubu>

          <ListeGrubu title="Yardım">
            <ListeSatiri
              icon="headset-outline"
              label="Canlı destek"
              onPress={() => router.push('/destek' as any)}
            />
            <ListeSatiri
              icon="mail-outline"
              label="Bize ulaşın"
              value={UygulamaKimligi.SUPPORT_EMAIL}
              onPress={() => {
                void Linking.openURL(
                  `mailto:${UygulamaKimligi.SUPPORT_EMAIL}?subject=${encodeURIComponent('Tamuso destek')}`,
                ).catch(() =>
                  Alert.alert('İletişim', UygulamaKimligi.SUPPORT_EMAIL),
                );
              }}
            />
            <ListeSatiri
              icon="document-text-outline"
              label="Politikalar"
              onPress={() => router.push('/politika' as any)}
            />
            <ListeSatiri
              icon="people-outline"
              label="Topluluk kuralları"
              onPress={() => router.push('/politika/community_rules' as any)}
              last
            />
          </ListeGrubu>
        </ScrollView>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxl,
  },
  sectionLabel: {
    ...TipografiTokenlari.micro,
    paddingHorizontal: BoslukTokenlari.sm,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    gap: BoslukTokenlari.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  switchRowLast: {
    borderBottomWidth: 0,
  },
  switchCopy: { flex: 1, gap: 2 },
  switchLabel: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  switchHint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
});
