import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import {
  GuvenlikOlaylarimiGetir,
  type GuvenlikOlayi,
} from '../../src/moduller/guvenlik/okuma/GuvenlikOlaylarimiGetir';
import { KullaniciBildir } from '../../src/moduller/moderasyon/islemler/ModerasyonIslemleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function GuvenlikMerkeziEkrani() {
  const { isGuest, refreshProfile } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [events, setEvents] = useState<GuvenlikOlayi[]>([]);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setEvents(await GuvenlikOlaylarimiGetir());
    } catch {
      setEvents([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const bildir = () => {
    islemiDene('oy_kullan', async () => {
      if (!reason.trim()) {
        Alert.alert('Sebep gerekli');
        return;
      }
      const r = await KullaniciBildir({ reason: reason.trim() });
      if (!r.ok) Alert.alert('Bildirim', r.hata);
      else {
        Alert.alert('Alındı', 'Rapor güvenlik kuyruğuna düştü.');
        setReason('');
        await load();
      }
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="guvenlik">
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>Security Center</Text>
          <Text style={styles.sub}>Kendi olayların · report stub</Text>

          <TextInput
            style={styles.input}
            placeholder="Rapor sebebi"
            placeholderTextColor={RenkTokenlari.textMuted}
            value={reason}
            onChangeText={setReason}
          />
          <GradientButton title="Rapor gönder" onPress={bildir} />

          <Text style={styles.section}>Olaylar</Text>
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>Olay yok.</Text>}
            renderItem={({ item }) => (
              <Text style={styles.line}>
                {item.severity} · {item.event_type} · risk {item.risk_score}
              </Text>
            )}
          />
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
  section: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, marginTop: 8 },
  empty: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  line: { ...TipografiTokenlari.body, color: RenkTokenlari.text, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderRadius: 12,
    padding: 12,
    color: RenkTokenlari.text,
    backgroundColor: RenkTokenlari.bgCard,
  },
});
