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
  PROFIL_GOSTERGE_GIZLILIK,
  GizlilikAyariKaydet,
  GizlilikAyarlariniGetir,
  type GizlilikAyarlari,
} from '../../src/moduller/ayarlar/islemler/GizlilikAyarlariniYonet';
import { useKullanimSuresi } from '../../src/moduller/kullanim-suresi/baglam/KullanimSuresiSaglayici';
import { GorunumSecimKartlari } from '../../src/moduller/gorunum/bilesenler/GorunumSecimKartlari';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useTema } from '../../src/tasarim-sistemi/tema/TemaSaglayici';

const EMPTY_PRIVACY: GizlilikAyarlari = {
  hide_recharge_rank: false,
  hide_gifter_rank: false,
  hide_current_room: false,
  hide_last_seen: false,
  hide_agency: false,
  hide_gift_collection: false,
  hide_top_supporter: false,
  hide_level: false,
  hide_topup_coin: false,
  hide_prestige: false,
  hide_account_value: false,
  hide_crown: false,
  is_private: false,
};

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
  const { okunmamis, yenile: bildirimYenile } = useBildirimler();
  const { formatli: kullanimFormatli, yenile: kullanimYenile } =
    useKullanimSuresi();
  const { palet } = useTema();
  const [upgradeAcik, setUpgradeAcik] = useState(false);
  const [privacy, setPrivacy] = useState<GizlilikAyarlari>(EMPTY_PRIVACY);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      void bildirimYenile();
      void kullanimYenile();
      if (!isGuest) {
        void GizlilikAyarlariniGetir().then(setPrivacy);
      }
    }, [refreshProfile, isGuest, bildirimYenile, kullanimYenile]),
  );

  const privacyDegistir = async (key: keyof GizlilikAyarlari, v: boolean) => {
    if (isGuest) {
      setUpgradeAcik(true);
      return;
    }
    setPrivacy((p) => ({ ...p, [key]: v }));
    const r = await GizlilikAyariKaydet(key, v);
    if (!r.ok) {
      setPrivacy((p) => ({ ...p, [key]: !v }));
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
        <Text style={[styles.sectionLabel, { color: palet.textDim }]}>
          Görünüm
        </Text>
        <Text style={[styles.sectionHint, { color: palet.textMuted }]}>
          Temayı sekmeden seç. Varsayılan koyu; seçimin tüm uygulamaya uygulanır.
        </Text>
        <View style={styles.gorunumKartlar}>
          <GorunumSecimKartlari />
        </View>

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
            label="Ajans kur"
            onPress={() => {
              if (isGuest) {
                setUpgradeAcik(true);
                return;
              }
              router.push('/ajans' as any);
            }}
          />
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

        <ListeGrubu title="Profil göstergeleri">
          <Text style={[styles.sectionHint, { marginBottom: BoslukTokenlari.xs }]}>
            Kapalı olanlar profilini ziyaret edenlere görünmez.
          </Text>
          {PROFIL_GOSTERGE_GIZLILIK.map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.privacyRow,
                index < PROFIL_GOSTERGE_GIZLILIK.length - 1 && styles.privacyBorder,
              ]}
            >
              <View style={styles.privacyCopy}>
                <Text style={styles.privacyLabel}>{item.label}</Text>
                {item.aciklama ? (
                  <Text style={styles.privacyHint}>{item.aciklama}</Text>
                ) : null}
              </View>
              <Switch
                value={privacy[item.key]}
                onValueChange={(v) => void privacyDegistir(item.key, v)}
                trackColor={{
                  true: RenkTokenlari.primary,
                  false: RenkTokenlari.border,
                }}
                thumbColor={palet.bgElevated}
              />
            </View>
          ))}
        </ListeGrubu>

        <ListeGrubu title="Gizlilik">
          <ListeSatiri
            icon="lock-closed-outline"
            label="Gizli hesap"
            onPress={() => router.push('/ayarlar' as any)}
          />
          <ListeSatiri
            icon="person-add-outline"
            label="Takip istekleri"
            onPress={() => router.push('/takip/istekler' as any)}
          />
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
            icon="time-outline"
            label="Kullanım süresi"
            value={kullanimFormatli}
            showChevron={false}
          />
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
  sectionLabel: {
    ...TipografiTokenlari.micro,
    paddingHorizontal: BoslukTokenlari.sm,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionHint: {
    ...TipografiTokenlari.caption,
    paddingHorizontal: BoslukTokenlari.sm,
    marginBottom: BoslukTokenlari.md,
    lineHeight: 18,
  },
  gorunumKartlar: {
    marginBottom: BoslukTokenlari.lg,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    gap: BoslukTokenlari.md,
  },
  privacyBorder: {
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
