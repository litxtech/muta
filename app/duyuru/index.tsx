import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  AktifDuyurulariGetir,
  DuyuruOkunduIsaretle,
  type Duyuru,
} from '../../src/moduller/duyurular/islemler/DuyuruIslemleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function DuyuruEkrani() {
  const [items, setItems] = useState<Duyuru[]>([]);

  const load = useCallback(async () => {
    try {
      setItems(await AktifDuyurulariGetir());
    } catch {
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const okundu = async (id: string) => {
    const r = await DuyuruOkunduIsaretle(id);
    if (!r.ok) Alert.alert('Duyuru', r.hata);
    else Alert.alert('Okundu');
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="duyurular">
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>Announcements</Text>
          <Text style={styles.sub}>Politikalardan ayrı domain</Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>Duyuru yok (010).</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <GradientButton title="Okundu" variant="ghost" onPress={() => okundu(item.id)} />
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
    marginBottom: 10,
    gap: 8,
  },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  body: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
});
