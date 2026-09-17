import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { AgBaglantiDurumunuGetir } from '../../src/moduller/ag-baglantisi/okuma/AgBaglantiDurumunuGetir';
import {
  GracefulDegradationKarariVer,
  type GracefulDegradationKarari,
} from '../../src/moduller/ag-baglantisi/GracefulDegradationKarariVer';
import { DusukCihazModuAktifMi } from '../../src/moduller/performans/DusukCihazModuAktifMi';
import { MutabakatSonuclariniGetir } from '../../src/moduller/mutabakat/okuma/MutabakatSonuclariniGetir';
import {
  SertifikasyonKontrolleriniGetir,
  SertifikasyonKontrolGuncelle,
  type SertifikasyonKontrolu,
} from '../../src/moduller/sertifikasyon/okuma/SertifikasyonKontrolleriniGetir';
import { PlatformSaglikOzetiniGetir } from '../../src/moduller/sertifikasyon/okuma/PlatformSaglikOzetiniGetir';
import { HediyeAnimasyonStresTestiCalistir } from '../../src/moduller/yuk-testi/HediyeAnimasyonStresTestiCalistir';
import { LiveKitBaglantiStresSimulasyonu } from '../../src/moduller/yuk-testi/LiveKitBaglantiStresSimulasyonu';
import { AdminStil } from '../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function durumEtiketi(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'pass':
      return { label: 'Geçti', color: RenkTokenlari.mint, bg: 'rgba(61,207,176,0.14)' };
    case 'fail':
      return { label: 'Kaldı', color: RenkTokenlari.danger, bg: 'rgba(232,75,106,0.14)' };
    case 'skip':
      return { label: 'Atlandı', color: RenkTokenlari.textMuted, bg: RenkTokenlari.surface };
    case 'pending':
    default:
      return { label: 'Bekliyor', color: RenkTokenlari.accent, bg: 'rgba(240,180,41,0.14)' };
  }
}

function kategoriAdi(cat: string): string {
  const map: Record<string, string> = {
    security: 'Güvenlik',
    network: 'Ağ',
    performance: 'Performans',
    finance: 'Finans',
    media: 'Medya',
    android: 'Android',
    ios: 'iOS',
    ops: 'Operasyon',
  };
  return map[cat] ?? cat;
}

function agTipiEtiketi(tip: string): string {
  const key = tip.toLowerCase();
  const map: Record<string, string> = {
    wifi: 'Wi‑Fi',
    cellular: 'Mobil veri',
    none: 'Bağlantı yok',
    unknown: 'Bilinmiyor',
  };
  return map[key] ?? tip;
}

export default function SertifikasyonHubEkrani() {
  const { isGuest, refreshProfile, profile } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const isAdmin = profile?.is_admin === true;
  const hubOn = OzellikBayragiAktifMi('certification_hub_enabled');
  const stressOn = OzellikBayragiAktifMi('stress_tools_enabled');

  const [checks, setChecks] = useState<SertifikasyonKontrolu[]>([]);
  const [deg, setDeg] = useState<GracefulDegradationKarari | null>(null);
  const [agBagli, setAgBagli] = useState(true);
  const [agTip, setAgTip] = useState('—');
  const [agNet, setAgNet] = useState(true);
  const [dusukCihaz, setDusukCihaz] = useState(false);
  const [mutabakatSatirlari, setMutabakatSatirlari] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);

  const load = useCallback(async () => {
    setYukleniyor(true);
    try {
      const ag = await AgBaglantiDurumunuGetir();
      setAgTip(agTipiEtiketi(String(ag.tip)));
      setAgBagli(!!ag.bagli);
      setAgNet(ag.internetErisilebilir !== false);
      setDusukCihaz(DusukCihazModuAktifMi());
      setDeg(GracefulDegradationKarariVer(ag));

      const [c, m, saglik] = await Promise.all([
        SertifikasyonKontrolleriniGetir().catch(() => []),
        MutabakatSonuclariniGetir(5).catch(() => []),
        PlatformSaglikOzetiniGetir().catch(() => null),
      ]);
      setChecks(c);
      setMutabakatSatirlari(
        m.length === 0
          ? []
          : m.map((r) => `${r.kind}: ${r.status}`),
      );

      if (saglik?.kill_switches && Object.keys(saglik.kill_switches).length > 0) {
        await SertifikasyonKontrolGuncelle({
          code: 'sec_kill_switches',
          status: 'pass',
          details: { keys: Object.keys(saglik.kill_switches) },
        }).catch(() => undefined);
      }
      if (ag.bagli === false || ag.internetErisilebilir === false) {
        await SertifikasyonKontrolGuncelle({
          code: 'net_offline',
          status: 'pass',
          details: { observed: true },
        }).catch(() => undefined);
      }
      if (DusukCihazModuAktifMi()) {
        await SertifikasyonKontrolGuncelle({
          code: 'android_low_end',
          status: 'pass',
          details: { mode: true },
        }).catch(() => undefined);
      }
      const refreshed = await SertifikasyonKontrolleriniGetir().catch(() => c);
      setChecks(refreshed);
    } catch {
      /* migration 011 */
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) {
        router.replace('/(tabs)/profile');
        return;
      }
      void load();
    }, [isAdmin, load]),
  );

  const ozet = useMemo(() => {
    const pass = checks.filter((c) => c.status === 'pass').length;
    const fail = checks.filter((c) => c.status === 'fail').length;
    const pending = checks.filter((c) => c.status === 'pending').length;
    return { pass, fail, pending, total: checks.length };
  }, [checks]);

  const gruplu = useMemo(() => {
    const map = new Map<string, SertifikasyonKontrolu[]>();
    for (const c of checks) {
      const key = c.category || 'ops';
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [checks]);

  if (!isAdmin) {
    return (
      <Screen edges={['top']}>
        <View style={styles.yetkisiz}>
          <Text style={styles.yetkisizYazi}>Bu sayfa yalnızca yöneticiler içindir.</Text>
        </View>
      </Screen>
    );
  }

  const stresHediye = () => {
    islemiDene('oy_kullan', async () => {
      if (!stressOn && !hubOn) {
        Alert.alert('Kapalı', 'Özelliklerden stress_tools veya certification_hub açılmalı.');
        return;
      }
      setBusy(true);
      try {
        const r = await HediyeAnimasyonStresTestiCalistir(40);
        Alert.alert(
          r.ok ? 'Test geçti' : 'Test kaldı',
          `Eklenen ${r.eklenen} · Düşürülen ${r.dusuruldu} · ${r.sureMs} ms`,
        );
        await load();
      } finally {
        setBusy(false);
      }
    });
  };

  const stresLivekit = () => {
    islemiDene('oy_kullan', async () => {
      if (!stressOn && !hubOn) {
        Alert.alert('Kapalı', 'Özelliklerden stress_tools veya certification_hub açılmalı.');
        return;
      }
      setBusy(true);
      try {
        const r = await LiveKitBaglantiStresSimulasyonu(5);
        Alert.alert(
          r.ok ? 'Test geçti' : 'Test kaldı',
          `Başarılı ${r.basarili} · Başarısız ${r.basarisiz} · ${r.sureMs} ms${
            r.hata ? `\n${r.hata}` : ''
          }`,
        );
        await load();
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="sertifikasyon">
        <EkranBasligi
          title="Sertifikasyon"
          subtitle="Mağaza / yayın öncesi kontrol merkezi"
          fallbackHref="/admin"
        />
        <ScrollView
          contentContainerStyle={AdminStil.content}
          refreshControl={
            <RefreshControl refreshing={yukleniyor} onRefresh={() => void load()} />
          }
        >
          <LinearGradient
            colors={[...RenkTokenlari.gradientCard]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={AdminStil.hero}
          >
            <Text style={AdminStil.heroEyebrow}>Operasyon · kalite</Text>
            <Text style={AdminStil.heroTitle}>Kontrol paneli</Text>
            <Text style={AdminStil.heroAlt}>
              Ağ, performans ve güvenlik kontrollerini buradan izle. Kırmızı olanlar
              yayın öncesi düzeltilmeli.
            </Text>
            <View style={styles.bayrakSatir}>
              <View style={[styles.bayrak, hubOn ? styles.bayrakAcik : styles.bayrakKapali]}>
                <Text style={styles.bayrakYazi}>Hub {hubOn ? 'açık' : 'kapalı'}</Text>
              </View>
              <View style={[styles.bayrak, stressOn ? styles.bayrakAcik : styles.bayrakKapali]}>
                <Text style={styles.bayrakYazi}>Stres {stressOn ? 'açık' : 'kapalı'}</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={AdminStil.kpiGrid}>
            <View style={AdminStil.kpi}>
              <Text style={[AdminStil.kpiN, { color: RenkTokenlari.mint }]}>{ozet.pass}</Text>
              <Text style={AdminStil.kpiL}>Geçen</Text>
            </View>
            <View style={AdminStil.kpi}>
              <Text style={[AdminStil.kpiN, { color: RenkTokenlari.danger }]}>{ozet.fail}</Text>
              <Text style={AdminStil.kpiL}>Kalan</Text>
            </View>
            <View style={AdminStil.kpi}>
              <Text style={[AdminStil.kpiN, { color: RenkTokenlari.accent }]}>
                {ozet.pending}
              </Text>
              <Text style={AdminStil.kpiL}>Bekleyen</Text>
            </View>
            <View style={AdminStil.kpi}>
              <Text style={AdminStil.kpiN}>{ozet.total}</Text>
              <Text style={AdminStil.kpiL}>Toplam kontrol</Text>
            </View>
          </View>

          <Text style={AdminStil.sectionLabel}>Cihaz & ağ durumu</Text>
          <View style={styles.durumGrid}>
            <DurumKart
              icon="wifi"
              baslik="Bağlantı"
              deger={agBagli ? agTip : 'Yok'}
              iyi={agBagli && agNet}
            />
            <DurumKart
              icon="globe-outline"
              baslik="İnternet"
              deger={agNet ? 'Erişilebilir' : 'Yok'}
              iyi={agNet}
            />
            <DurumKart
              icon="phone-portrait-outline"
              baslik="Cihaz"
              deger={dusukCihaz ? 'Düşük uç' : 'Normal'}
              iyi={!dusukCihaz}
            />
            <DurumKart
              icon="flash-outline"
              baslik="Yumuşak düşüş"
              deger={deg?.aktif ? 'Aktif' : 'Kapalı'}
              iyi={!deg?.aktif}
            />
          </View>

          <View style={AdminStil.kart}>
            <Text style={AdminStil.kartBaslik}>Performans kapıları</Text>
            <Text style={AdminStil.kartAlt}>
              Ağ veya cihaz zayıfsa uygulama yükü otomatik azaltır.
            </Text>
            <SatirBaslik
              etiket="Ağır animasyon"
              deger={deg?.agirAnimasyonIzinli ? 'İzinli' : 'Kısıtlı'}
            />
            <SatirBaslik
              etiket="Canlı yeniden bağlan"
              deger={deg?.livekitYenidenBaglanIzinli ? 'İzinli' : 'Kapalı'}
            />
            <SatirBaslik
              etiket="Yalnızca önbellek"
              deger={deg?.yalnizcaOnbellek ? 'Evet' : 'Hayır'}
            />
            {deg?.sebep?.length ? (
              <Text style={styles.sebep}>Sebep: {deg.sebep.join(', ')}</Text>
            ) : null}
          </View>

          <Text style={AdminStil.sectionLabel}>Mutabakat (son koşular)</Text>
          <View style={AdminStil.kart}>
            {mutabakatSatirlari.length === 0 ? (
              <Text style={AdminStil.kartAlt}>
                Henüz mutabakat koşusu yok. Finans tutarlılığı için arka planda
                çalıştırılır.
              </Text>
            ) : (
              mutabakatSatirlari.map((s) => (
                <Text key={s} style={styles.mutabakatSatir}>
                  {s}
                </Text>
              ))
            )}
          </View>

          <Text style={AdminStil.sectionLabel}>Kontrol listesi</Text>
          {yukleniyor && checks.length === 0 ? (
            <ActivityIndicator color={RenkTokenlari.accent} />
          ) : checks.length === 0 ? (
            <BosDurum
              icon="checkmark-circle-outline"
              title="Kontrol yok"
              body="Sertifikasyon hub açıkken kontroller burada görünür."
            />
          ) : (
            gruplu.map(([cat, items]) => (
              <View key={cat} style={AdminStil.kart}>
                <Text style={styles.kategoriBaslik}>{kategoriAdi(cat)}</Text>
                {items.map((c) => {
                  const d = durumEtiketi(c.status);
                  return (
                    <View key={c.code} style={styles.kontrolSatir}>
                      <View style={styles.kontrolMetin}>
                        <Text style={styles.kontrolBaslik}>{c.title}</Text>
                        <Text style={styles.kontrolKod}>{c.code}</Text>
                      </View>
                      <View style={[styles.durumChip, { backgroundColor: d.bg }]}>
                        <Text style={[styles.durumChipYazi, { color: d.color }]}>
                          {d.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}

          <Text style={AdminStil.sectionLabel}>Yük testleri</Text>
          <View style={AdminStil.kart}>
            <Text style={AdminStil.kartAlt}>
              Canlı kullanıcıyı etkilemez; animasyon ve bağlantı dayanıklılığını ölçer.
            </Text>
            <Pressable
              style={[styles.aksiyonBtn, busy && styles.aksiyonDisabled]}
              disabled={busy}
              onPress={stresHediye}
            >
              <Ionicons name="gift-outline" size={18} color={RenkTokenlari.text} />
              <View style={styles.aksiyonMetin}>
                <Text style={styles.aksiyonBaslik}>
                  {busy ? 'Çalışıyor…' : 'Hediye animasyon stresi'}
                </Text>
                <Text style={styles.aksiyonAlt}>40 hediye kuyruğu · düşürme oranı</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.aksiyonBtn, busy && styles.aksiyonDisabled]}
              disabled={busy}
              onPress={stresLivekit}
            >
              <Ionicons name="radio-outline" size={18} color={RenkTokenlari.text} />
              <View style={styles.aksiyonMetin}>
                <Text style={styles.aksiyonBaslik}>
                  {busy ? 'Çalışıyor…' : 'Bağlantı yeniden bağlanma'}
                </Text>
                <Text style={styles.aksiyonAlt}>LiveKit kopma / tekrar bağlanma</Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.aksiyonBtn}
              onPress={() => router.push('/guvenlik' as any)}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color={RenkTokenlari.mint} />
              <View style={styles.aksiyonMetin}>
                <Text style={styles.aksiyonBaslik}>Güvenlik merkezine git</Text>
                <Text style={styles.aksiyonAlt}>Olaylar · çocuk koruma · engeller</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
            </Pressable>
          </View>
        </ScrollView>

        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={() => {
            void refreshProfile();
            Alert.alert('Tamam', 'Hesabın güncellendi.');
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

function DurumKart({
  icon,
  baslik,
  deger,
  iyi,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  baslik: string;
  deger: string;
  iyi: boolean;
}) {
  return (
    <View style={styles.durumKart}>
      <View
        style={[
          styles.durumIcon,
          { backgroundColor: iyi ? 'rgba(61,207,176,0.14)' : 'rgba(232,75,106,0.14)' },
        ]}
      >
        <Ionicons
          name={icon}
          size={16}
          color={iyi ? RenkTokenlari.mint : RenkTokenlari.danger}
        />
      </View>
      <Text style={styles.durumBaslik}>{baslik}</Text>
      <Text style={styles.durumDeger}>{deger}</Text>
    </View>
  );
}

function SatirBaslik({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <View style={AdminStil.satir}>
      <Text style={styles.satirEtiket}>{etiket}</Text>
      <Text style={styles.satirDeger}>{deger}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  yetkisiz: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  yetkisizYazi: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  bayrakSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  bayrak: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  bayrakAcik: { backgroundColor: 'rgba(61,207,176,0.16)' },
  bayrakKapali: { backgroundColor: 'rgba(232,75,106,0.16)' },
  bayrakYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.text, fontWeight: '700' },
  durumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BoslukTokenlari.sm,
  },
  durumKart: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 6,
  },
  durumIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durumBaslik: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  durumDeger: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '700' },
  satirEtiket: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  satirDeger: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '700' },
  sebep: { ...TipografiTokenlari.micro, color: RenkTokenlari.accent, marginTop: 4 },
  mutabakatSatir: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  kategoriBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  kontrolSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.border,
  },
  kontrolMetin: { flex: 1, gap: 2 },
  kontrolBaslik: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '600' },
  kontrolKod: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  durumChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  durumChipYazi: { ...TipografiTokenlari.micro, fontWeight: '800' },
  aksiyonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  aksiyonDisabled: { opacity: 0.5 },
  aksiyonMetin: { flex: 1, gap: 2 },
  aksiyonBaslik: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '700' },
  aksiyonAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
});
