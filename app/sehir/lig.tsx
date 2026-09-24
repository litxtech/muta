import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, FlatList, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useCeviri } from '../../src/i18n/useCeviri';
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
  const { t } = useCeviri();
  const [seasonTitle, setSeasonTitle] = useState('—');
  const [rows, setRows] = useState<SehirLigSirasi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  const load = useCallback(async () => {
    setYukleniyor(true);
    try {
      const season = await AktifLigSezonunuGetir();
      setSeasonTitle(season ? season.title : t('sehir.aktifSezonYok'));
      setRows(await SehirLigiSiralamasiniGetir(season?.id));
    } catch {
      setRows([]);
      setSeasonTitle(t('sehir.sezonAlinamadi'));
    } finally {
      setYukleniyor(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="sehir-ligi">
        <EkranBasligi
          title={t('sehir.lig')}
          subtitle={seasonTitle}
          fallbackHref="/sehir"
        />
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.season_id}-${item.city_id}`}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={yukleniyor} onRefresh={() => void load()} />
          }
          ListHeaderComponent={
            <View style={styles.info}>
              <Text style={styles.infoTitle}>{t('sehir.ligPuanBaslik')}</Text>
              <Text style={styles.infoBody}>{t('sehir.ligPuanBody')}</Text>
            </View>
          }
          ListEmptyComponent={
            <BosDurum
              icon="trophy-outline"
              title={t('sehir.ligBosBaslik')}
              body={t('sehir.ligBosBody')}
            />
          }
          renderItem={({ item, index }) => {
            const rank = item.rank ?? index + 1;
            const top = rank <= 3;
            return (
              <Pressable
                style={[styles.row, top && styles.rowTop]}
                onPress={() => router.push(`/sehir/${item.city_id}` as any)}
              >
                <Text style={[styles.rank, top && styles.rankTop]}>#{rank}</Text>
                <View style={styles.mid}>
                  <Text style={styles.name}>
                    {item.city?.name ?? item.city_id.slice(0, 8)}
                  </Text>
                  <Text style={styles.meta}>
                    {t('sehir.hediyeGalibiyet', {
                      gifts: item.gifts_score,
                      wins: item.battle_wins,
                    })}
                  </Text>
                </View>
                <Text style={styles.points}>{item.points}</Text>
              </Pressable>
            );
          }}
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
  info: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 6,
    marginBottom: 4,
  },
  infoTitle: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '800' },
  infoBody: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  rowTop: { borderColor: 'rgba(240,180,41,0.4)' },
  rank: {
    width: 36,
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    fontWeight: '800',
  },
  rankTop: { color: RenkTokenlari.accent },
  mid: { flex: 1, gap: 2 },
  name: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '700' },
  meta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  points: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, fontWeight: '800' },
});
