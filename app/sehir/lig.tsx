import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  AktifLigSezonunuGetir,
  SehirLigiSiralamasiniGetir,
  type SehirLigSirasi,
} from '../../src/moduller/sehir-ligi/okuma/SehirLigiSiralamasiniGetir';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

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
      setSeasonTitle('Sezon bilgisi alınamadı');
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
        <EkranBasligi title="Şehir Ligi" subtitle={seasonTitle} />
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.season_id}-${item.city_id}`}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <BosDurum
              icon="trophy-outline"
              title="Sıralama boş"
              body="Sezon başladığında şehirler burada listelenir."
            />
          }
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.rank}>#{item.rank ?? index + 1}</Text>
              <View style={styles.mid}>
                <Text style={styles.name}>
                  {item.city?.name ?? item.city_id.slice(0, 8)}
                </Text>
                <Text style={styles.meta}>
                  {item.city?.country_code} · hediye {item.gifts_score} · galibiyet{' '}
                  {item.battle_wins}
                </Text>
              </View>
              <Text style={styles.points}>{item.points}</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  rank: { ...TipografiTokenlari.h2, color: RenkTokenlari.accent, width: 40 },
  mid: { flex: 1, gap: 2 },
  name: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  meta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  points: { ...TipografiTokenlari.h2, color: RenkTokenlari.mint },
});
