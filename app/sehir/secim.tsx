import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { TextField } from '../../src/components/TextField';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import {
  AktifSecimleriGetir,
  SecimAdaylariniGetir,
  type SehirAdayi,
  type SehirSecimi,
} from '../../src/moduller/sehir-secimleri/okuma/AktifSecimleriGetir';
import {
  SehirAdayBasvurusu,
  SehirOyuKullan,
  SehirSecimOlusturDev,
  SehirSecimiOylamayaAcDev,
} from '../../src/moduller/sehir-secimleri/islemler/SehirSecimIslemleri';
import { SehirleriGetir } from '../../src/moduller/sehirler/okuma/SehirleriGetir';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function SehirSecimEkrani() {
  const { isGuest, refreshProfile } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [elections, setElections] = useState<SehirSecimi[]>([]);
  const [selected, setSelected] = useState<SehirSecimi | null>(null);
  const [candidates, setCandidates] = useState<SehirAdayi[]>([]);
  const [manifesto, setManifesto] = useState('');
  const [busy, setBusy] = useState(false);

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

  const sec = async (el: SehirSecimi) => {
    setSelected(el);
    try {
      setCandidates(await SecimAdaylariniGetir(el.id));
    } catch {
      setCandidates([]);
    }
  };

  const adayOl = () => {
    if (!selected) return;
    islemiDene('oy_kullan', async () => {
      setBusy(true);
      const sonuc = await SehirAdayBasvurusu({
        electionId: selected.id,
        manifesto: manifesto.trim() || undefined,
      });
      setBusy(false);
      if (!sonuc.ok) {
        Alert.alert('Adaylık', sonuc.hata);
        return;
      }
      Alert.alert('Aday oldun');
      await sec(selected);
    });
  };

  const oyVer = (candidateId: string) => {
    if (!selected) return;
    islemiDene('oy_kullan', async () => {
      const sonuc = await SehirOyuKullan({
        electionId: selected.id,
        candidateId,
      });
      if (!sonuc.ok) {
        Alert.alert('Oy', sonuc.hata);
        return;
      }
      Alert.alert('Oy kaydedildi');
      await sec(selected);
    });
  };

  const secimOlustur = () => {
    islemiDene('oy_kullan', async () => {
      setBusy(true);
      try {
        const cities = await SehirleriGetir(1);
        if (!cities[0]) {
          Alert.alert('Şehir yok', 'Önce migration 009 çalıştır.');
          return;
        }
        const sonuc = await SehirSecimOlusturDev({
          cityId: cities[0].id,
          title: `${cities[0].name} Leader`,
        });
        if (!sonuc.ok) {
          Alert.alert('Seçim', sonuc.hata);
          return;
        }
        await load();
        Alert.alert('Dev seçim', 'nominating — aday ol, sonra oylamaya aç.');
      } finally {
        setBusy(false);
      }
    });
  };

  const oylamayaAc = () => {
    if (!selected) return;
    islemiDene('oy_kullan', async () => {
      const sonuc = await SehirSecimiOylamayaAcDev(selected.id);
      if (!sonuc.ok) {
        Alert.alert('Oylama', sonuc.hata);
        return;
      }
      await load();
      await sec({ ...selected, status: 'voting' });
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="sehir-secimleri">
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>City Elections</Text>
          <Text style={styles.sub}>1 oy / seçim · UNIQUE(election, user)</Text>

          <GradientButton
            title="Dev: seçim oluştur"
            variant="ghost"
            onPress={secimOlustur}
            loading={busy}
          />

          <Text style={styles.section}>Aktif seçimler</Text>
          <FlatList
            data={elections}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>Seçim yok.</Text>}
            renderItem={({ item }) => (
              <Pressable style={styles.card} onPress={() => void sec(item)}>
                <Text style={styles.cardTitle}>
                  {item.title} · {item.city?.name}
                </Text>
                <Text style={styles.meta}>
                  {item.status} · {item.role_target}
                </Text>
              </Pressable>
            )}
            style={{ maxHeight: 180 }}
          />

          {selected ? (
            <View style={styles.detail}>
              <Text style={styles.section}>
                {selected.title} ({selected.status})
              </Text>
              {selected.status === 'nominating' ? (
                <>
                  <TextField
                    label="Manifesto"
                    value={manifesto}
                    onChangeText={setManifesto}
                    placeholder="Kısa vaat"
                  />
                  <GradientButton title="Aday ol" onPress={adayOl} loading={busy} />
                  <GradientButton
                    title="Dev: oylamaya aç"
                    variant="ghost"
                    onPress={oylamayaAc}
                  />
                </>
              ) : null}
              {candidates.map((c) => (
                <View key={c.id} style={styles.cand}>
                  <Text style={styles.line}>
                    {c.user_id.slice(0, 8)} · {c.vote_count} oy
                  </Text>
                  {selected.status === 'voting' ? (
                    <GradientButton
                      title="Oy ver"
                      variant="ghost"
                      onPress={() => oyVer(c.id)}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={() => void refreshProfile()}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 20, gap: 8 },
  back: { ...TipografiTokenlari.caption, color: RenkTokenlari.primarySoft },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  section: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, marginTop: 6 },
  empty: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  card: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    marginBottom: 8,
  },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  meta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  detail: { gap: 8, marginTop: 4 },
  cand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: RenkTokenlari.border,
  },
  line: { ...TipografiTokenlari.body, color: RenkTokenlari.text },
});
