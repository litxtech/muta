import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { ListeGrubu, ListeSatiri } from '../../src/components/ListeSatiri';
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
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TamusoBanner } from '../../src/banner';

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
          subtitle={`Etkinlik · görev · ${badgeCount} rozet${eventsOn ? '' : ' · etkinlik kapalı'}`}
        />
        <TamusoBanner placement="GAME_CENTER_TOP" screen="GAME_CENTER" />
        <FlatList
          data={missions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <TamusoBanner placement="GAME_CENTER_MIDDLE" screen="GAME_CENTER" />
              <ListeGrubu title="Kısayollar">
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
                />
                <ListeSatiri
                  icon="notifications-outline"
                  label="Bildirimler"
                  onPress={() => router.push('/bildirimler' as any)}
                />
                <ListeSatiri
                  icon="ribbon-outline"
                  label="Sertifikasyon"
                  onPress={() => router.push('/sertifikasyon' as any)}
                  last
                />
              </ListeGrubu>

              <Text style={styles.section}>Etkinlikler</Text>
              {events.length === 0 ? (
                <BosDurum
                  icon="calendar-outline"
                  title="Etkinlik yok"
                  body="Aktif platform etkinliği bulunmuyor."
                />
              ) : (
                <View style={styles.eventsCard}>
                  {events.map((ev, i) => (
                    <View
                      key={ev.id}
                      style={[
                        styles.eventRow,
                        i === events.length - 1 && styles.eventRowLast,
                      ]}
                    >
                      <Text style={styles.eventStatus}>{ev.status}</Text>
                      <Text style={styles.eventTitle}>{ev.title}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.section}>Görevler</Text>
            </View>
          }
          ListEmptyComponent={
            <BosDurum
              icon="flag-outline"
              title="Görev yok"
              body="Yeni görevler eklendiğinde burada görünür."
            />
          }
          renderItem={({ item }) => {
            const p = progress[item.id];
            const done = !!p?.completed_at;
            const claimed = !!p?.claimed_at;
            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {p?.progress ?? 0}/{item.goal_target} · +{item.reward_coins} coin
                  {claimed ? ' · alındı' : done ? ' · hazır' : ''}
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
  headerBlock: { gap: BoslukTokenlari.sm },
  section: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    marginTop: BoslukTokenlari.sm,
  },
  eventsCard: {
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    overflow: 'hidden',
  },
  eventRow: {
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
    gap: 2,
  },
  eventRowLast: { borderBottomWidth: 0 },
  eventStatus: { ...TipografiTokenlari.micro, color: RenkTokenlari.accent },
  eventTitle: { ...TipografiTokenlari.body, color: RenkTokenlari.text },
  card: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.sm,
  },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  cardMeta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
});
