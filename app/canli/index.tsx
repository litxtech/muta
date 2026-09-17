import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '../../src/components/Screen';
import { BosDurum } from '../../src/components/BosDurum';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import {
  CanliYayinBaslat,
  CanliYayinBitir,
  CanliYayinlariGetir,
  TakipCanliYayinlariGetir,
} from '../../src/moduller/canli-yayin/islemler/CanliYayinIslemleri';
import {
  CanliYayinTiyatro,
  type CanliYayinMeta,
} from '../../src/moduller/canli-yayin/bilesenler/CanliYayinTiyatro';
import { CanliYayinMarkaBasligi } from '../../src/moduller/canli-yayin/bilesenler/CanliYayinMarkaBasligi';
import { CanliYayinStudioKarti } from '../../src/moduller/canli-yayin/bilesenler/CanliYayinStudioKarti';
import { CanliYayinKarti } from '../../src/moduller/canli-yayin/bilesenler/CanliYayinKarti';
import { MedyaOdasiBaglan, MedyaOdasiKes } from '../../src/moduller/livekit/MedyaBaglantisi';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { HediyeAnimasyonKatmani } from '../../src/moduller/hediyeler/bilesenler/HediyeAnimasyonKatmani';
import { useCanliHediyeCanlisi } from '../../src/moduller/hediyeler/gercek-zamanli/useCanliHediyeCanlisi';
import { HediyeKatalogunuGetir } from '../../src/moduller/hediyeler/okuma/HediyeKatalogunuGetir';
import { HEDIYE_FALLBACK_50 } from '../../src/moduller/hediyeler/katalog/HediyeFallback50';
import { PkDavetPaneli } from '../../src/moduller/pk/bilesenler/PkDavetPaneli';
import { PkDavetModal } from '../../src/moduller/pk/bilesenler/PkDavetModal';
import { usePkDaveti } from '../../src/moduller/pk/kancalar/usePkDaveti';
import { useCanliPkMac } from '../../src/moduller/pk/kancalar/useCanliPkMac';
import type { Gift } from '../../src/types/models';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type CanliSekme = 'hepsi' | 'takip';

export default function CanliYayinEkrani() {
  const navigation = useNavigation();
  const { user, isGuest, refreshProfile, refreshWallet, wallet, profile } =
    useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene, upgradeAc } =
    useMisafirIslemKapisi(isGuest);
  const [title, setTitle] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [canliSekme, setCanliSekme] = useState<CanliSekme>('hepsi');
  const [yayinda, setYayinda] = useState(false);
  const [meta, setMeta] = useState<CanliYayinMeta | null>(null);
  const [medyaDurum, setMedyaDurum] = useState<string | null>(null);
  const [medyaMock, setMedyaMock] = useState(false);
  const [gifts, setGifts] = useState<Gift[]>(HEDIYE_FALLBACK_50);
  const [pkDavetAcik, setPkDavetAcik] = useState(false);
  const yayindaRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const liveEnabled = OzellikBayragiAktifMi('live_enabled');
  const videoEnabled = OzellikBayragiAktifMi('video_enabled');

  const baslikOnerisi = useMemo(() => {
    const ad = profile?.display_name?.trim() || profile?.username?.trim();
    if (!ad) return '';
    return `${ad} canlıda`;
  }, [profile?.display_name, profile?.username]);

  const { davet: gelenPkDavet, temizle: pkDavetTemizle } = usePkDaveti({
    hostUserId: user?.id,
    enabled: yayinda && OzellikBayragiAktifMi('pk_enabled'),
  });
  const { mac: pkMac, yenile: pkYenile } = useCanliPkMac({
    liveSessionId: meta?.id,
    enabled: yayinda && !!meta?.id,
  });

  useCanliHediyeCanlisi({
    sessionId: meta?.id,
    selfUserId: user?.id,
    gifts,
    enabled: yayinda && !!meta?.id,
  });

  React.useEffect(() => {
    void HediyeKatalogunuGetir()
      .then((rows) => {
        if (rows.length) setGifts(rows);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    try {
      setList(
        canliSekme === 'takip'
          ? await TakipCanliYayinlariGetir()
          : await CanliYayinlariGetir(),
      );
    } catch {
      setList([]);
    }
  }, [canliSekme]);

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
            pkMac={pkMac}
            onPk={() => {
              if (pkMac) {
                Alert.alert('PK', 'Zaten bir PK maçındasın.');
                return;
              }
              setPkDavetAcik(true);
            }}
          />
          <PkDavetPaneli
            visible={pkDavetAcik}
            fromLiveId={meta.id}
            selfHostId={user?.id ?? meta.host_id}
            onClose={() => setPkDavetAcik(false)}
            onGonderildi={() => {
              Alert.alert(
                'PK daveti gönderildi',
                'Rakip kabul ederse maç başlar (60 sn içinde).',
              );
            }}
          />
          <PkDavetModal
            davet={gelenPkDavet}
            onKapat={pkDavetTemizle}
            onSonuc={(s) => {
              if (s.status === 'accepted') {
                void pkYenile();
                Alert.alert('PK başladı!', 'Hediyeler skor ve cüzdana anlık işlenir.');
              }
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
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <CanliYayinMarkaBasligi
                canliSayisi={list.length}
                onGeri={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace('/(tabs)' as any);
                }}
              />
              <CanliYayinStudioKarti
                title={title}
                onChangeTitle={setTitle}
                onBaslat={baslat}
                loading={loading}
                placeholder={baslikOnerisi || 'Gece şovu...'}
              />

              <Animated.View
                entering={FadeInDown.delay(120)
                  .duration(AnimasyonTokenlari.yavas)
                  .springify()
                  .damping(18)}
                style={styles.sectionRow}
              >
                <View style={styles.sectionSol}>
                  <View style={styles.sectionAccent} />
                  <Text style={styles.section}>Şimdi canlı</Text>
                </View>
                <View style={styles.sekmeSerit}>
                  {(
                    [
                      { id: 'hepsi' as const, label: 'Hepsi' },
                      { id: 'takip' as const, label: 'Takip' },
                    ] as const
                  ).map((s) => {
                    const aktif = canliSekme === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setCanliSekme(s.id)}
                        style={[styles.sekme, aktif && styles.sekmeAktif]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: aktif }}
                      >
                        <Text
                          style={[styles.sekmeYazi, aktif && styles.sekmeYaziAktif]}
                        >
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            </View>
          }
          ListEmptyComponent={
            <BosDurum
              icon="videocam-outline"
              title={
                canliSekme === 'takip'
                  ? 'Takip ettiğin yayın yok'
                  : 'Canlı yayın yok'
              }
              body={
                canliSekme === 'takip'
                  ? 'Takip ettiğin hesaplar yayına geçince burada görünür.'
                  : 'Yayınlar başladığında burada listelenir.'
              }
            />
          }
          renderItem={({ item, index }) => (
            <CanliYayinKarti
              item={item}
              index={index}
              onPress={() => router.push(`/canli/${item.id}` as any)}
            />
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
  header: {
    gap: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: BoslukTokenlari.sm,
    gap: BoslukTokenlari.md,
  },
  sectionSol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  sectionAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: RenkTokenlari.primary,
  },
  section: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 17,
  },
  sekmeSerit: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: RenkTokenlari.bgCard,
    borderRadius: YaricapTokenlari.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  sekme: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
  },
  sekmeAktif: {
    backgroundColor: 'rgba(232,64,145,0.2)',
  },
  sekmeYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '700',
  },
  sekmeYaziAktif: {
    color: RenkTokenlari.primarySoft,
  },
  list: {
    flexGrow: 1,
    gap: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxl,
  },
});
