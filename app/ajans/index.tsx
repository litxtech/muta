import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useCeviri } from '../../src/i18n/useCeviri';
import type { CeviriAnahtari } from '../../src/i18n/useCeviri';
import { BosDurum } from '../../src/components/BosDurum';
import { KlavyeKapatan } from '../../src/components/KlavyeKapatan';
import { KlavyeGuvenliAlan } from '../../src/bilesenler/klavye/KlavyeGuvenliAlan';
import { useKlavyeYuksekligi } from '../../src/bilesenler/klavye/useKlavyeYuksekligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { AjansBasvurusuOlustur } from '../../src/moduller/ajanslar/islemler/AjansIslemleri';
import { AjansBasvurularimiGetir } from '../../src/moduller/ajanslar/okuma/AjanslariGetir';
import {
  AjansListesiModernGetir,
  type AjansListeKart,
} from '../../src/moduller/ajanslar/okuma/AjansProfilGetir';
import { AjansKesfetKarti } from '../../src/moduller/ajanslar/bilesenler/AjansKesfetKarti';
import { useAjansYonetim } from '../../src/moduller/ajanslar/kancalar/useAjansYonetim';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type FormState = {
  name: string;
  country: string;
  email: string;
  phone: string;
  expectedHosts: string;
  experience: string;
  description: string;
};

const BOS_FORM: FormState = {
  name: '',
  country: '',
  email: '',
  phone: '',
  expectedHosts: '',
  experience: '',
  description: '',
};

type CevirFn = (key: CeviriAnahtari, opts?: Record<string, unknown>) => string;

function durumEtiketi(status: string, t: CevirFn) {
  const map: Record<string, CeviriAnahtari> = {
    pending: 'ajans.durumInceleniyor',
    under_review: 'ajans.durumInceleniyor',
    approved: 'ajans.durumOnaylandi',
    rejected: 'ajans.durumReddedildi',
    active: 'ajans.durumAktif',
  };
  const key = map[status];
  return key ? t(key) : status;
}

function formDogrula(f: FormState, t: CevirFn): string | null {
  if (f.name.trim().length < 3) return t('ajans.dogrulamaAd');
  if (f.country.trim().length < 2) return t('ajans.dogrulamaUlke');
  if (!f.email.trim().includes('@') || f.email.trim().length < 5) {
    return t('ajans.dogrulamaEposta');
  }
  if (f.phone.trim().replace(/\s/g, '').length < 7) {
    return t('ajans.dogrulamaTelefon');
  }
  const hosts = Number(f.expectedHosts);
  if (!Number.isFinite(hosts) || hosts < 1) {
    return t('ajans.dogrulamaHost');
  }
  if (f.description.trim().length < 20) {
    return t('ajans.dogrulamaAciklama');
  }
  return null;
}

export default function AjansEkrani() {
  const { t } = useCeviri();
  const { user, isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const {
    yetkili,
    yonetimHref,
    yukleniyor: yetkiYukleniyor,
  } = useAjansYonetim();
  const [form, setForm] = useState<FormState>(BOS_FORM);
  const [liste, setListe] = useState<AjansListeKart[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [basvuruAcik, setBasvuruAcik] = useState(false);
  const { yukseklik: klavyeH, acik: klavyeAcik } = useKlavyeYuksekligi(24);

  const setAlan = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((onceki) => ({ ...onceki, [key]: value }));
  };

  const load = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [p, a] = await Promise.all([
        AjansListesiModernGetir(40).catch(() => []),
        AjansBasvurularimiGetir().catch(() => []),
      ]);
      setListe(p);
      setApps(a);
    } catch {
      setListe([]);
      setApps([]);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Kabul edilmiş ajans sahibi → başvuru değil yönetim paneli
      if (yetkiYukleniyor) return;
      if (yetkili) {
        router.replace(yonetimHref as any);
        return;
      }
      void load();
    }, [load, yetkili, yonetimHref, yetkiYukleniyor]),
  );

  const basvur = () => {
    islemiDene('ajans_olustur', async () => {
      const hata = formDogrula(form, t);
      if (hata) {
        Alert.alert(t('ajans.alertBasvuru'), hata);
        return;
      }
      setLoading(true);
      const sonuc = await AjansBasvurusuOlustur({
        agencyName: form.name.trim(),
        country: form.country.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        expectedHosts: Number(form.expectedHosts),
        experience: form.experience.trim() || undefined,
        description: form.description.trim(),
      });
      setLoading(false);
      if (!sonuc.ok) {
        Alert.alert(t('ajans.alertBasvuru'), sonuc.hata);
        return;
      }
      setForm(BOS_FORM);
      setBasvuruAcik(false);
      Alert.alert(t('ajans.alertAlindiBaslik'), t('ajans.alertAlindiBody'));
      await load();
    });
  };

  const bekleyenVar = useMemo(
    () => apps.some((a) => a.status === 'pending' || a.status === 'under_review'),
    [apps],
  );

  if (yetkiYukleniyor || yetkili) {
    return (
      <Screen edges={['top']}>
        <ModulHataSiniri modulAdi="ajanslar">
          <EkranBasligi
            title={t('ajans.ajanslar')}
            subtitle={t('ajans.yonlendiriliyor')}
            fallbackHref={"/(tabs)" as any}
          />
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginTop: 40 }}
          />
        </ModulHataSiniri>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="ajanslar">
        <EkranBasligi
          title={t('ajans.ajanslar')}
          subtitle={t('ajans.altKesfet')}
          fallbackHref={"/(tabs)" as any}
        />
        <KlavyeGuvenliAlan style={{ flex: 1 }}>
        <KlavyeKapatan style={{ flex: 1 }}>
          <FlatList
            data={liste}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.list,
              Platform.OS === 'android' && klavyeAcik
                ? { paddingBottom: 40 + klavyeH }
                : null,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            ListHeaderComponent={
              <View style={styles.headerBlock}>
                <Pressable
                  style={styles.basvuruToggle}
                  onPress={() => setBasvuruAcik((v) => !v)}
                >
                  <Text style={styles.basvuruToggleYazi}>
                    {basvuruAcik ? t('ajans.basvuruGizle') : t('ajans.basvuruAc')}
                  </Text>
                </Pressable>

                {basvuruAcik ? (
                  <View style={styles.formCard}>
                    <Text style={styles.formBaslik}>{t('ajans.formBaslik')}</Text>
                    <TextField
                      label={t('ajans.labelAd')}
                      value={form.name}
                      onChangeText={(v) => setAlan('name', v)}
                      placeholder={t('ajans.phAd')}
                    />
                    <TextField
                      label={t('ajans.labelUlke')}
                      value={form.country}
                      onChangeText={(v) => setAlan('country', v)}
                      placeholder={t('ajans.phUlke')}
                      autoCapitalize="characters"
                    />
                    <TextField
                      label={t('ajans.labelEposta')}
                      value={form.email}
                      onChangeText={(v) => setAlan('email', v)}
                      placeholder={t('ajans.phEposta')}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TextField
                      label={t('ajans.labelTelefon')}
                      value={form.phone}
                      onChangeText={(v) => setAlan('phone', v)}
                      placeholder={t('ajans.phTelefon')}
                      keyboardType="phone-pad"
                    />
                    <TextField
                      label={t('ajans.labelHost')}
                      value={form.expectedHosts}
                      onChangeText={(v) => setAlan('expectedHosts', v)}
                      placeholder={t('ajans.phHost')}
                      keyboardType="number-pad"
                    />
                    <TextField
                      label={t('ajans.labelDeneyim')}
                      value={form.experience}
                      onChangeText={(v) => setAlan('experience', v)}
                      placeholder={t('ajans.phDeneyim')}
                    />
                    <TextField
                      label={t('ajans.labelAciklama')}
                      value={form.description}
                      onChangeText={(v) => setAlan('description', v)}
                      placeholder={t('ajans.phAciklama')}
                      multiline
                    />
                    <GradientButton
                      title={t('ajans.gonder')}
                      onPress={basvur}
                      loading={loading}
                      disabled={bekleyenVar}
                    />
                  </View>
                ) : null}

                {apps.length > 0 ? (
                  <>
                    <Text style={styles.section}>{t('ajans.basvurularim')}</Text>
                    <View style={styles.appsCard}>
                      {apps.map((a, i) => (
                        <View
                          key={a.id}
                          style={[
                            styles.appRow,
                            i === apps.length - 1 && styles.appRowLast,
                          ]}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={styles.appName}>{a.agency_name}</Text>
                            {a.country ? (
                              <Text style={styles.appMeta}>{a.country}</Text>
                            ) : null}
                          </View>
                          <Text style={styles.appStatus}>
                            {durumEtiketi(a.status, t)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                <Text style={styles.section}>{t('ajans.populer')}</Text>
                {yukleniyor && liste.length === 0 ? (
                  <ActivityIndicator
                    color={RenkTokenlari.primarySoft}
                    style={{ marginVertical: 20 }}
                  />
                ) : null}
              </View>
            }
            ListEmptyComponent={
              yukleniyor ? null : (
                <BosDurum
                  icon="business-outline"
                  title={t('ajans.bosBaslik')}
                  body={t('ajans.bosBody')}
                />
              )
            }
            renderItem={({ item }) => (
              <AjansKesfetKarti
                ajans={item}
                sahipMi={item.owner_id === user?.id}
                onPress={() =>
                  router.push(`/ajans/profil/${item.id}` as any)
                }
              />
            )}
          />
        </KlavyeKapatan>
        </KlavyeGuvenliAlan>
        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={() => {
            void refreshProfile();
            void refreshWallet();
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
  },
  headerBlock: { gap: BoslukTokenlari.sm, marginBottom: BoslukTokenlari.sm },
  basvuruToggle: {
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    alignItems: 'center',
    backgroundColor: RenkTokenlari.bgCard,
  },
  basvuruToggleYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  formCard: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.sm,
  },
  formBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontWeight: '800',
    marginBottom: 4,
  },
  section: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: BoslukTokenlari.sm,
  },
  appsCard: {
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    overflow: 'hidden',
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: BoslukTokenlari.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  appRowLast: { borderBottomWidth: 0 },
  appName: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  appMeta: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  appStatus: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
});
