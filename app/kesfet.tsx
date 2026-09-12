import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { RoomCard } from '../src/components/RoomCard';
import { ModulHataSiniri } from '../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  KESFET_FILTRELERI,
  KesfetKategorileriniGetir,
  type KesfetFiltresi,
  type KesfetKategorisi,
} from '../src/moduller/kesfet/filtreler/KesfetFiltreleri';
import { CanliOdalariGetir } from '../src/moduller/ana-sayfa/okuma/AnaSayfaIcerikleriniGetir';
import type { Room } from '../src/types/models';
import { RenkTokenlari } from '../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../src/tasarim-sistemi/TipografiTokenlari';

export default function KesfetEkrani() {
  const [filtre, setFiltre] = useState<KesfetFiltresi>('voice_room');
  const [kategoriler, setKategoriler] = useState<KesfetKategorisi[]>([]);
  const [kategori, setKategori] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, data] = await Promise.all([
        KesfetKategorileriniGetir().catch(() => []),
        CanliOdalariGetir(40),
      ]);
      setKategoriler(cats);
      setRooms(data);
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
      <ModulHataSiniri modulAdi="kesfet">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>Explore</Text>
          <Text style={styles.sub}>Filtreler dinamik · kategori admin yönetimli</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
          {KESFET_FILTRELERI.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setFiltre(f.id)}
              style={[styles.chip, filtre === f.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, filtre === f.id && styles.chipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
          {kategoriler.map((k) => (
            <Pressable
              key={k.id}
              onPress={() => setKategori(kategori === k.code ? null : k.code)}
              style={[styles.chip, kategori === k.code && styles.chipActive]}
            >
              <Text style={[styles.chipText, kategori === k.code && styles.chipTextActive]}>
                {k.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={RenkTokenlari.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Sonuç yok. Migration 005 + canlı oda gerekli.</Text>
          }
          renderItem={({ item }) => (
            <RoomCard room={item} onPress={() => router.push(`/lobi/${item.id}` as any)} />
          )}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, gap: 4, marginBottom: 10 },
  back: { ...TipografiTokenlari.caption, color: RenkTokenlari.primarySoft },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  rowScroll: { paddingHorizontal: 16, marginBottom: 8, maxHeight: 44 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    marginRight: 8,
  },
  chipActive: {
    borderColor: RenkTokenlari.primary,
    backgroundColor: 'rgba(232, 64, 145, 0.18)',
  },
  chipText: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  chipTextActive: { color: RenkTokenlari.primarySoft, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  empty: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
});
