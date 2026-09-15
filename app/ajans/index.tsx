import React, { useCallback, useState } from 'react';
import {
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
import {
  AjansBasvurularimiGetir,
  PopulerAjanslariGetir,
  SahipOlunanAjanslariGetir,
  type Ajans,
} from '../../src/moduller/ajanslar/okuma/AjanslariGetir';
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
  const { isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [form, setForm] = useState<FormState>(BOS_FORM);
  const [popular, setPopular] = useState<Ajans[]>([]);
  const [mine, setMine] = useState<Ajans[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const setAlan = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((onceki) => ({ ...onceki, [key]: value }));
  };

  const load = useCallback(async () => {
    try {
      const [p, m, a] = await Promise.all([
        PopulerAjanslariGetir().catch(() => []),
        SahipOlunanAjanslariGetir().catch(() => []),
        AjansBasvurularimiGetir().catch(() => []),
      ]);
      setPopular(p);
      setMine(m);
      setApps(a);
    } catch {
      /* migration */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const basvur = () => {
    islemiDene('ajans_olustur', async () => {
      const hata = formDogrula(form);
      if (hata) {
        Alert.alert('Eksik bilgi', hata);
        return;
      }
      setLoading(true);
      const sonuc = await AjansBasvurusuOlustur({
        agencyName: form.name.trim(),
        country: form.country.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        experience: form.experience.trim() || undefined,
        expectedHosts: Number(form.expectedHosts),
        description: form.description.trim(),
      });
      setLoading(false);
      if (!sonuc.ok) {
        Alert.alert('Başvuru', sonuc.hata);
        return;
      }
      Alert.alert(
        'Başvuru alındı',
        'Ajans başvurun yetkili adminlere iletildi. Onay sonrası ajansın aktif olur.',
      );
      setForm(BOS_FORM);
      await load();
    });
  };

  const liste = mine.length ? mine : popular;
  const bekleyenVar = apps.some((a) =>
    ['pending', 'under_review'].includes(String(a.status)),
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="ajanslar">
        <KlavyeKapatan>
          <EkranBasligi
            title="Ajanslar"
            subtitle="Kur · başvur · admin onaylar"
          />
          <FlatList
            data={liste}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <View style={styles.headerBlock}>
                <View style={styles.bilgiKart}>
                  <Text style={styles.bilgiBaslik}>Nasıl çalışır?</Text>
                  <Text style={styles.bilgiMadde}>1. Aşağıdaki formu doldur</Text>
                  <Text style={styles.bilgiMadde}>
                    2. Başvuru yetkili adminlere gider
                  </Text>
                  <Text style={styles.bilgiMadde}>
                    3. Onaylanınca ajans paneli açılır
                  </Text>
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.formBaslik}>Ajans başvurusu</Text>
                  <Text style={styles.formAlt}>
                    Zorunlu alanlar admin incelemesi için kullanılır.
                  </Text>

                  <TextField
                    label="Ajans adı *"
                    value={form.name}
                    onChangeText={(t) => setAlan('name', t)}
                    placeholder="Örn. Tamuso Stars"
                    maxLength={60}
                  />
                  <TextField
                    label="Ülke / bölge *"
                    value={form.country}
                    onChangeText={(t) => setAlan('country', t)}
                    placeholder="TR"
                    autoCapitalize="characters"
                    maxLength={40}
                  />
                  <TextField
                    label="İletişim e-postası *"
                    value={form.email}
                    onChangeText={(t) => setAlan('email', t)}
                    placeholder="ajans@ornek.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextField
                    label="Telefon *"
                    value={form.phone}
                    onChangeText={(t) => setAlan('phone', t)}
                    placeholder="+90 5xx xxx xx xx"
                    keyboardType="phone-pad"
                  />
                  <TextField
                    label="Beklenen host sayısı *"
                    value={form.expectedHosts}
                    onChangeText={(t) =>
                      setAlan('expectedHosts', t.replace(/[^\d]/g, ''))
                    }
                    placeholder="Örn. 20"
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <TextField
                    label="Deneyim (isteğe bağlı)"
                    value={form.experience}
                    onChangeText={(t) => setAlan('experience', t)}
                    placeholder="Önceki ajans / yayıncılık deneyimin"
                    multiline
                    style={styles.cokSatir}
                  />
                  <TextField
                    label="Ajans açıklaması *"
                    value={form.description}
                    onChangeText={(t) => setAlan('description', t)}
                    placeholder="Ne tür hostlar yöneteceksin? Hedefin ne?"
                    multiline
                    style={styles.cokSatir}
                    maxLength={800}
                  />

                  {bekleyenVar ? (
                    <Text style={styles.uyari}>
                      Bekleyen başvurun var — admin yanıtını bekle.
                    </Text>
                  ) : null}

                  <GradientButton
                    title="Başvuruyu gönder"
                    onPress={basvur}
                    loading={loading}
                    disabled={bekleyenVar}
                  />
                </View>

                <Text style={styles.section}>Başvurularım</Text>
                {apps.length === 0 ? (
                  <BosDurum
                    icon="document-text-outline"
                    title="Başvuru yok"
                    body="Henüz ajans başvurusu göndermedin."
                  />
                ) : (
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
                )}

                <Text style={styles.section}>
                  {mine.length ? 'Ajanslarım' : 'Popüler ajanslar'}
                </Text>
              </View>
            }
            ListEmptyComponent={
              <BosDurum
                icon="business-outline"
                title="Ajans bulunamadı"
                body="Başvurun onaylanınca burada görünür."
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.card}
                onPress={() => {
                  if (mine.some((m) => m.id === item.id)) {
                    router.push(`/ajans/${item.id}` as any);
                  }
                }}
              >
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>
                  {item.agency_public_id} · {item.level_code} · {item.host_count}{' '}
                  host
                  {item.invite_code ? ` · davet ${item.invite_code}` : ''}
                </Text>
                {mine.some((m) => m.id === item.id) ? (
                  <Text style={styles.panelLink}>Ajans Yönetim →</Text>
                ) : null}
              </Pressable>
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
    gap: BoslukTokenlari.sm,
  },
  headerBlock: { gap: BoslukTokenlari.sm, marginBottom: BoslukTokenlari.sm },
  bilgiKart: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    gap: 4,
  },
  bilgiBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  bilgiMadde: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  formCard: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.md,
  },
  formBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  formAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginTop: -6,
  },
  cokSatir: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  uyari: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
  },
  section: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    marginTop: BoslukTokenlari.md,
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
    justifyContent: 'space-between',
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
    gap: 8,
  },
  appRowLast: { borderBottomWidth: 0 },
  appName: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '600' },
  appMeta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted },
  appStatus: { ...TipografiTokenlari.caption, color: RenkTokenlari.primarySoft },
  card: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.xs,
  },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  cardMeta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  panelLink: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
    marginTop: 4,
  },
});
