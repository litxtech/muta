import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  AktifSehirSavaslariniGetir,
  type SehirSavasi,
} from '../../src/moduller/sehir-savaslari/okuma/AktifSehirSavaslariniGetir';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function durumEtiketi(status: string) {
  const map: Record<string, string> = {
    live: 'Canlı',
    scheduled: 'Planlandı',
    finished: 'Bitti',
    cancelled: 'İptal',
  };
  return map[status] ?? status.toUpperCase();
}

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
        <EkranBasligi
          title="Şehir Savaşları"
          subtitle="Skor sunucu tarafından tutulur"
        />
        <FlatList
          data={battles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <BosDurum
              icon="shield-outline"
              title="Aktif savaş yok"
              body="Yeni şehir savaşları başladığında burada görünür."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.status}>{durumEtiketi(item.status)}</Text>
              <Text style={styles.match}>
                {item.city_a?.name ?? 'A'} {item.score_a} — {item.score_b}{' '}
                {item.city_b?.name ?? 'B'}
              </Text>
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
    gap: BoslukTokenlari.sm,
  },
  card: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.sm,
  },
  status: { ...TipografiTokenlari.micro, color: RenkTokenlari.accent },
  match: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
});
