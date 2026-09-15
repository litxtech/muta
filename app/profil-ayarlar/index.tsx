import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ListeGrubu, ListeSatiri } from '../../src/components/ListeSatiri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { AdminYetkisiVarMi } from '../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { useBildirimler } from '../../src/moduller/bildirimler/baglam/BildirimSaglayici';
import {
  GizlilikAyariKaydet,
  GizlilikAyarlariniGetir,
} from '../../src/moduller/ayarlar/islemler/GizlilikAyarlariniYonet';
import { useAjansYonetim } from '../../src/moduller/ajanslar/kancalar/useAjansYonetim';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

/** X / Twitter tarzi: profildeki menuler burada */
export default function ProfilAyarlarEkrani() {
  const {
    profile,
    user,
    signOut,
    isGuest,
    refreshProfile,
    refreshWallet,
  } = useAuth();
  const isAdmin = AdminYetkisiVarMi(profile);
  const { yetkili: ajansYetkili, yonetimHref } = useAjansYonetim();
  const { okunmamis, yenile: bildirimYenile } = useBildirimler();
  const [upgradeAcik, setUpgradeAcik] = useState(false);
  const [yuklemeGizli, setYuklemeGizli] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      void bildirimYenile();
      if (!isGuest) {
        void GizlilikAyarlariniGetir().then((p) =>
          setYuklemeGizli(p.hide_recharge_rank),
        );
      }
    }, [refreshProfile, isGuest, bildirimYenile]),
  );

  const yuklemeGizlilikDegistir = async (v: boolean) => {
    if (isGuest) {
      setUpgradeAcik(true);
      return;
    }
    setYuklemeGizli(v);
    const r = await GizlilikAyariKaydet('hide_recharge_rank', v);
    if (!r.ok) {
      setYuklemeGizli(!v);
      Alert.alert('Gizlilik', r.hata ?? 'Kaydedilemedi');
    }
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
        subtitle="Hesap · Keşfet · Uygulama"
        fallbackHref="/(tabs)/profile"
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <ListeGrubu title="Hesap">
          <ListeSatiri
            icon="create-outline"
            label="Profili düzenle"
            onPress={() => {
              if (isGuest) {
                setUpgradeAcik(true);
                return;
              }
              router.push('/profil-duzenle' as any);
            }}
          />
          <ListeSatiri
            icon="wallet-outline"
            label="Cüzdan"
            onPress={() => {
              if (isGuest) {
                setUpgradeAcik(true);
                return;
              }
              router.navigate('/(tabs)/wallet');
            }}
          />
          <ListeSatiri
            icon="phone-portrait-outline"
            label="Aktif cihazlar"
            onPress={() => router.navigate('/(tabs)/cihazlar')}
          />
          {!isGuest ? (
            <ListeSatiri
              icon="key-outline"
              label="Şifre değiştir"
              onPress={() => router.push('/profil-duzenle' as any)}
            />
          ) : null}
          <ListeSatiri
            icon="mail-outline"
            label="E-posta"
            value={user?.email ?? (isGuest ? '—' : '-')}
            onPress={() => {
              if (isGuest) {
                setUpgradeAcik(true);
                return;
              }
              router.push('/profil-duzenle' as any);
            }}
            last
          />
        </ListeGrubu>

        <ListeGrubu title="Keşfet">
          <ListeSatiri
            icon="business-outline"
            label="Ajans"
            onPress={() => router.push('/ajans' as any)}
          />
          {ajansYetkili ? (
            <ListeSatiri
              icon="briefcase-outline"
              label="Ajans Yönetim"
              onPress={() => router.push(yonetimHref as any)}
            />
          ) : null}
          <ListeSatiri
            icon="mic-outline"
            label="Ev sahibi paneli"
            onPress={() => router.push('/host' as any)}
          />
          <ListeSatiri
            icon="location-outline"
            label="Şehirler"
            onPress={() => router.push('/sehir' as any)}
          />
          <ListeSatiri
            icon="grid-outline"
            label="Platform"
            onPress={() => router.push('/platform' as any)}
            last
          />
        </ListeGrubu>

        <ListeGrubu title="Gizlilik">
          <View style={styles.privacyRow}>
            <View style={styles.privacyCopy}>
              <Text style={styles.privacyLabel}>Yükleme sıralamamı gizle</Text>
              <Text style={styles.privacyHint}>
                Haftalık coin yükleme liderliğinde adın ve avatarın görünmez
              </Text>
            </View>
            <Switch
              value={yuklemeGizli}
              onValueChange={(v) => void yuklemeGizlilikDegistir(v)}
              trackColor={{
                true: RenkTokenlari.primary,
                false: RenkTokenlari.border,
              }}
            />
          </View>
          <ListeSatiri
            icon="hand-left-outline"
            label="Engellenen kullanıcılar"
            onPress={() => router.push('/engellenen-kullanicilar' as any)}
          />
          <ListeSatiri
            icon="options-outline"
            label="Tüm gizlilik ayarları"
            onPress={() => router.push('/ayarlar' as any)}
            last
          />
        </ListeGrubu>

        <ListeGrubu title="Uygulama">
          <ListeSatiri
            icon="settings-outline"
            label="Tercihler"
            onPress={() => router.push('/ayarlar' as any)}
          />
            <ListeSatiri
              icon="notifications-outline"
              label="Bildirimler"
              value={okunmamis > 0 ? `${okunmamis} yeni` : undefined}
              onPress={() => router.push('/bildirimler' as any)}
            />
            <ListeSatiri
              icon="options-outline"
              label="Bildirim ayarları"
              onPress={() => router.push('/bildirim-ayarlari' as any)}
            />
            <ListeSatiri
              icon="megaphone-outline"
              label="Duyurular"
              onPress={() => router.push('/duyuru' as any)}
            />
          <ListeSatiri
            icon="document-text-outline"
            label="Politikalar"
            onPress={() => router.push('/politika' as any)}
          />
          <ListeSatiri
            icon="shield-checkmark-outline"
            label="Güvenlik"
            onPress={() => router.push('/guvenlik' as any)}
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
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    gap: BoslukTokenlari.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  privacyCopy: { flex: 1, gap: 2, paddingRight: BoslukTokenlari.sm },
  privacyLabel: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  privacyHint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
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
