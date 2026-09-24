import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useCeviri } from '../../src/i18n/useCeviri';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { FikirKarti } from '../../src/moduller/fikir-geri-bildirim/bilesenler/FikirKarti';
import { FikirToplulukListele } from '../../src/moduller/fikir-geri-bildirim/islemler/FikirIslemleri';
import type { FikirOzet } from '../../src/moduller/fikir-geri-bildirim/tipler';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type Sekme = 'popular' | 'new' | 'reviewing';

export default function FikirMerkeziEkrani() {
  const { t } = useCeviri();
  const [sekme, setSekme] = useState<Sekme>('popular');
  const [items, setItems] = useState<FikirOzet[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const load = useCallback(async () => {
    try {
      const sort =
        sekme === 'popular' ? 'popular' : sekme === 'new' ? 'new' : 'reviewing';
      setItems(
        await FikirToplulukListele({
          sort,
          status: sekme === 'reviewing' ? 'REVIEWING' : null,
          limit: 30,
        }),
      );
    } catch {
      setItems([]);
    } finally {
      setYukleniyor(false);
    }
  }, [sekme]);

  useFocusEffect(
    useCallback(() => {
      setYukleniyor(true);
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <ModulHataSiniri modulAdi="fikir-merkezi">
        <EkranBasligi
          title={t('fikirler.baslik')}
          subtitle={t('fikirler.altBirlikte')}
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
                void load();
              }}
              tintColor={RenkTokenlari.primarySoft}
            />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <LinearGradient
                colors={['rgba(196,59,255,0.22)', 'rgba(232,64,145,0.08)', 'transparent']}
                style={styles.hero}
              >
                <Ionicons name="bulb" size={28} color={RenkTokenlari.accent} />
                <Text style={styles.heroBaslik}>{t('fikirler.heroBaslik')}</Text>
                <Text style={styles.heroAlt}>{t('fikirler.heroAlt')}</Text>
                <View style={styles.aksiyonlar}>
                  <Pressable
                    style={styles.cta}
                    onPress={() => router.push('/fikirler/olustur' as any)}
                  >
                    <Ionicons name="add" size={18} color={RenkTokenlari.textOnPrimary} />
                    <Text style={styles.ctaYazi}>{t('fikirler.fikirGonder')}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.ctaIkincil}
                    onPress={() => router.push('/fikirler/benim' as any)}
                  >
                    <Ionicons name="folder-outline" size={18} color={RenkTokenlari.text} />
                    <Text style={styles.ctaIkincilYazi}>{t('fikirler.benim')}</Text>
                  </Pressable>
                </View>
              </LinearGradient>

              <View style={styles.sekmeler}>
                {(
                  [
                    ['popular', 'fikirler.sekmePopuler'],
                    ['new', 'fikirler.sekmeYeni'],
                    ['reviewing', 'fikirler.sekmeDegerlendirilen'],
                  ] as const
                ).map(([k, key]) => (
                  <Pressable
                    key={k}
                    onPress={() => setSekme(k)}
                    style={[styles.sekme, sekme === k && styles.sekmeAktif]}
                  >
                    <Text
                      style={[styles.sekmeYazi, sekme === k && styles.sekmeYaziAktif]}
                    >
                      {t(key)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.bolumBaslik}>
                {sekme === 'popular'
                  ? t('fikirler.bolumPopuler')
                  : sekme === 'new'
                    ? t('fikirler.bolumYeni')
                    : t('fikirler.bolumDegerlendirilen')}
              </Text>
            </View>
          }
          ListEmptyComponent={
            yukleniyor ? null : (
              <View style={styles.bos}>
                <Text style={styles.bosBaslik}>{t('fikirler.bosTopluluk')}</Text>
                <Text style={styles.bosAlt}>{t('fikirler.bosToplulukBody')}</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <FikirKarti
              item={item}
              showVotes
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
    paddingHorizontal: BoslukTokenlari.md,
    paddingBottom: 40,
    gap: 0,
  },
  header: { gap: BoslukTokenlari.md, marginBottom: BoslukTokenlari.sm },
  hero: {
    borderRadius: YaricapTokenlari.xl,
    padding: BoslukTokenlari.lg,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  heroBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  heroAlt: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    lineHeight: 22,
  },
  aksiyonlar: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: RenkTokenlari.primarySoft,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.pill,
  },
  ctaYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '700',
  },
  ctaIkincil: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: RenkTokenlari.surface,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  ctaIkincilYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  sekmeler: { flexDirection: 'row', gap: 8 },
  sekme: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
  },
  sekmeAktif: { backgroundColor: RenkTokenlari.primarySoft + '33' },
  sekmeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  sekmeYaziAktif: { color: RenkTokenlari.primarySoft },
  bolumBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    marginTop: 4,
  },
  bos: { paddingVertical: 28, gap: 6 },
  bosBaslik: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '600' },
  bosAlt: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
});
