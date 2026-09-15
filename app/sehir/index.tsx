import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { SehirDestekle } from '../../src/moduller/sehirler/islemler/SehirDestekle';
import { SehirDestekGeriCek } from '../../src/moduller/sehirler/islemler/SehirDestekGeriCek';
import {
  SehirleriGetir,
  type GeoSehir,
} from '../../src/moduller/sehirler/okuma/SehirleriGetir';
import { DesteklenenSehirleriGetir } from '../../src/moduller/sehirler/okuma/DesteklenenSehirleriGetir';
import { ResmiSehirOdalariniGetir } from '../../src/moduller/sehirler/okuma/ResmiSehirOdalariniGetir';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const NAV = [
  {
    key: 'lig',
    label: 'Lig',
    alt: 'Sezon',
    icon: 'trophy-outline' as const,
    href: '/sehir/lig',
    tint: RenkTokenlari.accent,
  },
  {
    key: 'savas',
    label: 'Savaş',
    alt: 'Canlı',
    icon: 'flash-outline' as const,
    href: '/sehir/savas',
    tint: RenkTokenlari.danger,
  },
  {
    key: 'secim',
    label: 'Seçim',
    alt: 'Oy',
    icon: 'checkbox-outline' as const,
    href: '/sehir/secim',
    tint: RenkTokenlari.mint,
  },
];

export default function SehirHubEkrani() {
  const { isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const leagueOn = OzellikBayragiAktifMi('city_league_enabled');

  const [cities, setCities] = useState<GeoSehir[]>([]);
  const [supportedIds, setSupportedIds] = useState<Set<string>>(new Set());
  const [roomCount, setRoomCount] = useState(0);
  /** Sadece tiklanan sehir doner */
  const [busyCityId, setBusyCityId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, s, r] = await Promise.all([
        SehirleriGetir().catch(() => []),
        DesteklenenSehirleriGetir().catch(() => []),
        ResmiSehirOdalariniGetir(5).catch(() => []),
      ]);
      setCities(c);
      setSupportedIds(new Set(s.map((x: { city_id: string }) => x.city_id)));
      setRoomCount(r.length);
    } catch {
      /* migration 009 */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const destekle = (cityId: string) => {
    islemiDene('oy_kullan', async () => {
      if (!leagueOn) {
        Alert.alert('Kapalı', 'Şehir ligi özelliği şu an kapalı.');
        return;
      }
      setBusyCityId(cityId);
      const sonuc = await SehirDestekle({ cityId, isPrimary: true });
      setBusyCityId(null);
      if (!sonuc.ok) {
        Alert.alert('Destek', sonuc.hata);
        return;
      }
      await load();
    });
  };

  const destekGeriCek = (cityId: string) => {
    islemiDene('oy_kullan', async () => {
      if (!leagueOn) {
        Alert.alert('Kapalı', 'Şehir ligi özelliği şu an kapalı.');
        return;
      }
      Alert.alert('Destek geri çek', 'Bu şehir desteğini kaldırmak istiyor musun?', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Geri çek',
          style: 'destructive',
          onPress: async () => {
            setBusyCityId(cityId);
            const sonuc = await SehirDestekGeriCek({ cityId });
            setBusyCityId(null);
            if (!sonuc.ok) {
              Alert.alert('Destek', sonuc.hata);
              return;
            }
            await load();
          },
        },
      ]);
    });
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.headerBleed}>
        <EkranBasligi
          title="Şehir"
          subtitle={`${roomCount} resmi oda · lig · savaş · seçim`}
        />
      </View>
      <View style={styles.navRow}>
        {NAV.map((n) => (
          <Pressable
            key={n.key}
            style={styles.nav}
            onPress={() => router.push(n.href as any)}
          >
            <View style={[styles.navIcon, { backgroundColor: `${n.tint}22` }]}>
              <Ionicons name={n.icon} size={16} color={n.tint} />
            </View>
            <Text style={styles.navText}>{n.label}</Text>
            <Text style={styles.navAlt}>{n.alt}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.section}>Şehirler</Text>
    </View>
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="sehirler">
        <FlatList
          data={cities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={listHeader}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <BosDurum
              icon="location-outline"
              title="Şehir yok"
              body="Şehir listesi henüz hazır değil."
            />
          }
          renderItem={({ item }) => {
            const destekli = supportedIds.has(item.id);
            const buBusy = busyCityId === item.id;
            return (
              <LinearGradient
                colors={['#241C30', '#1A1524']}
                style={[styles.card, destekli && styles.cardActive]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cityBadge}>
                    <Ionicons name="location" size={14} color={RenkTokenlari.primarySoft} />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardMeta}>
                      {item.plate_code
                        ? `Plaka ${item.plate_code}`
                        : item.country_code}{' '}
                      · {item.supporter_count} destekçi
                    </Text>
                  </View>
                  {destekli ? (
                    <View style={styles.destekPill}>
                      <Text style={styles.destekPillText}>DESTEK</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statChip}>
                    <Text style={styles.statVal}>{item.power_score}</Text>
                    <Text style={styles.statLbl}>güç</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Text style={styles.statVal}>{item.supporter_count}</Text>
                    <Text style={styles.statLbl}>destekçi</Text>
                  </View>
                </View>
                {destekli ? (
                  <GradientButton
                    title="Destek geri çek"
                    onPress={() => destekGeriCek(item.id)}
                    loading={buBusy}
                    variant="ghost"
                  />
                ) : (
                  <GradientButton
                    title="Destekle"
                    onPress={() => destekle(item.id)}
                    loading={buBusy}
                    disabled={busyCityId !== null && !buBusy}
                  />
                )}
              </LinearGradient>
            );
          }}
        />
        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={() => {
            void refreshProfile();
            void refreshWallet();
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.sm,
  },
  headerBleed: {
    marginHorizontal: -BoslukTokenlari.lg,
  },
  navRow: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
  },
  nav: {
    flex: 1,
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
    gap: 4,
  },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  navText: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '700' },
  navAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 9 },
  section: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
    flexGrow: 1,
  },
  card: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.md,
  },
  cardActive: { borderColor: RenkTokenlari.borderAccent },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: BoslukTokenlari.md },
  cityBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(232,64,145,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1, gap: 2, minWidth: 0 },
  cardTitle: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '700' },
  cardMeta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted },
  destekPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(61,207,176,0.16)',
  },
  destekPillText: { ...TipografiTokenlari.micro, color: RenkTokenlari.mint, fontSize: 9 },
  statsRow: { flexDirection: 'row', gap: BoslukTokenlari.sm },
  statChip: {
    flex: 1,
    backgroundColor: RenkTokenlari.surface,
    borderRadius: YaricapTokenlari.sm,
    paddingVertical: BoslukTokenlari.sm,
    alignItems: 'center',
    gap: 2,
  },
  statVal: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '700' },
  statLbl: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
});
