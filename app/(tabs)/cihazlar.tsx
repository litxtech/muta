import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import {
  CihazOturumlariniListele,
  TekCihazOturumunuKapat,
  TumCihazOturumlariniKapat,
} from '../../src/moduller/kimlik-dogrulama/oturum/CihazOturumlariniYonet';
import { CihazKimliginiGetir } from '../../src/moduller/kimlik-dogrulama/oturum/CihazKimliginiGetir';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type Oturum = {
  id: string;
  device_id: string;
  platform: string | null;
  app_version: string | null;
  last_seen_at: string;
};

export default function CihazlarEkrani() {
  const [liste, setListe] = useState<Oturum[]>([]);
  const [buCihaz, setBuCihaz] = useState('');
  const [loading, setLoading] = useState(true);

  const yukle = useCallback(async () => {
    try {
      setLoading(true);
      const [deviceId, data] = await Promise.all([
        CihazKimliginiGetir(),
        CihazOturumlariniListele(),
      ]);
      setBuCihaz(deviceId);
      setListe(data as Oturum[]);
    } catch (e) {
      Alert.alert(
        'Oturumlar',
        e instanceof Error
          ? e.message
          : '003 migration calistirildigindan emin ol.',
      );
      setListe([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const tekKapat = async (id: string) => {
    try {
      await TekCihazOturumunuKapat(id);
      await yukle();
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kapatilamadi');
    }
  };

  const hepsiniKapat = async () => {
    try {
      await TumCihazOturumlariniKapat(buCihaz);
      await yukle();
      Alert.alert('Tamam', 'Diger cihazlardan cikis yapildi.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Islem basarisiz');
    }
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Aktif cihazlar</Text>
        <Text style={styles.sub}>Tek cihaz veya tum cihazlardan cikis</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={RenkTokenlari.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={liste}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Henuz kayitli cihaz yok (migration 003).</Text>
          }
          ListFooterComponent={
            liste.length > 0 ? (
              <GradientButton
                title="Diger tum cihazlardan cikis"
                variant="ghost"
                onPress={hepsiniKapat}
                style={{ marginTop: 12 }}
              />
            ) : null
          }
          renderItem={({ item }) => {
            const bu = item.device_id === buCihaz;
            return (
              <View style={styles.card}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.cardTitle}>
                    {item.platform ?? 'cihaz'} {bu ? '(bu cihaz)' : ''}
                  </Text>
                  <Text style={styles.cardMeta}>
                    v{item.app_version ?? '?'} · {new Date(item.last_seen_at).toLocaleString()}
                  </Text>
                </View>
                {!bu ? (
                  <Pressable onPress={() => tekKapat(item.id)} style={styles.kick}>
                    <Text style={styles.kickText}>Cikis</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, gap: 4, marginBottom: 12 },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  empty: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  cardMeta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  kick: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(232, 75, 106, 0.18)',
  },
  kickText: { ...TipografiTokenlari.caption, color: RenkTokenlari.danger, fontWeight: '700' },
});
