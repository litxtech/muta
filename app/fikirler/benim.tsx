import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { FikirKarti } from '../../src/moduller/fikir-geri-bildirim/bilesenler/FikirKarti';
import { FikirlerimiListele } from '../../src/moduller/fikir-geri-bildirim/islemler/FikirIslemleri';
import type { FikirOzet } from '../../src/moduller/fikir-geri-bildirim/tipler';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function FikirlerimEkrani() {
  const [items, setItems] = useState<FikirOzet[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [offset, setOffset] = useState(0);
  const [bitti, setBitti] = useState(false);

  const load = useCallback(async (reset = false) => {
    const off = reset ? 0 : offset;
    try {
      const row = await FikirlerimiListele(30, off);
      setItems((prev) => (reset ? row : [...prev, ...row]));
      setOffset(off + row.length);
      setBitti(row.length < 30);
    } catch {
      if (reset) setItems([]);
    } finally {
      setYukleniyor(false);
    }
  }, [offset]);

  useFocusEffect(
    useCallback(() => {
      setYukleniyor(true);
      setOffset(0);
      setBitti(false);
      void (async () => {
        try {
          const row = await FikirlerimiListele(30, 0);
          setItems(row);
          setOffset(row.length);
          setBitti(row.length < 30);
        } catch {
          setItems([]);
        } finally {
          setYukleniyor(false);
        }
      })();
    }, []),
  );

  return (
    <Screen>
      <ModulHataSiniri modulAdi="fikirlerim">
        <EkranBasligi
          title="Fikirlerim"
          subtitle="Gönderdiklerin · durum takibi"
          onBack={() => router.back()}
        />
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.liste}
          refreshControl={
            <RefreshControl
              refreshing={yukleniyor && items.length > 0}
              onRefresh={() => {
                setYukleniyor(true);
                setOffset(0);
                void load(true);
              }}
              tintColor={RenkTokenlari.primarySoft}
            />
          }
          onEndReached={() => {
            if (!yukleniyor && !bitti) void load(false);
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            yukleniyor ? null : (
              <BosDurum
                title="Henüz fikir yok"
                body="İlk fikrini gönder; durumunu burada takip et."
              />
            )
          }
          renderItem={({ item }) => (
            <FikirKarti
              item={item}
              onPress={() => router.push(`/fikirler/${item.id}` as any)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  liste: {
    padding: BoslukTokenlari.md,
    paddingBottom: 40,
  },
});
