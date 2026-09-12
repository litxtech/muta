import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { PkCanliMaclariGetir, type PkMac } from '../../src/moduller/pk/skor/PkSkorOku';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

/** PK skor UI — authoritative deger backend'den okunur */
export default function PkEkrani() {
  const [maclar, setMaclar] = useState<PkMac[]>([]);
  const enabled = OzellikBayragiAktifMi('pk_enabled');

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setMaclar([]);
        return;
      }
      PkCanliMaclariGetir()
        .then(setMaclar)
        .catch(() => setMaclar([]));
    }, [enabled]),
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="pk">
        <View style={styles.content}>
          <Text style={styles.title}>PK Now</Text>
          <Text style={styles.sub}>
            1v1 · 2v2 · Team · Agency · Country · City · Tournament
            {'\n'}Skor client belirlemez.
          </Text>
          {!enabled ? (
            <Text style={styles.warn}>pk_enabled bayrağı kapalı.</Text>
          ) : null}
          <FlatList
            data={maclar}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text style={styles.empty}>Canlı PK yok. Migration 006 sonrası oluşturulur.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.type}>{item.pk_type.toUpperCase()}</Text>
                <Text style={styles.score}>
                  {item.score_a} — {item.score_b}
                </Text>
                <Text style={styles.meta}>{item.status}</Text>
              </View>
            )}
          />
          <GradientButton title="Geri" variant="ghost" onPress={() => router.back()} />
        </View>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 20, gap: 10 },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  warn: { ...TipografiTokenlari.body, color: RenkTokenlari.warning },
  empty: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted, marginTop: 20 },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    marginBottom: 10,
    alignItems: 'center',
    gap: 6,
  },
  type: { ...TipografiTokenlari.micro, color: RenkTokenlari.accent },
  score: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  meta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
});
