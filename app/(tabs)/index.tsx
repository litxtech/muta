import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { RoomCard } from '../../src/components/RoomCard';
import { WalletChip } from '../../src/components/WalletChip';
import { useAuth } from '../../src/contexts/AuthContext';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { AnaSayfaBolumleriniGetir } from '../../src/moduller/ana-sayfa/okuma/AnaSayfaBolumleriniGetir';
import {
  CanliOdalariGetir,
  TrendOdalariGetir,
} from '../../src/moduller/ana-sayfa/okuma/AnaSayfaIcerikleriniGetir';
import { AnaSayfaBolumBasligi } from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaBolumBasligi';
import { CihazPushTokeniniKaydet } from '../../src/moduller/bildirimler/kayit/CihazPushTokeniniKaydet';
import type { Room } from '../../src/types/models';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { UygulamaKimligi } from '../../src/yapilandirma/UygulamaKimligi';

export default function HomeScreen() {
  const { wallet, profile } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [trending, setTrending] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const bolumler = useMemo(() => AnaSayfaBolumleriniGetir().filter((b) => b.aktif), []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [r, t] = await Promise.all([
        CanliOdalariGetir(12),
        TrendOdalariGetir(8),
      ]);
      setRooms(r);
      setTrending(t);
      void CihazPushTokeniniKaydet();
    } catch {
      setRooms([]);
      setTrending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="ana-sayfa">
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={RenkTokenlari.primary}
            />
          }
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.hello}>Merhaba</Text>
              <Text style={styles.name}>
                {profile?.display_name ?? UygulamaKimligi.APP_NAME}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/(tabs)/wallet' as any)}>
              <WalletChip coins={wallet?.coins ?? 0} diamonds={wallet?.diamonds ?? 0} />
            </Pressable>
          </View>

          <Pressable style={styles.exploreCta} onPress={() => router.push('/kesfet' as any)}>
            <Text style={styles.exploreTitle}>Explore</Text>
            <Text style={styles.exploreSub}>Global · Live · Voice · Creators</Text>
          </Pressable>

          <View style={styles.quickRow}>
            <Pressable style={styles.quick} onPress={() => router.push('/canli' as any)}>
              <Text style={styles.quickText}>Live</Text>
            </Pressable>
            <Pressable style={styles.quick} onPress={() => router.push('/pk' as any)}>
              <Text style={styles.quickText}>PK</Text>
            </Pressable>
            <Pressable style={styles.quick} onPress={() => router.push('/siralamalar' as any)}>
              <Text style={styles.quickText}>Ranks</Text>
            </Pressable>
          </View>
          <View style={styles.quickRow}>
            <Pressable style={styles.quick} onPress={() => router.push('/ajans' as any)}>
              <Text style={styles.quickText}>Ajans</Text>
            </Pressable>
            <Pressable style={styles.quick} onPress={() => router.push('/host' as any)}>
              <Text style={styles.quickText}>Host</Text>
            </Pressable>
            <Pressable style={styles.quick} onPress={() => router.push('/sehir' as any)}>
              <Text style={styles.quickText}>Şehir</Text>
            </Pressable>
            <Pressable style={styles.quick} onPress={() => router.push('/platform' as any)}>
              <Text style={styles.quickText}>Platform</Text>
            </Pressable>
          </View>

          {loading && rooms.length === 0 ? (
            <ActivityIndicator color={RenkTokenlari.primary} style={{ marginTop: 40 }} />
          ) : null}

          {bolumler.map((bolum) => {
            if (bolum.kod === 'voice_rooms' || bolum.kod === 'live_now') {
              const data = rooms.slice(0, 4);
              return (
                <AnaSayfaBolumBasligi
                  key={bolum.kod}
                  baslik={bolum.baslik}
                  onSeeAll={() => router.push('/(tabs)/rooms')}
                >
                  <View style={styles.grid}>
                    {data.length === 0 ? (
                      <Text style={styles.empty}>Henüz canlı oda yok.</Text>
                    ) : (
                      data.map((item) => (
                        <View key={item.id} style={styles.cardWrap}>
                          <RoomCard
                            room={item}
                            onPress={() => router.push(`/lobi/${item.id}` as any)}
                          />
                        </View>
                      ))
                    )}
                  </View>
                </AnaSayfaBolumBasligi>
              );
            }

            if (bolum.kod === 'trending') {
              return (
                <AnaSayfaBolumBasligi key={bolum.kod} baslik={bolum.baslik}>
                  <View style={styles.grid}>
                    {trending.slice(0, 4).map((item) => (
                      <View key={item.id} style={styles.cardWrap}>
                        <RoomCard
                          room={item}
                          onPress={() => router.push(`/lobi/${item.id}` as any)}
                        />
                      </View>
                    ))}
                  </View>
                </AnaSayfaBolumBasligi>
              );
            }

            if (bolum.kod === 'official_city_rooms' || bolum.kod === 'city_league') {
              return (
                <AnaSayfaBolumBasligi
                  key={bolum.kod}
                  baslik={bolum.baslik}
                  onSeeAll={() =>
                    router.push(
                      (bolum.kod === 'city_league' ? '/sehir/lig' : '/sehir') as any,
                    )
                  }
                >
                  <Text style={styles.placeholder}>
                    Şehir platformu → /sehir · bayrak: city_league_enabled
                  </Text>
                </AnaSayfaBolumBasligi>
              );
            }

            if (bolum.kod === 'events') {
              return (
                <AnaSayfaBolumBasligi
                  key={bolum.kod}
                  baslik={bolum.baslik}
                  onSeeAll={() => router.push('/platform' as any)}
                >
                  <Text style={styles.placeholder}>
                    Etkinlik / görev → /platform · events_enabled
                  </Text>
                </AnaSayfaBolumBasligi>
              );
            }

            if (bolum.kod === 'creators_for_you') {
              return (
                <AnaSayfaBolumBasligi key={bolum.kod} baslik={bolum.baslik}>
                  <Text style={styles.placeholder}>
                    Öneri motoru ayrı; analytics enqueue hazır (analytics_enabled).
                  </Text>
                </AnaSayfaBolumBasligi>
              );
            }

            return (
              <AnaSayfaBolumBasligi key={bolum.kod} baslik={bolum.baslik}>
                <Text style={styles.placeholder}>
                  Bu bölüm feature flag ile açıldığında aktifleşir.
                </Text>
              </AnaSayfaBolumBasligi>
            );
          })}
        </ScrollView>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 28 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hello: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  name: { ...TipografiTokenlari.h1, color: RenkTokenlari.text },
  exploreCta: {
    marginHorizontal: 20,
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.bgCard,
    gap: 4,
  },
  exploreTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  exploreSub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  quick: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  quickText: { ...TipografiTokenlari.h2, color: RenkTokenlari.primarySoft },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
  },
  cardWrap: { width: '47%', flexGrow: 1 },
  empty: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    paddingHorizontal: 4,
  },
  placeholder: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    paddingHorizontal: 20,
  },
});
