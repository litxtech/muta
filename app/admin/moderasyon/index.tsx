import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { EkranBasligi } from '../../../src/components/EkranBasligi';
import { useAuth } from '../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { AdminRaporListesi } from '../../../src/moduller/admin/platform/AdminPlatformIslemleri';
import type { AdminRapor } from '../../../src/moduller/admin/tipler/PlatformTipleri';
import {
  AdminStil,
  RaporDurumEtiketi,
} from '../../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';

function kisiAd(k?: {
  display_name?: string | null;
  username?: string | null;
} | null) {
  if (!k) return null;
  return k.display_name?.trim() || (k.username ? `@${k.username}` : null);
}

export default function AdminModerasyonEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [raporlar, setRaporlar] = useState<AdminRapor[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setRaporlar(await AdminRaporListesi(60));
    } catch (e) {
      Alert.alert(
        'Moderasyon',
        e instanceof Error ? e.message : 'Raporlar yüklenemedi',
      );
      setRaporlar([]);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!admin) {
        router.replace('/(tabs)/profile');
        return;
      }
      void yukle();
    }, [admin, yukle]),
  );

  if (!admin) return null;

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Moderasyon"
        subtitle="Rapor kuyruğu · detay & işlem"
        fallbackHref="/admin"
      />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={
          <RefreshControl
            refreshing={yukleniyor}
            onRefresh={() => void yukle()}
            tintColor={RenkTokenlari.primarySoft}
          />
        }
      >
        {yukleniyor && !raporlar.length ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : !raporlar.length ? (
          <Text style={AdminStil.bos}>Açık rapor yok</Text>
        ) : (
          raporlar.map((r) => {
            const hedef = kisiAd(r.target);
            const bildiren = kisiAd(r.reporter);
            return (
              <Pressable
                key={r.id}
                style={AdminStil.kart}
                onPress={() =>
                  router.push(`/admin/moderasyon/${r.id}` as any)
                }
              >
                <View style={AdminStil.satir}>
                  <Text style={AdminStil.kartBaslik} numberOfLines={2}>
                    {r.reason}
                  </Text>
                  <View style={AdminStil.chip}>
                    <Text style={AdminStil.chipYazi}>
                      {RaporDurumEtiketi(r.status)}
                    </Text>
                  </View>
                </View>
                {hedef ? (
                  <Text style={AdminStil.kartAlt}>
                    Bildirilen: {hedef}
                    {r.target?.banned_at ? ' · banlı' : ''}
                  </Text>
                ) : null}
                {r.content_type === 'room' || r.room_id ? (
                  <Text style={AdminStil.kartAlt}>
                    Ses odası
                    {r.room?.title ? ` · ${r.room.title}` : ''}
                  </Text>
                ) : null}
                {r.content_type === 'live' || r.content_type === 'live_session' ? (
                  <Text style={AdminStil.kartAlt}>Canlı yayın bildirimi</Text>
                ) : null}
                {bildiren ? (
                  <Text style={AdminStil.kartAlt}>Bildiren: {bildiren}</Text>
                ) : null}
                {r.ozet || r.details ? (
                  <Text style={AdminStil.kartAlt} numberOfLines={2}>
                    {r.ozet || r.details}
                  </Text>
                ) : null}
                <View style={AdminStil.satir}>
                  <Text style={AdminStil.kartAlt}>
                    {new Date(r.created_at).toLocaleString('tr-TR')}
                  </Text>
                  <Text
                    style={[
                      AdminStil.aksiyonYazi,
                      { color: RenkTokenlari.primarySoft },
                    ]}
                  >
                    Detayı gör →
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
