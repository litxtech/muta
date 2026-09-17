import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { GradientButton } from '../../src/components/GradientButton';
import { useAuth } from '../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { AdminKayitAlanIslemleri } from '../../src/moduller/kimlik-dogrulama/kayit-alanlari/AdminKayitAlanIslemleri';
import {
  KayitAlanModuEtiketi,
  VARSAYILAN_KAYIT_ALAN_AYARLARI,
  YERLESIK_KAYIT_ALAN_ETIKETLERI,
  type KayitAlanAyarlari,
  type KayitAlanModu,
  type KayitOzelAlan,
  type YerlesikKayitAlani,
} from '../../src/moduller/kimlik-dogrulama/kayit-alanlari/tipler';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const MODLAR: KayitAlanModu[] = ['required', 'optional', 'hidden'];
const YERLESIK_SIRASI: YerlesikKayitAlani[] = [
  'phone',
  'gender',
  'birth_date',
  'email',
  'avatar',
];

export default function AdminKayitAlanlariEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [data, setData] = useState<KayitAlanAyarlari>(
    VARSAYILAN_KAYIT_ALAN_AYARLARI,
  );
  const [alanlar, setAlanlar] = useState(VARSAYILAN_KAYIT_ALAN_AYARLARI.alanlar);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [yeniEtiket, setYeniEtiket] = useState('');
  const [yeniTur, setYeniTur] = useState<'text' | 'select' | 'number'>('text');
  const [yeniZorunlu, setYeniZorunlu] = useState(false);
  const [yeniSecenekler, setYeniSecenekler] = useState('');
  const [ekleniyor, setEkleniyor] = useState(false);

  const yukle = useCallback(async () => {
    if (!admin) return;
    setYukleniyor(true);
    try {
      const d = await AdminKayitAlanIslemleri.getir();
      setData(d);
      setAlanlar(d.alanlar);
    } catch (e) {
      Alert.alert(
        'Kayıt alanları',
        e instanceof Error ? e.message : 'Yüklenemedi.',
      );
    } finally {
      setYukleniyor(false);
    }
  }, [admin]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  if (!admin) {
    return (
      <Screen>
        <EkranBasligi title="Kayıt alanları" fallbackHref="/admin" />
        <Text style={styles.uyari}>Admin yetkisi gerekli.</Text>
      </Screen>
    );
  }

  const kaydet = async () => {
    setKaydediyor(true);
    try {
      const d = await AdminKayitAlanIslemleri.yerlesikGuncelle(alanlar);
      setData(d);
      setAlanlar(d.alanlar);
      Alert.alert(
        'Kaydedildi',
        'Kayıt formu alanları anında güncellendi (build yok).',
      );
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setKaydediyor(false);
    }
  };

  const ozelEkle = async () => {
    if (!yeniEtiket.trim()) {
      Alert.alert('Özel alan', 'Etiket yaz.');
      return;
    }
    setEkleniyor(true);
    try {
      const secenekler =
        yeniTur === 'select'
          ? yeniSecenekler
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      const d = await AdminKayitAlanIslemleri.ozelEkle({
        etiket: yeniEtiket.trim(),
        alan_turu: yeniTur,
        mod: yeniZorunlu ? 'required' : 'optional',
        secenekler,
        sira: data.ozel_alanlar.length,
      });
      setData(d);
      setYeniEtiket('');
      setYeniSecenekler('');
      setYeniZorunlu(false);
      setYeniTur('text');
      Alert.alert('Eklendi', 'Yeni alan kayıt formunda anında görünür.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setEkleniyor(false);
    }
  };

  const ozelModDegistir = async (alan: KayitOzelAlan, zorunlu: boolean) => {
    try {
      const d = await AdminKayitAlanIslemleri.ozelGuncelle(alan.id, {
        mod: zorunlu ? 'required' : 'optional',
      });
      setData(d);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Güncellenemedi');
    }
  };

  const ozelSil = (alan: KayitOzelAlan) => {
    Alert.alert('Alanı kaldır', `"${alan.etiket}" kayıt formundan silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const d = await AdminKayitAlanIslemleri.ozelSil(alan.id);
              setData(d);
            } catch (e) {
              Alert.alert(
                'Hata',
                e instanceof Error ? e.message : 'Silinemedi',
              );
            }
          })();
        },
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Kayıt alanları"
        subtitle="Zorunlu · isteğe bağlı · gizli · özel alan"
        fallbackHref="/admin"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={yukleniyor}
            onRefresh={() => void yukle()}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {yukleniyor && !data.updated_at ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : null}

        <Text style={styles.bolumBaslik}>Yerleşik alanlar</Text>
        <Text style={styles.bolumAlt}>
          Kullanıcı adı, görünen ad ve şifre her zaman zorunludur. Değişiklikler
          kayıt ekranına anında yansır.
        </Text>

        {YERLESIK_SIRASI.map((key) => (
          <View key={key} style={styles.kart}>
            <Text style={styles.kartBaslik}>
              {YERLESIK_KAYIT_ALAN_ETIKETLERI[key]}
            </Text>
            <View style={styles.modRow}>
              {MODLAR.map((mod) => {
                const aktif = alanlar[key] === mod;
                return (
                  <Pressable
                    key={mod}
                    onPress={() =>
                      setAlanlar((prev) => ({ ...prev, [key]: mod }))
                    }
                    style={[styles.modChip, aktif && styles.modChipAktif]}
                  >
                    <Text
                      style={[styles.modText, aktif && styles.modTextAktif]}
                    >
                      {KayitAlanModuEtiketi(mod)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <GradientButton
          title="Yerleşik alanları kaydet"
          onPress={() => void kaydet()}
          loading={kaydediyor}
        />

        <Text style={[styles.bolumBaslik, styles.bolumUst]}>Özel alanlar</Text>
        <Text style={styles.bolumAlt}>
          Kayıt sırasında ekstra bilgi iste. Silince formdan kalkar.
        </Text>

        {data.ozel_alanlar.length === 0 ? (
          <Text style={styles.bos}>Henüz özel alan yok.</Text>
        ) : (
          data.ozel_alanlar.map((alan) => (
            <View key={alan.id} style={styles.kart}>
              <View style={styles.ozelBaslikSatir}>
                <View style={styles.flex1}>
                  <Text style={styles.kartBaslik}>{alan.etiket}</Text>
                  <Text style={styles.ozelMeta}>
                    {alan.anahtar} · {alan.alan_turu}
                    {alan.alan_turu === 'select' && alan.secenekler.length
                      ? ` · ${alan.secenekler.join(', ')}`
                      : ''}
                  </Text>
                </View>
                <Pressable onPress={() => ozelSil(alan)} hitSlop={8}>
                  <Text style={styles.sil}>Sil</Text>
                </Pressable>
              </View>
              <View style={styles.switchSatir}>
                <Text style={styles.switchLabel}>Zorunlu</Text>
                <Switch
                  value={alan.mod === 'required'}
                  onValueChange={(v) => void ozelModDegistir(alan, v)}
                  trackColor={{
                    false: RenkTokenlari.border,
                    true: RenkTokenlari.primarySoft,
                  }}
                />
              </View>
            </View>
          ))
        )}

        <View style={styles.kart}>
          <Text style={styles.kartBaslik}>Yeni alan ekle</Text>
          <TextInput
            style={styles.input}
            placeholder="Etiket (örn. Şehir)"
            placeholderTextColor={RenkTokenlari.textDim}
            value={yeniEtiket}
            onChangeText={setYeniEtiket}
          />
          <View style={styles.modRow}>
            {(['text', 'number', 'select'] as const).map((tur) => {
              const aktif = yeniTur === tur;
              return (
                <Pressable
                  key={tur}
                  onPress={() => setYeniTur(tur)}
                  style={[styles.modChip, aktif && styles.modChipAktif]}
                >
                  <Text style={[styles.modText, aktif && styles.modTextAktif]}>
                    {tur === 'text'
                      ? 'Metin'
                      : tur === 'number'
                        ? 'Sayı'
                        : 'Seçenek'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {yeniTur === 'select' ? (
            <TextInput
              style={styles.input}
              placeholder="Seçenekler (virgülle: A, B, C)"
              placeholderTextColor={RenkTokenlari.textDim}
              value={yeniSecenekler}
              onChangeText={setYeniSecenekler}
            />
          ) : null}
          <View style={styles.switchSatir}>
            <Text style={styles.switchLabel}>Zorunlu olsun</Text>
            <Switch
              value={yeniZorunlu}
              onValueChange={setYeniZorunlu}
              trackColor={{
                false: RenkTokenlari.border,
                true: RenkTokenlari.primarySoft,
              }}
            />
          </View>
          <GradientButton
            title="Alan ekle"
            onPress={() => void ozelEkle()}
            loading={ekleniyor}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  uyari: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.danger,
    padding: BoslukTokenlari.xl,
  },
  bolumBaslik: {
    ...TipografiTokenlari.subtitle,
    color: RenkTokenlari.text,
    fontWeight: '700',
    marginTop: BoslukTokenlari.sm,
  },
  bolumUst: { marginTop: BoslukTokenlari.xl },
  bolumAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginBottom: BoslukTokenlari.xs,
    lineHeight: 18,
  },
  kart: {
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
    padding: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
  },
  kartBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  modRow: { flexDirection: 'row', flexWrap: 'wrap', gap: BoslukTokenlari.sm },
  modChip: {
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bg,
  },
  modChipAktif: {
    borderColor: RenkTokenlari.primary,
    backgroundColor: 'rgba(232, 64, 145, 0.16)',
  },
  modText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  modTextAktif: {
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
  },
  ozelBaslikSatir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BoslukTokenlari.md,
  },
  flex1: { flex: 1 },
  ozelMeta: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginTop: 2,
  },
  sil: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
    fontWeight: '700',
  },
  switchSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderRadius: YaricapTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.md,
    color: RenkTokenlari.text,
    ...TipografiTokenlari.body,
    backgroundColor: RenkTokenlari.bg,
  },
});
