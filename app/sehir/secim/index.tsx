import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../../src/components/Screen';
import { EkranBasligi } from '../../../src/components/EkranBasligi';
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

function durumEtiketi(status: string) {
  const map: Record<string, string> = {
    nominating: 'Adaylık',
    voting: 'Oylama',
    tallied: 'Sonuçlandı',
    cancelled: 'İptal',
  };
  return map[status] ?? status;
}

function durumRenk(status: string) {
  if (status === 'voting') return RenkTokenlari.mint;
  if (status === 'nominating') return RenkTokenlari.accent;
  if (status === 'tallied') return RenkTokenlari.primarySoft;
  return RenkTokenlari.textMuted;
}

export default function SehirSecimEkrani() {
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
          title="Şehir Seçimleri"
          subtitle="Oy kullan · canlı gidişat"
          onBack={() => router.back()}
        />
        <FlatList
          data={elections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <BosDurum
              icon="checkbox-outline"
              title="Aktif seçim yok"
              body="Admin bir şehirde seçim başlattığında burada görünür."
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
                    {item.city?.name ?? 'Şehir'} · {item.role_target === 'leader' ? 'Lider' : 'Yardımcı'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: `${durumRenk(item.status)}22` },
                  ]}
                >
                  <Text style={[styles.pillText, { color: durumRenk(item.status) }]}>
                    {durumEtiketi(item.status)}
                  </Text>
                </View>
              </View>
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {(item.total_votes ?? 0) > 0
                    ? `${item.total_votes} oy`
                    : 'Detay & oy'}
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
