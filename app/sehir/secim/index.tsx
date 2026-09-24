import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../../src/components/Screen';
import { EkranBasligi } from '../../../src/components/EkranBasligi';
import { useCeviri } from '../../../src/i18n/useCeviri';
import type { CeviriAnahtari } from '../../../src/i18n/useCeviri';
import { BosDurum } from '../../../src/components/BosDurum';
import { ModulHataSiniri } from '../../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  AktifSecimleriGetir,
  type SehirSecimi,
} from '../../../src/moduller/sehir-secimleri/okuma/AktifSecimleriGetir';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function durumEtiketi(
  status: string,
  t: (key: CeviriAnahtari) => string,
) {
  const map: Record<string, CeviriAnahtari> = {
    nominating: 'sehir.durumAdaylik',
    voting: 'sehir.durumOylama',
    tallied: 'sehir.durumSonuclandi',
    cancelled: 'sehir.durumIptal',
  };
  const key = map[status];
  return key ? t(key) : status;
}

function durumRenk(status: string) {
  if (status === 'voting') return RenkTokenlari.mint;
  if (status === 'nominating') return RenkTokenlari.accent;
  if (status === 'tallied') return RenkTokenlari.primarySoft;
  return RenkTokenlari.textMuted;
}

export default function SehirSecimEkrani() {
  const { t } = useCeviri();
  const [elections, setElections] = useState<SehirSecimi[]>([]);

  const load = useCallback(async () => {
    try {
      setElections(await AktifSecimleriGetir());
    } catch {
      setElections([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="sehir-secimleri">
        <EkranBasligi
          title={t('sehir.secim')}
          subtitle={t('sehir.secimAlt')}
          onBack={() => router.back()}
        />
        <FlatList
          data={elections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <BosDurum
              icon="checkbox-outline"
              title={t('sehir.secimBosBaslik')}
              body={t('sehir.secimBosBody')}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/sehir/secim/${item.id}` as any)}
            >
              <View style={styles.cardTop}>
                <View style={styles.iconWrap}>
                  <Ionicons name="location" size={16} color={RenkTokenlari.mint} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.meta}>
                    {item.city?.name ?? t('sehir.sehirVarsayilan')} ·{' '}
                    {item.role_target === 'leader'
                      ? t('sehir.lider')
                      : t('sehir.yardimci')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: `${durumRenk(item.status)}22` },
                  ]}
                >
                  <Text style={[styles.pillText, { color: durumRenk(item.status) }]}>
                    {durumEtiketi(item.status, t)}
                  </Text>
                </View>
              </View>
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {(item.total_votes ?? 0) > 0
                    ? t('sehir.oySayisi', { count: item.total_votes })
                    : t('sehir.detayOy')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
              </View>
            </Pressable>
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
    flexGrow: 1,
  },
  card: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: BoslukTokenlari.md },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(61,207,176,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  title: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '700' },
  meta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
  },
  pillText: { ...TipografiTokenlari.micro, fontWeight: '700', fontSize: 10 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: { ...TipografiTokenlari.caption, color: RenkTokenlari.textDim },
});
