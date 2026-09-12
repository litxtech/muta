import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  BildirimKuyrugaEkleDev,
  BildirimKuyrugumuGetir,
  type OutboxBildirim,
} from '../../src/moduller/bildirimler/okuma/BildirimKuyrugumuGetir';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function BildirimMerkeziEkrani() {
  const [items, setItems] = useState<OutboxBildirim[]>([]);

  const load = useCallback(async () => {
    try {
      setItems(await BildirimKuyrugumuGetir());
    } catch {
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const testPush = async () => {
    const r = await BildirimKuyrugaEkleDev({
      title: 'Test bildirimi',
      body: 'Push center sandbox',
      category: 'system',
    });
    if (!r.ok) Alert.alert('Push', r.hata);
    await load();
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="bildirimler">
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>Push Center</Text>
          <Text style={styles.sub}>notification_outbox · APNs/FCM worker ayrı</Text>
          <GradientButton title="Test kuyruğa ekle (dev)" onPress={testPush} />
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>Kuyruk boş.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.meta}>
                  {item.status} · {item.category}
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
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  empty: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  card: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    marginBottom: 8,
    gap: 4,
  },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  meta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
});
