import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  AktifLigSezonunuGetir,
  SehirLigiSiralamasiniGetir,
  type SehirLigSirasi,
} from '../../src/moduller/sehir-ligi/okuma/SehirLigiSiralamasiniGetir';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function SehirLigEkrani() {
  const [seasonTitle, setSeasonTitle] = useState('—');
  const [rows, setRows] = useState<SehirLigSirasi[]>([]);

  const load = useCallback(async () => {
    try {
      const season = await AktifLigSezonunuGetir();
      setSeasonTitle(season ? `${season.title} (${season.code})` : 'Aktif sezon yok');
      setRows(await SehirLigiSiralamasiniGetir(season?.id));
    } catch {
      setRows([]);
      setSeasonTitle('Migration 009 gerekli');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="sehir-ligi">
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>City League</Text>
          <Text style={styles.sub}>{seasonTitle}</Text>
          <FlatList
            data={rows}
            keyExtractor={(item) => `${item.season_id}-${item.city_id}`}
            ListEmptyComponent={<Text style={styles.empty}>Sıralama boş.</Text>}
            renderItem={({ item, index }) => (
              <View style={styles.row}>
                <Text style={styles.rank}>#{item.rank ?? index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.city?.name ?? item.city_id.slice(0, 8)}
                  </Text>
                  <Text style={styles.meta}>
                    {item.city?.country_code} · gifts {item.gifts_score} · wins{' '}
                    {item.battle_wins}
                  </Text>
                </View>
                <Text style={styles.points}>{item.points}</Text>
              </View>
            )}
          />
        </View>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 20, gap: 8 },
  back: { ...TipografiTokenlari.caption, color: RenkTokenlari.primarySoft },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, marginBottom: 8 },
  empty: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: RenkTokenlari.border,
  },
  rank: { ...TipografiTokenlari.h2, color: RenkTokenlari.accent, width: 40 },
  name: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  meta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  points: { ...TipografiTokenlari.h2, color: RenkTokenlari.mint },
});
