import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
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
import {
  MesajKonulariniGetir,
  type MesajKonusu,
} from '../../src/moduller/mesajlasma/okuma/MesajKonulariniGetir';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function MessagesScreen() {
  const acik = OzellikBayragiAktifMi('messages_enabled');
  const { isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [konular, setKonular] = useState<MesajKonusu[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!acik || isGuest) {
      setKonular([]);
      return;
    }
    setLoading(true);
    try {
      setKonular(await MesajKonulariniGetir());
    } catch {
      setKonular([]);
    } finally {
      setLoading(false);
    }
  }, [acik, isGuest]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="mesajlasma">
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.sub}>
            {acik
              ? isGuest
                ? 'Misafir mesaj gönderemez — hesabını tamamla.'
                : 'Direkt mesajlar · pagination hazır'
              : 'messages_enabled kapalı'}
          </Text>
        </View>

        <GradientButton
          title="Yeni sohbet"
          style={{ marginHorizontal: 20, marginBottom: 12 }}
          onPress={() =>
            islemiDene('mesaj_gonder', () => {
              router.push('/mesaj/yeni' as any);
            })
          }
        />

        <FlatList
          data={konular}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={RenkTokenlari.primary}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Henüz sohbet yok. Migration 005 sonrası başlatabilirsin.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/mesaj/${item.id}` as any)}
            >
              <Text style={styles.preview} numberOfLines={1}>
                {item.last_message_preview ?? 'Sohbet'}
              </Text>
              <Text style={styles.meta}>
                {item.last_message_at
                  ? new Date(item.last_message_at).toLocaleString()
                  : '—'}
              </Text>
            </Pressable>
          )}
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
  header: { paddingHorizontal: 20, paddingTop: 8, gap: 4, marginBottom: 8 },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  empty: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: 32,
  },
  card: {
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 6,
  },
  preview: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  meta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
});
