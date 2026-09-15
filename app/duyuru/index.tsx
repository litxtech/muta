import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  AktifDuyurulariGetir,
  DuyuruOkunduIsaretle,
  type Duyuru,
} from '../../src/moduller/duyurular/islemler/DuyuruIslemleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

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
        <EkranBasligi
          title="Duyurular"
          subtitle="Platform bildirimleri"
        />
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <BosDurum
              icon="megaphone-outline"
              title="Duyuru yok"
              body="Yeni duyurular yayınlandığında burada görünür."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <GradientButton
                title="Okundu"
                variant="ghost"
                onPress={() => okundu(item.id)}
              />
            </View>
          )}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  card: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.sm,
  },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  body: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
});
