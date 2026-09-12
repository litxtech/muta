import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  LiderlikSiralamasiniGetir,
  LiderlikSiralamasiniYenile,
  type SiralamaBoard,
  type SiralamaSatiri,
} from '../../src/moduller/liderlik-siralamalari/okuma/LiderlikSiralamasiniGetir';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

const BOARDS: { id: SiralamaBoard; label: string }[] = [
  { id: 'gifter', label: 'Top Gifter' },
  { id: 'top_recharge', label: 'Top Recharge' },
  { id: 'host', label: 'Host' },
];

/** Top Recharge ≠ Top Gifter */
export default function SiralamalarEkrani() {
  const [board, setBoard] = useState<SiralamaBoard>('gifter');
  const [rows, setRows] = useState<SiralamaSatiri[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await LiderlikSiralamasiniYenile(board, 'daily');
      setRows(await LiderlikSiralamasiniGetir({ board, period: 'daily' }));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [board]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="liderlik-siralamalari">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>Leaderboards</Text>
          <Text style={styles.sub}>Gifter harcama · Recharge yükleme — ayrı</Text>
        </View>

        <View style={styles.tabs}>
          {BOARDS.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setBoard(b.id)}
              style={[styles.tab, board === b.id && styles.tabActive]}
            >
              <Text style={[styles.tabText, board === b.id && styles.tabTextActive]}>
                {b.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={RenkTokenlari.primary}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Sıralama boş. Migration 007 + hediye/yükleme sonrası yenilenir.
            </Text>
          }
          ListFooterComponent={
            <GradientButton title="Yenile" variant="ghost" onPress={load} />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rank}>#{item.rank ?? '-'}</Text>
              <Text style={styles.user} numberOfLines={1}>
                {item.user_id?.slice(0, 8) ?? '—'}
              </Text>
              <Text style={styles.score}>{item.score}</Text>
            </View>
          )}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, gap: 4 },
  back: { ...TipografiTokenlari.caption, color: RenkTokenlari.primarySoft },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, marginBottom: 10 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  tabActive: {
    borderColor: RenkTokenlari.primary,
    backgroundColor: 'rgba(232, 64, 145, 0.16)',
  },
  tabText: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  tabTextActive: { color: RenkTokenlari.primarySoft, fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 8 },
  empty: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  rank: { ...TipografiTokenlari.h2, color: RenkTokenlari.accent, width: 40 },
  user: { ...TipografiTokenlari.body, color: RenkTokenlari.text, flex: 1 },
  score: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
});
