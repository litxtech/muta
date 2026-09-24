import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import {
  SehirYukselenleriGetir,
  type SehirYukselen,
} from '../../sehirler/islemler/SehirModernIslemleri';
import { OzellikBayragiAktifMi } from '../../ozellik-bayraklari/OzellikBayragiAktifMi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

export function KesfetSehirYukselenSeridi() {
  const { t } = useCeviri();
  const [rows, setRows] = useState<SehirYukselen[]>([]);
  const acik = OzellikBayragiAktifMi('city_league_enabled');

  const yukle = useCallback(async () => {
    if (!acik) return;
    try {
      setRows(await SehirYukselenleriGetir(6));
    } catch {
      setRows([]);
    }
  }, [acik]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  if (!acik || rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.baslikSatir}>
        <Text style={styles.baslik}>{t('kesfet.yukselenSehirler')}</Text>
        <Pressable onPress={() => router.push('/sehir' as any)}>
          <Text style={styles.link}>{t('modlar.tumu')}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {rows.map((c) => (
          <Pressable
            key={c.id}
            style={styles.kart}
            onPress={() => router.push(`/sehir/${c.id}` as any)}
          >
            <View style={styles.ikon}>
              <Ionicons name="trending-up" size={16} color={RenkTokenlari.mint} />
            </View>
            <Text style={styles.ad} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={styles.meta}>+{c.delta_24h} {t('kesfet.son24s')}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  baslik: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '800' },
  link: { ...TipografiTokenlari.caption, color: RenkTokenlari.mint, fontWeight: '700' },
  row: { gap: 10, paddingRight: 8 },
  kart: {
    width: 120,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 6,
  },
  ikon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(61,207,176,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ad: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '800' },
  meta: { ...TipografiTokenlari.micro, color: RenkTokenlari.mint, fontWeight: '700' },
});
