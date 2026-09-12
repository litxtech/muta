import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  GuncelPolitikalariGetir,
  PolitikaKabulEt,
  type PolitikaSurumu,
} from '../../src/moduller/politikalar/islemler/PolitikaIslemleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function PolitikaEkrani() {
  const [items, setItems] = useState<PolitikaSurumu[]>([]);

  const load = useCallback(async () => {
    try {
      setItems(await GuncelPolitikalariGetir());
    } catch {
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const kabul = async (id: string) => {
    const r = await PolitikaKabulEt(id);
    if (!r.ok) Alert.alert('Politika', r.hata);
    else Alert.alert('Kabul edildi');
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="politikalar">
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>Policies</Text>
          <Text style={styles.sub}>Consent ≠ announcement</Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>Politika yok (010).</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {item.policies?.title ?? item.policy_code} v{item.version}
                </Text>
                <Text style={styles.body} numberOfLines={6}>
                  {item.body_md}
                </Text>
                <GradientButton title="Kabul et" onPress={() => kabul(item.id)} />
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
