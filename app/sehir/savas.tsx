import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  AktifSehirSavaslariniGetir,
  type SehirSavasi,
} from '../../src/moduller/sehir-savaslari/okuma/AktifSehirSavaslariniGetir';
import { AnaSehirGetir } from '../../src/moduller/sehirler/okuma/DesteklenenSehirleriGetir';
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
  return map[status] ?? status;
}

export default function SehirSavasEkrani() {
  const [battles, setBattles] = useState<SehirSavasi[]>([]);
  const [anaCityId, setAnaCityId] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  const load = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [b, ana] = await Promise.all([
        AktifSehirSavaslariniGetir(),
        AnaSehirGetir().catch(() => null),
      ]);
      setBattles(b);
      setAnaCityId(ana?.city_id ?? null);
    } catch {
      setBattles([]);
    } finally {
      setYukleniyor(false);
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
          subtitle="Hediye = skor · ana şehrin için savaş"
          fallbackHref="/sehir"
        />
        <FlatList
          data={battles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={yukleniyor} onRefresh={() => void load()} />
          }
          ListHeaderComponent={
            <View style={styles.info}>
              <Text style={styles.infoTitle}>Nasıl katılırım?</Text>
              <Text style={styles.infoBody}>
                {anaCityId
                  ? 'Ana şehrin bir savaştaysa, herhangi bir odada hediye gönder — skor otomatik eklenir.'
                  : 'Önce bir ana şehir seç. Şehrin canlı savaşa girince hediyelerin skora yazılır.'}
              </Text>
              {!anaCityId ? (
                <Pressable onPress={() => router.push('/sehir' as any)}>
                  <Text style={styles.link}>Şehir seç →</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => router.push('/(tabs)/rooms' as any)}>
                  <Text style={styles.link}>Odaya git · hediye gönder →</Text>
                </Pressable>
              )}
            </View>
          }
          ListEmptyComponent={
            <BosDurum
              icon="shield-outline"
              title="Aktif savaş yok"
              body="Admin veya sezon ritmiyle yeni şehir savaşları açıldığında burada görünür."
            />
          }
          renderItem={({ item }) => {
            const benim =
              !!anaCityId &&
              (item.city_a_id === anaCityId || item.city_b_id === anaCityId);
            const live = item.status === 'live';
            return (
              <View style={[styles.card, live && styles.cardLive, benim && styles.cardMine]}>
                <View style={styles.cardTop}>
                  <Text style={[styles.status, live && styles.statusLive]}>
                    {durumEtiketi(item.status)}
                  </Text>
                  {benim ? (
                    <View style={styles.benimPill}>
                      <Text style={styles.benimText}>ŞEHRİN VAR</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.match}>
                  {item.city_a?.name ?? 'A'} {item.score_a} — {item.score_b}{' '}
                  {item.city_b?.name ?? 'B'}
                </Text>
                <View style={styles.aksiyonlar}>
                  <Pressable
                    onPress={() => router.push(`/sehir/${item.city_a_id}` as any)}
                  >
                    <Text style={styles.link}>{item.city_a?.name ?? 'A'} detay</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push(`/sehir/${item.city_b_id}` as any)}
                  >
                    <Text style={styles.link}>{item.city_b?.name ?? 'B'} detay</Text>
                  </Pressable>
                </View>
              </View>
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
  link: { ...TipografiTokenlari.caption, color: RenkTokenlari.mint, fontWeight: '700' },
  card: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 8,
  },
  cardLive: { borderColor: 'rgba(232,75,106,0.45)' },
  cardMine: { backgroundColor: 'rgba(61,207,176,0.06)' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusLive: { color: RenkTokenlari.danger },
  benimPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(61,207,176,0.16)',
  },
  benimText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '800',
    fontSize: 9,
  },
  match: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, fontWeight: '800' },
  aksiyonlar: { flexDirection: 'row', gap: 16 },
});
