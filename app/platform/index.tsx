import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
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
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function OperasyonHubEkrani() {
  const { isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const eventsOn = OzellikBayragiAktifMi('events_enabled');
  const missionsOn = OzellikBayragiAktifMi('missions_enabled');

  const [events, setEvents] = useState<PlatformEtkinligi[]>([]);
  const [missions, setMissions] = useState<Gorev[]>([]);
  const [progress, setProgress] = useState<Record<string, GorevIlerleme>>({});
  const [badgeCount, setBadgeCount] = useState(0);

  const load = useCallback(async () => {
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
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const ilerlet = (code: string) => {
    islemiDene('oy_kullan', async () => {
      if (!missionsOn) {
        Alert.alert('Kapalı', 'missions_enabled açın.');
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
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>Platform</Text>
          <Text style={styles.sub}>
            Events · Missions · Badges ({badgeCount}) · events{' '}
            {eventsOn ? 'on' : 'off'}
          </Text>

          <View style={styles.navRow}>
            <Pressable style={styles.nav} onPress={() => router.push('/duyuru' as any)}>
              <Text style={styles.navText}>Duyuru</Text>
            </Pressable>
            <Pressable style={styles.nav} onPress={() => router.push('/politika' as any)}>
              <Text style={styles.navText}>Politika</Text>
            </Pressable>
            <Pressable style={styles.nav} onPress={() => router.push('/guvenlik' as any)}>
              <Text style={styles.navText}>Güvenlik</Text>
            </Pressable>
            <Pressable style={styles.nav} onPress={() => router.push('/bildirimler' as any)}>
              <Text style={styles.navText}>Push</Text>
            </Pressable>
            <Pressable style={styles.nav} onPress={() => router.push('/sertifikasyon' as any)}>
              <Text style={styles.navText}>Sert.</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Etkinlikler</Text>
          {events.length === 0 ? (
            <Text style={styles.empty}>Etkinlik yok (010 + events_enabled).</Text>
          ) : (
            events.map((ev) => (
              <Text key={ev.id} style={styles.line}>
                {ev.status} · {ev.title}
              </Text>
            ))
          )}

          <Text style={styles.section}>Görevler</Text>
          <FlatList
            data={missions}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>Görev yok.</Text>}
            renderItem={({ item }) => {
              const p = progress[item.id];
              const done = !!p?.completed_at;
              const claimed = !!p?.claimed_at;
              return (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>
                    {p?.progress ?? 0}/{item.goal_target} · +{item.reward_coins} coin
                    {claimed ? ' · claimed' : done ? ' · ready' : ''}
                  </Text>
                  {!done ? (
                    <GradientButton title="İlerlet (+1)" onPress={() => ilerlet(item.code)} />
                  ) : !claimed ? (
                    <GradientButton title="Ödülü al" onPress={() => odul(item.code)} />
                  ) : (
                    <Text style={styles.cardMeta}>Tamamlandı</Text>
                  )}
                </View>
              );
            }}
          />
        </View>
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
  content: { flex: 1, padding: 20, gap: 8 },
  back: { ...TipografiTokenlari.caption, color: RenkTokenlari.primarySoft },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nav: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  navText: { ...TipografiTokenlari.caption, color: RenkTokenlari.text },
  section: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, marginTop: 6 },
  empty: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  line: { ...TipografiTokenlari.body, color: RenkTokenlari.text, marginBottom: 4 },
  card: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    marginBottom: 8,
    gap: 6,
  },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  cardMeta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
});
