import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  AktifSehirSavaslariniGetir,
  type SehirSavasi,
} from '../../src/moduller/sehir-savaslari/okuma/AktifSehirSavaslariniGetir';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function SehirSavasEkrani() {
  const [battles, setBattles] = useState<SehirSavasi[]>([]);

  const load = useCallback(async () => {
    try {
      setBattles(await AktifSehirSavaslariniGetir());
    } catch {
      setBattles([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="sehir-savaslari">
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>City Battles</Text>
          <Text style={styles.sub}>city_battles_enabled · skor server-authoritative</Text>
          <FlatList
            data={battles}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text style={styles.empty}>
                Aktif savaş yok. Admin `city_battles` satırı + bayrak gerekir.
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.status}>{item.status.toUpperCase()}</Text>
                <Text style={styles.match}>
                  {item.city_a?.name ?? 'A'} {item.score_a} — {item.score_b}{' '}
                  {item.city_b?.name ?? 'B'}
                </Text>
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
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    marginBottom: 10,
    gap: 6,
  },
  status: { ...TipografiTokenlari.micro, color: RenkTokenlari.accent },
  match: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
});
