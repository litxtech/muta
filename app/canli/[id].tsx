import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { MedyaOdasiBaglan, MedyaOdasiKes } from '../../src/moduller/livekit/MedyaBaglantisi';
import {
  CanliYayinTiyatro,
  type CanliYayinMeta,
} from '../../src/moduller/canli-yayin/bilesenler/CanliYayinTiyatro';
import {
  CanliYayinIzleyiciCik,
  CanliYayinIzleyiciGir,
} from '../../src/moduller/canli-yayin/islemler/CanliYayinIslemleri';
import { useHediyeMagaza } from '../../src/moduller/hediyeler/islemler/useHediyeMagaza';
import { HediyeMagazaBaglamasi } from '../../src/moduller/hediyeler/bilesenler/HediyeMagazaBaglamasi';
import { HediyeAnimasyonKatmani } from '../../src/moduller/hediyeler/bilesenler/HediyeAnimasyonKatmani';
import { supabase } from '../../src/lib/supabase';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

/** Izleyici: tam ekran video + yorum + hediye + beğeni */
export default function CanliIzleyiciEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isGuest, refreshProfile, refreshWallet, wallet } = useAuth();
  const { upgradeAcik, upgradeKapat, upgradeAc } = useMisafirIslemKapisi(isGuest);
  const magaza = useHediyeMagaza();
  const [meta, setMeta] = useState<CanliYayinMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [medyaDurum, setMedyaDurum] = useState('Bağlanıyor…');
  const [medyaMock, setMedyaMock] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_sessions')
        .select(
          '*, host:profiles!live_sessions_host_id_fkey(display_name, username, avatar_url)',
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data || !data.is_live) {
        setMeta(null);
        setMedyaDurum('Yayın sona erdi');
        return;
      }
      const row = data as unknown as {
        id: string;
        host_id: string;
        title: string;
        viewer_count: number | null;
        like_count?: number | null;
        gift_count?: number | null;
        total_coins_earned?: number | null;
        livekit_room_name: string | null;
        host?:
          | {
              display_name: string | null;
              username: string | null;
              avatar_url: string | null;
            }
          | {
              display_name: string | null;
              username: string | null;
              avatar_url: string | null;
            }[]
          | null;
      };
      const hostRaw = row.host;
      const host = Array.isArray(hostRaw) ? hostRaw[0] ?? null : hostRaw ?? null;
      const hostAd =
        host?.display_name?.trim() || host?.username?.trim() || 'Yayıncı';

      setMeta({
        id: row.id,
        host_id: row.host_id,
        title: row.title,
        viewer_count: row.viewer_count ?? 0,
        like_count: row.like_count ?? 0,
        gift_count: row.gift_count ?? 0,
        total_coins_earned: Number(row.total_coins_earned ?? 0),
        hostAd,
      });

      const gir = await CanliYayinIzleyiciGir(row.id);
      if (!gir.ok) {
        Alert.alert('Canlı', gir.hata);
        setMeta(null);
        return;
      }
      setMeta((m) => (m ? { ...m, viewer_count: gir.viewer_count } : m));

      const roomName = row.livekit_room_name ?? `live_${row.id}`;
      const medya = await MedyaOdasiBaglan({
        roomName,
        role: 'listener',
        video: true,
      });
      setMedyaDurum(
        medya.ok
          ? medya.mock
            ? `İzleme · mock`
            : `İzleme`
          : medya.hata,
      );
      setMedyaMock(!!(medya.ok && medya.mock));
    } catch (e) {
      Alert.alert(
        'Canlı',
        e instanceof Error ? e.message : 'Yayın açılamadı',
      );
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        if (id) void CanliYayinIzleyiciCik(id).catch(() => undefined);
        void MedyaOdasiKes();
      };
    }, [load, id]),
  );

  // Yayıncı atar/engellerse veya yayın biterse izleyiciyi çıkar
  useEffect(() => {
    if (!id || !user?.id) return;
    const ch = supabase
      .channel(`canli-ban-${id}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_session_bans',
          filter: `session_id=eq.${id}`,
        },
        (payload: { new?: { user_id?: string; action?: string } }) => {
          if (payload.new?.user_id === user.id) {
            void MedyaOdasiKes();
            Alert.alert(
              'Yayın',
              payload.new.action === 'ban'
                ? 'Yayıncı seni engelledi.'
                : 'Yayıncı seni yayından çıkardı.',
              [{ text: 'Tamam', onPress: () => router.back() }],
            );
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${id}`,
        },
        (payload: { new?: { is_live?: boolean } }) => {
          if (payload.new && payload.new.is_live === false) {
            Alert.alert('Yayın bitti', 'Yayıncı yayını sonlandırdı.', [
              { text: 'Tamam', onPress: () => router.back() },
            ]);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [id, user?.id]);

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator
          color={RenkTokenlari.primarySoft}
          style={{ marginTop: 80 }}
        />
      </Screen>
    );
  }

  if (!meta) {
    return (
      <Screen edges={['top']}>
        <View style={styles.bos}>
          <Text style={styles.bosTitle}>Yayın bulunamadı</Text>
          <Pressable onPress={() => router.back()} style={styles.geri}>
            <Text style={styles.geriText}>Geri</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <ModulHataSiniri modulAdi="canli-yayin">
        <CanliYayinTiyatro
          rol="izleyici"
          meta={meta}
          medyaDurum={medyaDurum}
          medyaMock={medyaMock}
          currentUserId={user?.id}
          canSend={!isGuest}
          walletCoins={wallet?.coins ?? null}
          onNeedUpgrade={upgradeAc}
          onCikis={() => router.back()}
          onMeta={(patch) => setMeta((m) => (m ? { ...m, ...patch } : m))}
          onHediye={() =>
            magaza.ac({
              receiverId: meta.host_id,
              aliciAdi: meta.hostAd,
              animasyon: true,
              onBasarili: (_g, adet) => {
                setMeta((m) =>
                  m
                    ? {
                        ...m,
                        gift_count: m.gift_count + adet,
                      }
                    : m,
                );
              },
            })
          }
        />

        <HediyeMagazaBaglamasi magaza={magaza} misafirKart={false} />
        <HediyeAnimasyonKatmani />

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
  bos: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  bosTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  geri: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
  },
  geriText: { ...TipografiTokenlari.body, color: RenkTokenlari.primarySoft },
});
