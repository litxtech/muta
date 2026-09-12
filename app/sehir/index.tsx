import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { SehirDestekle } from '../../src/moduller/sehirler/islemler/SehirDestekle';
import {
  SehirleriGetir,
  type GeoSehir,
} from '../../src/moduller/sehirler/okuma/SehirleriGetir';
import { DesteklenenSehirleriGetir } from '../../src/moduller/sehirler/okuma/DesteklenenSehirleriGetir';
import { ResmiSehirOdalariniGetir } from '../../src/moduller/sehirler/okuma/ResmiSehirOdalariniGetir';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function SehirHubEkrani() {
  const { isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const leagueOn = OzellikBayragiAktifMi('city_league_enabled');

  const [cities, setCities] = useState<GeoSehir[]>([]);
  const [supportedIds, setSupportedIds] = useState<Set<string>>(new Set());
  const [roomCount, setRoomCount] = useState(0);
  const [busy, setBusy] = useState(false);

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
        Alert.alert('Kapalı', 'city_league_enabled bayrağını açın.');
        return;
      }
      setBusy(true);
      const sonuc = await SehirDestekle({ cityId, isPrimary: true });
      setBusy(false);
      if (!sonuc.ok) {
        Alert.alert('Destek', sonuc.hata);
        return;
      }
      await load();
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="sehirler">
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>City Platform</Text>
          <Text style={styles.sub}>
            Resmi odalar · Lig · Battle · Seçim · {roomCount} official room
          </Text>

          <View style={styles.navRow}>
            <Pressable style={styles.nav} onPress={() => router.push('/sehir/lig' as any)}>
              <Text style={styles.navText}>Lig</Text>
            </Pressable>
            <Pressable style={styles.nav} onPress={() => router.push('/sehir/savas' as any)}>
              <Text style={styles.navText}>Savaş</Text>
            </Pressable>
            <Pressable style={styles.nav} onPress={() => router.push('/sehir/secim' as any)}>
              <Text style={styles.navText}>Seçim</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Şehirler</Text>
          <FlatList
            data={cities}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text style={styles.empty}>Şehir yok — migration 009 çalıştır.</Text>
            }
            renderItem={({ item }) => {
              const destekli = supportedIds.has(item.id);
              return (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {item.name}{' '}
                    <Text style={styles.cardMeta}>
                      {item.country_code} · {item.slug}
                    </Text>
                  </Text>
                  <Text style={styles.cardMeta}>
                    power {item.power_score} · destekçi {item.supporter_count}
                    {destekli ? ' · destekliyorsun' : ''}
                  </Text>
                  <GradientButton
                    title={destekli ? 'Destekleniyor' : 'Destekle'}
                    onPress={() => destekle(item.id)}
                    loading={busy}
                    variant={destekli ? 'ghost' : 'primary'}
                  />
                </View>
              );
            }}
          />
        </View>
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
  content: { flex: 1, padding: 20, gap: 10 },
  back: { ...TipografiTokenlari.caption, color: RenkTokenlari.primarySoft },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  navRow: { flexDirection: 'row', gap: 8 },
  nav: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
  },
  navText: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  section: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, marginTop: 4 },
  empty: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  card: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    marginBottom: 8,
    gap: 6,
  },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  cardMeta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
});
