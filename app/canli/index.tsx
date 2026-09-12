import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import {
  CanliYayinBaslat,
  CanliYayinlariGetir,
} from '../../src/moduller/canli-yayin/islemler/CanliYayinIslemleri';
import { LiveKitTokenAl } from '../../src/moduller/livekit/token/LiveKitTokenAl';
import { LiveKitBaglantiYoneticisi } from '../../src/moduller/livekit/baglanti/LiveKitBaglantiYoneticisi';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function CanliYayinEkrani() {
  const { isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [title, setTitle] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const liveEnabled = OzellikBayragiAktifMi('live_enabled');

  const load = useCallback(async () => {
    try {
      setList(await CanliYayinlariGetir());
    } catch {
      setList([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const baslat = () => {
    islemiDene('canli_ac', async () => {
      if (!liveEnabled) {
        Alert.alert(
          'Feature flag',
          'live_enabled kapalı. Admin bayrağını aç veya migration sonrası flag güncelle.',
        );
        return;
      }
      if (!title.trim()) {
        Alert.alert('Başlık gerekli');
        return;
      }
      setLoading(true);
      const sonuc = await CanliYayinBaslat({ title: title.trim(), mode: 'solo' });
      setLoading(false);
      if (!sonuc.ok) {
        Alert.alert('Live', sonuc.hata);
        return;
      }
      const session = sonuc.session as { id: string; livekit_room_name?: string };
      const roomName = session.livekit_room_name ?? `live_${session.id}`;
      const token = await LiveKitTokenAl({ roomName, role: 'host' });
      if (token.ok) {
        await LiveKitBaglantiYoneticisi.baglan({
          url: token.url,
          token: token.token,
          roomName: token.roomName,
          mock: token.mock,
        });
      }
      Alert.alert(
        'Canlı',
        token.ok
          ? token.mock
            ? 'Mock LiveKit baglandi (dev). Edge Function ile gercek token gelecek.'
            : 'LiveKit baglandi.'
          : `Yayin acildi ama token: ${token.ok === false ? token.hata : ''}`,
      );
      await load();
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="canli-yayin">
        <View style={styles.content}>
          <Text style={styles.title}>Live</Text>
          <Text style={styles.sub}>Solo · Multi Guest · 1v1 · 2v2 · Multi-host</Text>
          <TextField
            label="Yayın başlığı"
            value={title}
            onChangeText={setTitle}
            placeholder="Gece show..."
          />
          <GradientButton title="Canlıya çık" onPress={baslat} loading={loading} />
          <GradientButton title="Geri" variant="ghost" onPress={() => router.back()} />
          <Text style={styles.section}>Şimdi canlı</Text>
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text style={styles.empty}>Canlı yayın yok (flag + migration 006).</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {item.mode} · {item.viewer_count} izleyici · score {item.score}
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
  content: { flex: 1, padding: 20, gap: 12 },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  section: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, marginTop: 8 },
  empty: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
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
