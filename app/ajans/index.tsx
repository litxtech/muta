import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { BosDurum } from '../../src/components/BosDurum';
import { KlavyeKapatan } from '../../src/components/KlavyeKapatan';
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

function durumEtiketi(status: string) {
  const map: Record<string, string> = {
    pending: 'İnceleniyor',
    under_review: 'İnceleniyor',
    approved: 'Onaylandı',
    rejected: 'Reddedildi',
    active: 'Aktif',
  };
  return map[status] ?? status;
}

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

function formDogrula(f: FormState): string | null {
  if (f.name.trim().length < 3) return 'Ajans adı en az 3 karakter olmalı.';
  if (f.country.trim().length < 2) return 'Ülke / bölge zorunlu (örn. TR).';
  if (!f.email.trim().includes('@') || f.email.trim().length < 5) {
    return 'Geçerli bir e-posta gir.';
  }
  if (f.phone.trim().replace(/\s/g, '').length < 7) {
    return 'Telefon zorunlu (en az 7 karakter).';
  }
  const hosts = Number(f.expectedHosts);
  if (!Number.isFinite(hosts) || hosts < 1) {
    return 'Beklenen host sayısı en az 1 olmalı.';
  }
  if (f.description.trim().length < 20) {
    return 'Ajans açıklaması en az 20 karakter olmalı.';
  }
  return null;
}

export default function AjansEkrani() {
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
      const hata = formDogrula(form);
      if (hata) {
        Alert.alert('Başvuru', hata);
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
        Alert.alert('Başvuru', sonuc.hata);
        return;
      }
      setForm(BOS_FORM);
      setBasvuruAcik(false);
      Alert.alert(
        'Başvuru alındı',
        'Ajans başvurun yetkili adminlere iletildi. Onay sonrası ajansın aktif olur.',
      );
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
            title="Ajanslar"
            subtitle="Yönlendiriliyor…"
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
          title="Ajanslar"
          subtitle="Keşfet · profil · başvuru"
          fallbackHref={"/(tabs)" as any}
        />
        <KlavyeKapatan style={{ flex: 1 }}>
          <FlatList
            data={liste}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={styles.headerBlock}>
                <Pressable
                  style={styles.basvuruToggle}
                  onPress={() => setBasvuruAcik((v) => !v)}
                >
                  <Text style={styles.basvuruToggleYazi}>
                    {basvuruAcik ? 'Başvuruyu gizle' : 'Ajans kur / başvur'}
                  </Text>
                </Pressable>

                {basvuruAcik ? (
                  <View style={styles.formCard}>
                    <Text style={styles.formBaslik}>Ajans başvurusu</Text>
                    <TextField
                      label="Ajans adı *"
                      value={form.name}
                      onChangeText={(t) => setAlan('name', t)}
                      placeholder="Örn. Nova Agency"
                    />
                    <TextField
                      label="Ülke / bölge *"
                      value={form.country}
                      onChangeText={(t) => setAlan('country', t)}
                      placeholder="TR"
                      autoCapitalize="characters"
                    />
                    <TextField
                      label="E-posta *"
                      value={form.email}
                      onChangeText={(t) => setAlan('email', t)}
                      placeholder="ajans@ornek.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TextField
                      label="Telefon *"
                      value={form.phone}
                      onChangeText={(t) => setAlan('phone', t)}
                      placeholder="+90…"
                      keyboardType="phone-pad"
                    />
                    <TextField
                      label="Beklenen host *"
                      value={form.expectedHosts}
                      onChangeText={(t) => setAlan('expectedHosts', t)}
                      placeholder="10"
                      keyboardType="number-pad"
                    />
                    <TextField
                      label="Deneyim"
                      value={form.experience}
                      onChangeText={(t) => setAlan('experience', t)}
                      placeholder="Önceki ajans / yayıncılık deneyimin"
                    />
                    <TextField
                      label="Ajans açıklaması *"
                      value={form.description}
                      onChangeText={(t) => setAlan('description', t)}
                      placeholder="Ajansını kısaca anlat…"
                      multiline
                    />
                    <GradientButton
                      title="Başvuruyu gönder"
                      onPress={basvur}
                      loading={loading}
                      disabled={bekleyenVar}
                    />
                  </View>
                ) : null}

                {apps.length > 0 ? (
                  <>
                    <Text style={styles.section}>Başvurularım</Text>
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
                            {durumEtiketi(a.status)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                <Text style={styles.section}>Popüler ajanslar</Text>
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
                  title="Ajans bulunamadı"
                  body="Aktif ajanslar burada listelenir."
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
