import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ListeGrubu, ListeSatiri } from '../../src/components/ListeSatiri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { AdminYetkisiVarMi } from '../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { useKullanimSuresi } from '../../src/moduller/kullanim-suresi/baglam/KullanimSuresiSaglayici';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

/** Profil menüsü — hesap hub; tercihler / gizlilik ayrı sayfalarda */
export default function ProfilAyarlarEkrani() {
  const {
    profile,
    signOut,
    isGuest,
    refreshProfile,
    refreshWallet,
  } = useAuth();
  const isAdmin = AdminYetkisiVarMi(profile);
  const { formatli: kullanimFormatli, yenile: kullanimYenile } =
    useKullanimSuresi();
  const [upgradeAcik, setUpgradeAcik] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Ağır yenilemeyi her focus'ta yapma — cüzdan/feed jank'ına yol açıyor
      void kullanimYenile();
    }, [kullanimYenile]),
  );

  const misafirEngelle = (fn: () => void) => {
    if (isGuest) {
      setUpgradeAcik(true);
      return;
    }
    fn();
  };

  const onSignOut = () => {
    Alert.alert('Çıkış', 'Bu cihazdan çıkış yapılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkış yap',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Ayarlar"
        subtitle="Hesap · gizlilik · uygulama"
        fallbackHref="/(tabs)/profile"
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <ListeGrubu title="Hesap">
          <ListeSatiri
            icon="phone-portrait-outline"
            label="Aktif cihazlar"
            onPress={() => router.navigate('/(tabs)/cihazlar')}
            last
          />
        </ListeGrubu>

        <ListeGrubu title="Gizlilik">
          <ListeSatiri
            icon="eye-off-outline"
            label="Gizlilik ayarları"
            value="Kim ne görür"
            onPress={() =>
              misafirEngelle(() => router.push('/ayarlar/gizlilik' as any))
            }
          />
          <ListeSatiri
            icon="ban-outline"
            label="Engellenen hesaplar"
            onPress={() => router.push('/engellenen-kullanicilar' as any)}
            last
          />
        </ListeGrubu>

        <ListeGrubu title="Uygulama">
          <ListeSatiri
            icon="color-palette-outline"
            label="Tercihler"
            value="Tema · dil · bildirim"
            onPress={() => router.push('/ayarlar' as any)}
          />
          <ListeSatiri
            icon="notifications-outline"
            label="Bildirim ayarları"
            onPress={() => router.push('/bildirim-ayarlari' as any)}
          />
          <ListeSatiri
            icon="shield-checkmark-outline"
            label="Güvenlik"
            onPress={() => router.push('/guvenlik' as any)}
          />
          <ListeSatiri
            icon="time-outline"
            label="Kullanım süresi"
            value={kullanimFormatli}
            showChevron={false}
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
            icon="document-text-outline"
            label="Politikalar"
            onPress={() => router.push('/politika' as any)}
            last
          />
        </ListeGrubu>

        {isAdmin ? (
          <ListeGrubu title="Yönetim">
            <ListeSatiri
              icon="construct-outline"
              label="Admin paneli"
              onPress={() => router.push('/admin' as any)}
              last
            />
          </ListeGrubu>
        ) : null}

        <Pressable onPress={onSignOut} style={styles.logout}>
          <Text style={styles.logoutText}>Çıkış yap</Text>
        </Pressable>

        {!isGuest ? (
          <Pressable
            onPress={() => router.push('/hesap-sil' as any)}
            style={styles.deleteAccount}
          >
            <Text style={styles.deleteAccountText}>Hesabı sil</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <HesabiTamamlaKarti
        visible={upgradeAcik}
        onClose={() => setUpgradeAcik(false)}
        onCompleted={() => {
          void refreshProfile();
          void refreshWallet();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxxl,
  },
  logout: { alignItems: 'center', paddingVertical: BoslukTokenlari.lg },
  logoutText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.danger,
    fontWeight: '700',
  },
  deleteAccount: { alignItems: 'center', paddingBottom: BoslukTokenlari.md },
  deleteAccountText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
});
