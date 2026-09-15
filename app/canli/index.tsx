import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { KlavyeKapatan } from '../../src/components/KlavyeKapatan';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import {
  CanliYayinBaslat,
  CanliYayinBitir,
  CanliYayinlariGetir,
} from '../../src/moduller/canli-yayin/islemler/CanliYayinIslemleri';
import {
  CanliYayinTiyatro,
  type CanliYayinMeta,
} from '../../src/moduller/canli-yayin/bilesenler/CanliYayinTiyatro';
import { MedyaOdasiBaglan, MedyaOdasiKes } from '../../src/moduller/livekit/MedyaBaglantisi';
import { PkMacBaslat } from '../../src/moduller/pk/islemler/PkMacBaslat';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { HediyeAnimasyonKatmani } from '../../src/moduller/hediyeler/bilesenler/HediyeAnimasyonKatmani';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function CanliYayinEkrani() {
  const navigation = useNavigation();
  const { user, isGuest, refreshProfile, refreshWallet, wallet, profile } =
    useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene, upgradeAc } =
    useMisafirIslemKapisi(isGuest);
  const [title, setTitle] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [yayinda, setYayinda] = useState(false);
  const [meta, setMeta] = useState<CanliYayinMeta | null>(null);
  const [medyaDurum, setMedyaDurum] = useState<string | null>(null);
  const [medyaMock, setMedyaMock] = useState(false);
  const yayindaRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const liveEnabled = OzellikBayragiAktifMi('live_enabled');
  const videoEnabled = OzellikBayragiAktifMi('video_enabled');

  const load = useCallback(async () => {
    try {
      setList(await CanliYayinlariGetir());
    } catch {
      setList([]);
    }
  }, []);

  const yayiniSonlandir = useCallback(async () => {
    const sid = sessionIdRef.current;
    await MedyaOdasiKes();
    if (yayindaRef.current || sid) {
      await CanliYayinBitir(sid).catch(() => undefined);
    }
    yayindaRef.current = false;
    sessionIdRef.current = null;
    setYayinda(false);
    setMeta(null);
    setMedyaDurum(null);
    setMedyaMock(false);
    await load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        void (async () => {
          const sid = sessionIdRef.current;
          const aktif = yayindaRef.current || !!sid;
          await MedyaOdasiKes();
          if (aktif) {
            await CanliYayinBitir(sid).catch(() => undefined);
          }
          yayindaRef.current = false;
          sessionIdRef.current = null;
        })();
      };
    }, [load]),
  );

  // Geri jesti / hardware back: yayını bitir
  React.useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!yayindaRef.current) return;
      e.preventDefault();
      Alert.alert('Yayını bitir', 'Çıkınca canlı yayın sonlanır.', [
        { text: 'Kal', style: 'cancel' },
        {
          text: 'Bitir ve çık',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await yayiniSonlandir();
              navigation.dispatch(e.data.action);
            })();
          },
        },
      ]);
    });
    return unsub;
  }, [navigation, yayiniSonlandir]);

  const baslat = () => {
    islemiDene('canli_ac', async () => {
      if (!liveEnabled) {
        Alert.alert(
          'Özellik kapalı',
          'Canlı yayın şu an kapalı. Daha sonra tekrar dene.',
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
        Alert.alert('Canlı', sonuc.hata);
        return;
      }
      const session = sonuc.session;
      const roomName = session.livekit_room_name ?? `live_${session.id}`;
      const medya = await MedyaOdasiBaglan({
        roomName,
        role: 'host',
        video: videoEnabled,
      });
      sessionIdRef.current = session.id;
      yayindaRef.current = true;
      const hostAd =
        profile?.display_name?.trim() ||
        profile?.username?.trim() ||
        'Sen';
      setMeta({
        id: session.id,
        host_id: user?.id ?? '',
        title: title.trim(),
        viewer_count: 0,
        like_count: 0,
        gift_count: 0,
        total_coins_earned: 0,
        hostAd,
      });
      setYayinda(true);
      setMedyaMock(!!(medya.ok && medya.mock));
      setMedyaDurum(
        medya.ok
          ? medya.mock
            ? `Mock yayın`
            : videoEnabled
              ? 'Kamera açık'
              : 'Video kapalı'
          : medya.hata,
      );
      await load();
    });
  };

  const bitir = async () => {
    setLoading(true);
    await yayiniSonlandir();
    setLoading(false);
    Alert.alert('Yayın bitti', 'Canlı yayın sonlandırıldı.');
  };

  if (yayinda && meta) {
    return (
      <Screen edges={[]}>
        <ModulHataSiniri modulAdi="canli-yayin">
          <CanliYayinTiyatro
            rol="host"
            meta={meta}
            medyaDurum={medyaDurum}
            medyaMock={medyaMock || !videoEnabled}
            currentUserId={user?.id}
            canSend={!isGuest}
            walletCoins={wallet?.coins ?? null}
            onNeedUpgrade={upgradeAc}
            onBitir={() => void bitir()}
            onMeta={(patch) => setMeta((m) => (m ? { ...m, ...patch } : m))}
            onPk={() => {
              void (async () => {
                const r = await PkMacBaslat({
                  liveAId: meta.id,
                  sureSaniye: 300,
                });
                if (!r.ok) {
                  Alert.alert('PK', r.hata);
                  return;
                }
                Alert.alert('PK başladı', 'Arena 5 dk', [
                  {
                    text: 'Arenaya git',
                    onPress: () => router.push('/pk' as any),
                  },
                  { text: 'Tamam' },
                ]);
              })();
            }}
          />
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

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="canli-yayin">
        <EkranBasligi
          title="Canlı Yayın"
          subtitle="Yayın · sohbet · izleyici"
        />
        <KlavyeKapatan style={styles.content}>
          <View style={styles.studio}>
            <LinearGradient
              colors={['#2A1830', '#14101C', '#1A1224']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.studioInner}
            >
              <View style={styles.studioIcon}>
                <Ionicons
                  name="videocam"
                  size={28}
                  color={RenkTokenlari.primarySoft}
                />
              </View>
              <Text style={styles.studioTitle}>Yayın stüdyosu</Text>
              <Text style={styles.studioAlt}>
                Başlık yaz, canlıya çık — kamera o anda açılır
              </Text>
            </LinearGradient>
          </View>

          <View style={styles.goLiveBox}>
            <TextField
              label="Yayın başlığı"
              value={title}
              onChangeText={setTitle}
              placeholder="Gece şovu..."
            />
            <GradientButton
              title="Canlıya çık"
              onPress={baslat}
              loading={loading}
            />
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.section}>Şimdi canlı</Text>
            <Text style={styles.count}>{list.length}</Text>
          </View>
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              <BosDurum
                icon="videocam-outline"
                title="Canlı yayın yok"
                body="Yayınlar başladığında burada listelenir."
              />
            }
            renderItem={({ item }) => {
              const host = item.host;
              const ad =
                host?.display_name?.trim() ||
                host?.username?.trim() ||
                'Yayıncı';
              const gifts = item.gift_count ?? 0;
              const coins = item.total_coins_earned ?? item.score ?? 0;
              const likes = item.like_count ?? 0;
              const viewers = item.viewer_count ?? 0;
              const kapak = host?.avatar_url ?? null;
              return (
                <Pressable
                  onPress={() => router.push(`/canli/${item.id}` as any)}
                  style={({ pressed }) => [
                    styles.cardPress,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.card}>
                    {kapak ? (
                      <Image source={{ uri: kapak }} style={styles.cardKapak} />
                    ) : (
                      <LinearGradient
                        colors={['#2E1A32', '#1A1224', '#14101C']}
                        style={styles.cardKapak}
                      />
                    )}
                    <LinearGradient
                      colors={['rgba(10,8,16,0.15)', 'rgba(10,8,16,0.92)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.cardTop}>
                      <View style={styles.livePill}>
                        <View style={styles.liveDot} />
                        <Text style={styles.livePillText}>CANLI</Text>
                      </View>
                      <View style={styles.viewerChip}>
                        <Ionicons
                          name="eye"
                          size={11}
                          color={RenkTokenlari.mint}
                        />
                        <Text style={styles.viewerText}>{viewers}</Text>
                      </View>
                    </View>
                    <View style={styles.cardBottom}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <View style={styles.cardMetaRow}>
                        <Text style={styles.cardHost} numberOfLines={1}>
                          {ad}
                        </Text>
                        <View style={styles.cardStats}>
                          {likes > 0 ? (
                            <Text style={styles.cardStat}>♥{likes}</Text>
                          ) : null}
                          {gifts > 0 ? (
                            <Text style={styles.cardStat}>🎁{gifts}</Text>
                          ) : null}
                          {coins > 0 ? (
                            <Text style={styles.cardStat}>🪙{coins}</Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        </KlavyeKapatan>
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
  content: {
    flex: 1,
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xl,
    gap: BoslukTokenlari.md,
  },
  studio: {
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  studioInner: {
    aspectRatio: 16 / 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  studioIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,64,145,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.3)',
    marginBottom: 4,
  },
  studioTitle: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  studioAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
  goLiveBox: { gap: BoslukTokenlari.md },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: BoslukTokenlari.sm,
  },
  section: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  count: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  list: { flexGrow: 1, gap: BoslukTokenlari.md, paddingBottom: 8 },
  cardPress: { width: '100%' },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  card: {
    borderRadius: YaricapTokenlari.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.28)',
    aspectRatio: 16 / 10,
    justifyContent: 'space-between',
  },
  cardKapak: {
    ...StyleSheet.absoluteFill,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.md,
    paddingTop: BoslukTokenlari.md,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(8,4,14,0.62)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RenkTokenlari.live,
  },
  livePillText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  viewerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(8,4,14,0.62)',
  },
  viewerText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  cardBottom: {
    paddingHorizontal: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.md,
    gap: 6,
  },
  cardTitle: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 16,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardHost: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
    minWidth: 0,
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  cardStat: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
});
