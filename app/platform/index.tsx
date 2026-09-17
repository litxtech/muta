import React, { useCallback, useMemo, useState } from 'react';
import {
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
import {
  AktifEtkinlikleriGetir,
  type PlatformEtkinligi,
} from '../../src/moduller/etkinlikler/okuma/AktifEtkinlikleriGetir';
import {
  AktifGorevleriGetir,
  GorevIlerlemelerimiGetir,
  GorevIlerlet,
  GorevOdulAl,
  type Gorev,
  type GorevIlerleme,
} from '../../src/moduller/gorevler/islemler/GorevIslemleri';
import { RozetlerimiGetir } from '../../src/moduller/gorevler/okuma/RozetlerimiGetir';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { AdminStil } from '../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TamusoBanner } from '../../src/banner';

function etkinlikDurum(status: string): { label: string; color: string } {
  switch (status) {
    case 'live':
    case 'active':
      return { label: 'Canlı', color: RenkTokenlari.live };
    case 'scheduled':
      return { label: 'Planlandı', color: RenkTokenlari.accent };
    case 'ended':
      return { label: 'Bitti', color: RenkTokenlari.textDim };
    default:
      return { label: status, color: RenkTokenlari.textMuted };
  }
}

const KISAYOLLAR: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  alt: string;
  href: string;
  tint: string;
}[] = [
  {
    icon: 'megaphone-outline',
    label: 'Duyurular',
    alt: 'Platform mesajları',
    href: '/duyuru',
    tint: RenkTokenlari.accent,
  },
  {
    icon: 'document-text-outline',
    label: 'Politikalar',
    alt: 'Kurallar · gizlilik',
    href: '/politika',
    tint: RenkTokenlari.violet,
  },
  {
    icon: 'shield-checkmark-outline',
    label: 'Güvenlik',
    alt: 'Bildir · engelle',
    href: '/guvenlik',
    tint: RenkTokenlari.danger,
  },
  {
    icon: 'notifications-outline',
    label: 'Bildirimler',
    alt: 'Push kuyruğu',
    href: '/bildirimler',
    tint: RenkTokenlari.mint,
  },
  {
    icon: 'ribbon-outline',
    label: 'Sertifikasyon',
    alt: 'Kontrol listesi',
    href: '/sertifikasyon',
    tint: RenkTokenlari.primarySoft,
  },
];

export default function OperasyonHubEkrani() {
  const { isGuest, refreshProfile, refreshWallet, profile } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const eventsOn = OzellikBayragiAktifMi('events_enabled');
  const missionsOn = OzellikBayragiAktifMi('missions_enabled');
  const adminMi = profile?.is_admin === true;

  const [events, setEvents] = useState<PlatformEtkinligi[]>([]);
  const [missions, setMissions] = useState<Gorev[]>([]);
  const [progress, setProgress] = useState<Record<string, GorevIlerleme>>({});
  const [badgeCount, setBadgeCount] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);

  const load = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [e, m, p, b] = await Promise.all([
        AktifEtkinlikleriGetir().catch(() => []),
        AktifGorevleriGetir().catch(() => []),
        GorevIlerlemelerimiGetir().catch(() => []),
        RozetlerimiGetir().catch(() => []),
      ]);
      setEvents(e);
      setMissions(m);
      const map: Record<string, GorevIlerleme> = {};
      for (const row of p) map[row.mission_id] = row;
      setProgress(map);
      setBadgeCount(b.length);
    } catch {
      /* migration 010 */
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const gorevOzet = useMemo(() => {
    let hazir = 0;
    let tamam = 0;
    for (const g of missions) {
      const p = progress[g.id];
      if (p?.claimed_at) tamam += 1;
      else if (p?.completed_at) hazir += 1;
    }
    return { hazir, tamam, aktif: missions.length };
  }, [missions, progress]);

  const ilerlet = (code: string) => {
    islemiDene('oy_kullan', async () => {
      if (!missionsOn) {
        Alert.alert('Kapalı', 'Görevler özelliği şu an kapalı.');
        return;
      }
      const r = await GorevIlerlet(code);
      if (!r.ok) Alert.alert('Görev', r.hata);
      await load();
    });
  };

  const odul = (code: string) => {
    islemiDene('oy_kullan', async () => {
      const r = await GorevOdulAl(code);
      if (!r.ok) Alert.alert('Ödül', r.hata);
      else {
        await refreshWallet();
        Alert.alert('Alındı', 'Ödül cüzdana eklendi.');
      }
      await load();
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="etkinlikler">
        <EkranBasligi
          title="Platform"
          subtitle="Etkinlik · görev · rozet · kısayollar"
          fallbackHref={adminMi ? '/admin' : undefined}
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
            <Text style={AdminStil.heroEyebrow}>Operasyon merkezi</Text>
            <Text style={AdminStil.heroTitle}>Platform hub</Text>
            <Text style={AdminStil.heroAlt}>
              Etkinlikleri, görevleri ve sık kullanılan operasyon sayfalarını tek yerden yönet.
            </Text>
            <View style={styles.bayrakSatir}>
              <View style={[styles.bayrak, eventsOn ? styles.bayrakAcik : styles.bayrakKapali]}>
                <Text style={styles.bayrakYazi}>
                  Etkinlik {eventsOn ? 'açık' : 'kapalı'}
                </Text>
              </View>
              <View
                style={[styles.bayrak, missionsOn ? styles.bayrakAcik : styles.bayrakKapali]}
              >
                <Text style={styles.bayrakYazi}>
                  Görev {missionsOn ? 'açık' : 'kapalı'}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <TamusoBanner placement="GAME_CENTER_TOP" screen="GAME_CENTER" />

          <View style={AdminStil.kpiGrid}>
            <View style={AdminStil.kpi}>
              <Text style={AdminStil.kpiN}>{events.length}</Text>
              <Text style={AdminStil.kpiL}>Aktif etkinlik</Text>
            </View>
            <View style={AdminStil.kpi}>
              <Text style={AdminStil.kpiN}>{gorevOzet.aktif}</Text>
              <Text style={AdminStil.kpiL}>Görev</Text>
            </View>
            <View style={AdminStil.kpi}>
              <Text style={[AdminStil.kpiN, { color: RenkTokenlari.accent }]}>
                {gorevOzet.hazir}
              </Text>
              <Text style={AdminStil.kpiL}>Ödül bekliyor</Text>
            </View>
            <View style={AdminStil.kpi}>
              <Text style={[AdminStil.kpiN, { color: RenkTokenlari.mint }]}>{badgeCount}</Text>
              <Text style={AdminStil.kpiL}>Rozet</Text>
            </View>
          </View>

          <Text style={AdminStil.sectionLabel}>Kısayollar</Text>
          <View style={AdminStil.modulGrid}>
            {KISAYOLLAR.map((k) => (
              <Pressable
                key={k.href}
                style={AdminStil.modul}
                onPress={() => router.push(k.href as any)}
              >
                <View style={[AdminStil.modulIcon, { backgroundColor: `${k.tint}22` }]}>
                  <Ionicons name={k.icon} size={18} color={k.tint} />
                </View>
                <Text style={AdminStil.modulLabel}>{k.label}</Text>
                <Text style={AdminStil.modulAlt}>{k.alt}</Text>
              </Pressable>
            ))}
          </View>

          <TamusoBanner placement="GAME_CENTER_MIDDLE" screen="GAME_CENTER" />

          <Text style={AdminStil.sectionLabel}>Etkinlikler</Text>
          {!eventsOn ? (
            <View style={AdminStil.kart}>
              <Text style={AdminStil.kartAlt}>
                Etkinlikler özelliği kapalı. Admin → Özellikler’den açabilirsin.
              </Text>
            </View>
          ) : events.length === 0 ? (
            <BosDurum
              icon="calendar-outline"
              title="Etkinlik yok"
              body="Aktif platform etkinliği bulunmuyor."
            />
          ) : (
            events.map((ev) => {
              const d = etkinlikDurum(ev.status);
              return (
                <View key={ev.id} style={styles.etkinlikKart}>
                  <View style={[styles.etkinlikNokta, { backgroundColor: d.color }]} />
                  <View style={styles.etkinlikMetin}>
                    <Text style={styles.etkinlikDurum}>{d.label}</Text>
                    <Text style={styles.etkinlikBaslik}>{ev.title}</Text>
                  </View>
                </View>
              );
            })
          )}

          <Text style={AdminStil.sectionLabel}>Görevler</Text>
          {!missionsOn ? (
            <View style={AdminStil.kart}>
              <Text style={AdminStil.kartAlt}>
                Görevler özelliği kapalı. Admin → Özellikler’den açabilirsin.
              </Text>
            </View>
          ) : missions.length === 0 ? (
            <BosDurum
              icon="flag-outline"
              title="Görev yok"
              body="Yeni görevler eklendiğinde burada görünür."
            />
          ) : (
            missions.map((item) => {
              const p = progress[item.id];
              const cur = p?.progress ?? 0;
              const hedef = Math.max(1, item.goal_target);
              const oran = Math.min(1, cur / hedef);
              const done = !!p?.completed_at;
              const claimed = !!p?.claimed_at;
              return (
                <View key={item.id} style={styles.gorevKart}>
                  <View style={styles.gorevUst}>
                    <Text style={styles.gorevBaslik}>{item.title}</Text>
                    <Text style={styles.gorevOdul}>+{item.reward_coins} coin</Text>
                  </View>
                  <Text style={styles.gorevMeta}>
                    İlerleme {cur}/{item.goal_target}
                    {claimed ? ' · alındı' : done ? ' · ödül hazır' : ''}
                  </Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${oran * 100}%` }]} />
                  </View>
                  {!done ? (
                    <Pressable style={styles.gorevBtn} onPress={() => ilerlet(item.code)}>
                      <Text style={styles.gorevBtnYazi}>İlerlet (+1)</Text>
                    </Pressable>
                  ) : !claimed ? (
                    <Pressable
                      style={[styles.gorevBtn, styles.gorevBtnOdul]}
                      onPress={() => odul(item.code)}
                    >
                      <Text style={styles.gorevBtnYazi}>Ödülü al</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.gorevTamam}>Tamamlandı</Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

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
  bayrakSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  bayrak: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  bayrakAcik: { backgroundColor: 'rgba(61,207,176,0.16)' },
  bayrakKapali: { backgroundColor: 'rgba(232,75,106,0.16)' },
  bayrakYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.text, fontWeight: '700' },
  etkinlikKart: {
    flexDirection: 'row',
    gap: 12,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
  },
  etkinlikNokta: { width: 8, height: 8, borderRadius: 4 },
  etkinlikMetin: { flex: 1, gap: 2 },
  etkinlikDurum: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  etkinlikBaslik: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '700' },
  gorevKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 8,
  },
  gorevUst: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  gorevBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
    flex: 1,
  },
  gorevOdul: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '800',
  },
  gorevMeta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  barBg: {
    height: 6,
    borderRadius: 999,
    backgroundColor: RenkTokenlari.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: RenkTokenlari.mint,
  },
  gorevBtn: {
    marginTop: 2,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: RenkTokenlari.primary,
  },
  gorevBtnOdul: { backgroundColor: RenkTokenlari.violet },
  gorevBtnYazi: {
    ...TipografiTokenlari.caption,
    color: '#fff',
    fontWeight: '800',
  },
  gorevTamam: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.mint,
    fontWeight: '700',
  },
});
