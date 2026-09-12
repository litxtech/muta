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
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { AjansBasvurusuOlustur } from '../../src/moduller/ajanslar/islemler/AjansIslemleri';
import {
  AjansBasvurularimiGetir,
  PopulerAjanslariGetir,
  SahipOlunanAjanslariGetir,
  type Ajans,
} from '../../src/moduller/ajanslar/okuma/AjanslariGetir';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function AjansEkrani() {
  const { isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [popular, setPopular] = useState<Ajans[]>([]);
  const [mine, setMine] = useState<Ajans[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, m, a] = await Promise.all([
        PopulerAjanslariGetir().catch(() => []),
        SahipOlunanAjanslariGetir().catch(() => []),
        AjansBasvurularimiGetir().catch(() => []),
      ]);
      setPopular(p);
      setMine(m);
      setApps(a);
    } catch {
      /* migration */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const basvur = () => {
    islemiDene('ajans_olustur', async () => {
      if (!name.trim()) {
        Alert.alert('Ajans adı gerekli');
        return;
      }
      setLoading(true);
      const sonuc = await AjansBasvurusuOlustur({
        agencyName: name.trim(),
        country: country.trim() || undefined,
      });
      setLoading(false);
      if (!sonuc.ok) {
        Alert.alert('Başvuru', sonuc.hata);
        return;
      }
      Alert.alert('Alındı', 'Ajans başvurun pending. Admin onayı sonrası aktif olur.');
      setName('');
      await load();
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="ajanslar">
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>Agencies</Text>
          <Text style={styles.sub}>
            Platform → Agency → Manager → Host · Coin distributor ayrı statü
          </Text>

          <TextField label="Ajans adı" value={name} onChangeText={setName} />
          <TextField label="Ülke" value={country} onChangeText={setCountry} placeholder="TR" />
          <GradientButton title="Ajans başvurusu" onPress={basvur} loading={loading} />

          <Text style={styles.section}>Başvurularım</Text>
          {apps.length === 0 ? (
            <Text style={styles.empty}>Başvuru yok (migration 008).</Text>
          ) : (
            apps.map((a) => (
              <Text key={a.id} style={styles.line}>
                {a.agency_name} · {a.status}
              </Text>
            ))
          )}

          <Text style={styles.section}>Ajanslarım</Text>
          <FlatList
            data={mine.length ? mine : popular}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>Ajans listesi boş.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>
                  {item.agency_public_id} · {item.level_code} · hosts {item.host_count}
                  {item.invite_code ? ` · code ${item.invite_code}` : ''}
                </Text>
              </View>
            )}
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
  section: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, marginTop: 8 },
  empty: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  line: { ...TipografiTokenlari.body, color: RenkTokenlari.text },
  card: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    marginBottom: 8,
    gap: 4,
  },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  cardMeta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
});
