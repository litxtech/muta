import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  LobiKatilimcilariniGetir,
  LobiyeKatil,
  LobidenAyril,
} from '../../src/moduller/oda-lobisi/islemler/LobiKatilimIslemleri';
import {
  OdaGirisYetkisiniKontrolEt,
  OdaKapasitesiniKontrolEt,
} from '../../src/moduller/oda-lobisi/islemler/OdaGirisKontrolleri';
import { joinRoom } from '../../src/services/api';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import type { Room } from '../../src/types/models';

/**
 * Lobby AYRI modul — ses odasi business logic burada yok.
 */
export default function OdaLobisiEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [oda, setOda] = useState<Room | null>(null);
  const [katilimcilar, setKatilimcilar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const yetki = await OdaGirisYetkisiniKontrolEt(id);
      if (!yetki.ok || !yetki.oda) {
        Alert.alert('Lobi', yetki.hata ?? 'Oda yok');
        setOda(null);
        return;
      }
      setOda(yetki.oda);
      await LobiyeKatil(id);
      setKatilimcilar(await LobiKatilimcilariniGetir(id).catch(() => []));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        if (id) void LobidenAyril(id);
      };
    }, [load, id]),
  );

  const odayaGir = async () => {
    if (!oda || !user) return;
    const kapasite = await OdaKapasitesiniKontrolEt({
      listener_count: oda.listener_count,
      audience_capacity: (oda as any).audience_capacity,
    });
    if (!kapasite.ok) {
      Alert.alert('Dolu', kapasite.hata);
      return;
    }
    setJoining(true);
    try {
      await joinRoom(oda.id, user.id);
      router.replace(`/room/${oda.id}` as any);
    } catch (e) {
      Alert.alert('Giriş', e instanceof Error ? e.message : 'Hata');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={RenkTokenlari.primary} style={{ marginTop: 80 }} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="oda-lobisi">
        <View style={styles.content}>
          <Text style={styles.title}>{oda?.title ?? 'Lobi'}</Text>
          <Text style={styles.sub}>
            Önizleme · {oda?.listener_count ?? 0} dinleyici · kapasite ayrı kontrol
          </Text>
          <Text style={styles.section}>Lobide bekleyenler</Text>
          <FlatList
            data={katilimcilar}
            keyExtractor={(item, i) => item.user_id ?? String(i)}
            style={{ flex: 1 }}
            ListEmptyComponent={
              <Text style={styles.empty}>Henüz kimse yok (migration 006).</Text>
            }
            renderItem={({ item }) => (
              <Text style={styles.person}>
                {item.profile?.display_name ?? item.user_id?.slice(0, 8)}
              </Text>
            )}
          />
          <GradientButton title="Odaya katıl" onPress={odayaGir} loading={joining} />
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
  section: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, marginTop: 12 },
  empty: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  person: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: RenkTokenlari.border,
  },
});
