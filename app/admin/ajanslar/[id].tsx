import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { EkranBasligi } from '../../../src/components/EkranBasligi';
import { useAuth } from '../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import {
  AdminAjansCoinYukle,
  AdminAjansDistributorAyarla,
  AdminAjansLimitSet,
  AjansPanelDetayGetir,
  AjansSil,
  type AjansPanelDetay,
} from '../../../src/moduller/ajanslar/islemler/AjansPanelIslemleri';
import { AdminStil, SayiKisa } from '../../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function sayi(n: number) {
  return new Intl.NumberFormat('tr-TR').format(n);
}

const LIMIT_ONSETLER = [
  {
    ad: 'Düşük',
    single: 5_000,
    daily: 25_000,
    monthly: 200_000,
    perUser: 10_000,
  },
  {
    ad: 'Standart',
    single: 10_000,
    daily: 50_000,
    monthly: 500_000,
    perUser: 20_000,
  },
  {
    ad: 'Yüksek',
    single: 50_000,
    daily: 250_000,
    monthly: 2_000_000,
    perUser: 100_000,
  },
  {
    ad: 'VIP',
    single: 200_000,
    daily: 1_000_000,
    monthly: 10_000_000,
    perUser: 500_000,
  },
];

export default function AdminAjansDetayEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [detay, setDetay] = useState<AjansPanelDetay | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busy, setBusy] = useState(false);
  const [yukleMiktar, setYukleMiktar] = useState('50000');
  const [single, setSingle] = useState('');
  const [daily, setDaily] = useState('');
  const [monthly, setMonthly] = useState('');
  const [perUser, setPerUser] = useState('');
  const [unlimited, setUnlimited] = useState(false);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      const d = await AjansPanelDetayGetir(id);
      setDetay(d);
      if (d.limits) {
        setSingle(String(d.limits.single_transfer_limit));
        setDaily(String(d.limits.daily_limit));
        setMonthly(String(d.limits.monthly_limit));
        setPerUser(String(d.limits.per_user_limit));
        setUnlimited(Boolean(d.limits.unlimited));
      }
    } catch (e) {
      Alert.alert(
        'Ajans',
        e instanceof Error ? e.message : 'Detay yüklenemedi',
      );
      setDetay(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!admin) {
        router.replace('/(tabs)/profile');
        return;
      }
      void yukle();
    }, [admin, yukle]),
  );

  if (!admin) return null;

  const bakiye = detay?.wallet?.distribution_balance ?? 0;

  const coinIsle = (delta: number) => {
    if (!id || !delta) return;
    Alert.alert(
      delta > 0 ? 'Coin yükle' : 'Coin düşür',
      `Ajans bakiyesine ${delta > 0 ? '+' : ''}${sayi(delta)} coin?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Uygula',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const r = await AdminAjansCoinYukle({
                agencyId: id,
                delta,
                reason: delta > 0 ? 'admin_topup' : 'admin_deduct',
              });
              setBusy(false);
              if (!r.ok) Alert.alert('Coin', r.hata);
              else {
                Alert.alert(
                  'Tamam',
                  `Yeni bakiye: ${sayi(r.distribution_balance ?? 0)}`,
                );
                await yukle();
              }
            })();
          },
        },
      ],
    );
  };

  const limitKaydet = () => {
    if (!id) return;
    if (unlimited) {
      void (async () => {
        setBusy(true);
        const r = await AdminAjansLimitSet({
          agencyId: id,
          single: Math.floor(Number(single)) || 10000,
          daily: Math.floor(Number(daily)) || 50000,
          monthly: Math.floor(Number(monthly)) || 500000,
          perUser: Math.floor(Number(perUser)) || 20000,
          unlimited: true,
        });
        setBusy(false);
        if (!r.ok) Alert.alert('Limit', r.hata);
        else {
          Alert.alert('Tamam', 'Sınırsız coin yetkisi açıldı.');
          await yukle();
        }
      })();
      return;
    }
    const s = Math.floor(Number(single));
    const d = Math.floor(Number(daily));
    const m = Math.floor(Number(monthly));
    const p = Math.floor(Number(perUser));
    if ([s, d, m, p].some((n) => !Number.isFinite(n) || n < 100)) {
      Alert.alert('Limit', 'Tüm limitler ≥ 100 olmalı.');
      return;
    }
    void (async () => {
      setBusy(true);
      const r = await AdminAjansLimitSet({
        agencyId: id,
        single: s,
        daily: d,
        monthly: m,
        perUser: p,
        unlimited: false,
      });
      setBusy(false);
      if (!r.ok) Alert.alert('Limit', r.hata);
      else {
        Alert.alert('Tamam', 'Limitler güncellendi.');
        await yukle();
      }
    })();
  };

  const limitDelta = (alan: 'single' | 'daily' | 'monthly' | 'perUser', carpan: number) => {
    const map = {
      single: [single, setSingle],
      daily: [daily, setDaily],
      monthly: [monthly, setMonthly],
      perUser: [perUser, setPerUser],
    } as const;
    const [val, setVal] = map[alan];
    const n = Math.floor(Number(val) || 0);
    const next = Math.max(100, Math.floor(n * carpan));
    setVal(String(next));
  };

  const distributorToggle = () => {
    if (!id || !detay) return;
    const next = !detay.agency.is_coin_distributor;
    void (async () => {
      setBusy(true);
      const r = await AdminAjansDistributorAyarla({
        agencyId: id,
        enabled: next,
      });
      setBusy(false);
      if (!r.ok) Alert.alert('Dağıtıcı', r.hata);
      else await yukle();
    })();
  };

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title={detay?.agency.name ?? 'Ajans'}
        subtitle="Coin · limit yükselt / indir"
        fallbackHref={"/admin/ajanslar" as any}
      />
      {yukleniyor && !detay ? (
        <ActivityIndicator
          color={RenkTokenlari.primarySoft}
          style={{ marginTop: 40 }}
        />
      ) : !detay ? (
        <Text style={AdminStil.bos}>Ajans yok</Text>
      ) : (
        <ScrollView
          contentContainerStyle={AdminStil.content}
          refreshControl={
            <RefreshControl
              refreshing={yukleniyor || busy}
              onRefresh={() => void yukle()}
              tintColor={RenkTokenlari.primarySoft}
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient colors={['#241A36', '#121018']} style={styles.hero}>
            <Text style={styles.eyebrow}>
              {detay.agency.agency_public_id} · {detay.agency.trust_tier}
            </Text>
            <Text style={styles.bakiye}>{sayi(bakiye)}</Text>
            <Text style={styles.alt}>Dağıtım bakiyesi</Text>
            <Text style={styles.alt}>
              Sahip: {detay.owner?.display_name || detay.owner?.username || '—'}
            </Text>
          </LinearGradient>

          <Text style={AdminStil.sectionLabel}>Ajansa coin yükle / indir</Text>
          <View style={AdminStil.kart}>
            <View style={AdminStil.aksiyonSatir}>
              {[10_000, 50_000, 100_000, 500_000].map((n) => (
                <Pressable
                  key={n}
                  style={AdminStil.aksiyon}
                  onPress={() => setYukleMiktar(String(n))}
                >
                  <Text style={AdminStil.aksiyonYazi}>{SayiKisa(n)}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={yukleMiktar}
              onChangeText={setYukleMiktar}
              keyboardType="number-pad"
              placeholder="Miktar"
              placeholderTextColor={RenkTokenlari.textDim}
              style={AdminStil.input}
            />
            <View style={AdminStil.aksiyonSatir}>
              <Pressable
                style={[AdminStil.aksiyon, styles.yesil]}
                onPress={() => coinIsle(Math.floor(Number(yukleMiktar)) || 0)}
              >
                <Text style={[AdminStil.aksiyonYazi, { color: RenkTokenlari.mint }]}>
                  Yükle (+)
                </Text>
              </Pressable>
              <Pressable
                style={[AdminStil.aksiyon, styles.kirmizi]}
                onPress={() =>
                  coinIsle(-(Math.floor(Number(yukleMiktar)) || 0))
                }
              >
                <Text
                  style={[AdminStil.aksiyonYazi, { color: RenkTokenlari.danger }]}
                >
                  İndir (−)
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={AdminStil.sectionLabel}>Dağıtıcı yetkisi</Text>
          <Pressable style={AdminStil.kart} onPress={distributorToggle}>
            <Text style={AdminStil.kartBaslik}>
              {detay.agency.is_coin_distributor
                ? 'Dağıtıcı açık — dokunarak kapat'
                : 'Dağıtıcı kapalı — dokunarak aç'}
            </Text>
            <Text style={AdminStil.kartAlt}>
              Kapalıyken ajans kullanıcıya coin yükleyemez
            </Text>
          </Pressable>

          <Text style={AdminStil.sectionLabel}>Limit yükselt / indir</Text>
          <Pressable
            style={AdminStil.kart}
            onPress={() => setUnlimited((v) => !v)}
          >
            <Text style={AdminStil.kartBaslik}>
              {unlimited
                ? 'Sınırsız — dokunarak limitli yap'
                : 'Limitli — dokunarak sınırsız yap'}
            </Text>
            <Text style={AdminStil.kartAlt}>
              Sınırsızda günlük/aylık/tek sefer üst sınırı uygulanmaz (bakiye
              yeterse)
            </Text>
          </Pressable>
          {!unlimited ? (
            <>
          <View style={AdminStil.aksiyonSatir}>
            {LIMIT_ONSETLER.map((p) => (
              <Pressable
                key={p.ad}
                style={AdminStil.aksiyon}
                onPress={() => {
                  setSingle(String(p.single));
                  setDaily(String(p.daily));
                  setMonthly(String(p.monthly));
                  setPerUser(String(p.perUser));
                  setUnlimited(false);
                }}
              >
                <Text style={AdminStil.aksiyonYazi}>{p.ad}</Text>
              </Pressable>
            ))}
          </View>

          {(
            [
              ['Tek sefer', single, setSingle, 'single'],
              ['Günlük', daily, setDaily, 'daily'],
              ['Aylık', monthly, setMonthly, 'monthly'],
              ['Kişi başı', perUser, setPerUser, 'perUser'],
            ] as const
          ).map(([label, val, , key]) => (
            <View key={key} style={AdminStil.kart}>
              <Text style={AdminStil.kartBaslik}>{label}</Text>
              <TextInput
                value={val}
                onChangeText={
                  key === 'single'
                    ? setSingle
                    : key === 'daily'
                      ? setDaily
                      : key === 'monthly'
                        ? setMonthly
                        : setPerUser
                }
                keyboardType="number-pad"
                style={AdminStil.input}
              />
              <View style={AdminStil.aksiyonSatir}>
                <Pressable
                  style={AdminStil.aksiyon}
                  onPress={() => limitDelta(key, 0.5)}
                >
                  <Text style={AdminStil.aksiyonYazi}>÷2 indir</Text>
                </Pressable>
                <Pressable
                  style={AdminStil.aksiyon}
                  onPress={() => limitDelta(key, 2)}
                >
                  <Text style={AdminStil.aksiyonYazi}>×2 yükselt</Text>
                </Pressable>
              </View>
            </View>
          ))}
            </>
          ) : null}

          <Pressable
            style={[AdminStil.aksiyon, styles.kaydet]}
            onPress={limitKaydet}
            disabled={busy}
          >
            <Text style={[AdminStil.aksiyonYazi, { color: '#12040C' }]}>
              {unlimited ? 'Sınırsızı kaydet' : 'Limitleri kaydet'}
            </Text>
          </Pressable>
          <Text style={AdminStil.sectionLabel}>Kullanım</Text>
          <View style={AdminStil.kart}>
            <Text style={AdminStil.kartAlt}>
              Günlük: {sayi(detay.kullanim.gunluk_transfer)}
              {detay.limits?.unlimited
                ? ' · sınırsız'
                : ` / ${sayi(detay.limits?.daily_limit ?? 0)}`}
            </Text>
            <Text style={AdminStil.kartAlt}>
              Aylık: {sayi(detay.kullanim.aylik_transfer)}
              {detay.limits?.unlimited
                ? ' · sınırsız'
                : ` / ${sayi(detay.limits?.monthly_limit ?? 0)}`}
            </Text>
          </View>

          <Text style={AdminStil.sectionLabel}>Son transferler</Text>
          {(detay.son_transferler ?? []).length === 0 ? (
            <Text style={AdminStil.bos}>Transfer yok</Text>
          ) : (
            detay.son_transferler.map((t) => (
              <View key={t.id} style={AdminStil.kart}>
                <View style={AdminStil.satir}>
                  <Text style={AdminStil.kartBaslik}>{t.to_name}</Text>
                  <Text style={{ color: RenkTokenlari.mint, fontWeight: '700' }}>
                    +{sayi(t.coins)}
                  </Text>
                </View>
                <Text style={AdminStil.kartAlt}>
                  {new Date(t.created_at).toLocaleString('tr-TR')}
                </Text>
              </View>
            ))
          )}

          <Text style={AdminStil.sectionLabel}>Tehlikeli</Text>
          <Pressable
            style={[AdminStil.aksiyon, styles.kirmizi]}
            disabled={busy}
            onPress={() => {
              Alert.alert('Ajansı kapat', 'Ajans kapatılsın mı?', [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Kapat',
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      setBusy(true);
                      const r = await AjansSil(id);
                      setBusy(false);
                      if (!r.ok) Alert.alert('Silme', r.hata);
                      else {
                        Alert.alert('Tamam', 'Ajans kapatıldı.');
                        router.replace('/admin/ajanslar' as any);
                      }
                    })();
                  },
                },
              ]);
            }}
          >
            <Text style={[AdminStil.aksiyonYazi, { color: RenkTokenlari.danger }]}>
              Ajansı sil / kapat
            </Text>
          </Pressable>

          <Pressable
            style={AdminStil.kart}
            onPress={() => router.push(`/ajans/${id}` as any)}
          >
            <Text style={AdminStil.kartBaslik}>
              Ajans kullanıcı paneli →
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.xl,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    gap: 4,
  },
  eyebrow: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  bakiye: {
    ...TipografiTokenlari.title,
    fontSize: 36,
    color: RenkTokenlari.text,
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  yesil: { borderColor: 'rgba(80,200,160,0.4)' },
  kirmizi: { borderColor: 'rgba(232,64,64,0.35)' },
  kaydet: {
    backgroundColor: RenkTokenlari.primary,
    borderColor: RenkTokenlari.primary,
    alignItems: 'center',
    paddingVertical: 14,
  },
});
